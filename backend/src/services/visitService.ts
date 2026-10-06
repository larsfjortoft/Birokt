import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { env } from '../config/env.js';
import { auditData } from './complianceService.js';
import { createInspection, createInspectionSchema } from './inspectionService.js';
import { createFeeding, createFeedingSchema } from './feedingService.js';

export const visitEntrySchema = z.object({
  kind: z.enum(['inspection', 'feeding', 'followup', 'clarification']),
  hiveId: z.string().uuid().nullable(),
  sourceText: z.string().max(20000),
  payload: z.record(z.unknown()),
});
const resultSchema = z.object({ transcript: z.string().min(1).max(500000), summary: z.string().max(20000), entries: z.array(visitEntrySchema.extend({ hiveId: z.string().nullable() })).max(500) });

export function serializeVisit(visit: any) {
  const { audioPath, audioHash, processingToken, ...publicVisit } = visit;
  return { ...publicVisit, audioReceived: !!audioPath, entries: visit.entries?.map((entry: any) => ({ ...entry, payload: JSON.parse(entry.payload) })) };
}

export async function processNextVisit() {
  // A restart can recover abandoned work; results from an expired lease cannot overwrite new work.
  const expired = new Date(Date.now() - 20 * 60_000);
  await prisma.fieldVisit.updateMany({ where: { status: 'processing', processingAt: { lt: expired } }, data: { status: 'failed', processingToken: null, lastError: 'Behandlingen ble avbrutt. Opptaket er sikret; prøv igjen.' } });
  const visit = await prisma.fieldVisit.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' } });
  if (!visit?.audioPath) return;
  const token = randomUUID();
  const claimed = await prisma.fieldVisit.updateMany({ where: { id: visit.id, status: 'queued' }, data: { status: 'processing', processingToken: token, processingAt: new Date(), lastError: null } });
  if (!claimed.count) return;
  try {
    const hives = await prisma.hive.findMany({ where: { apiaryId: visit.apiaryId }, select: { id: true, hiveNumber: true, status: true } });
    const form = new FormData();
    form.append('context', JSON.stringify({ visitId: visit.id, apiaryId: visit.apiaryId, apiaryName: visit.apiaryName, startedAt: visit.startedAt, endedAt: visit.endedAt, timezone: 'Europe/Oslo', interrupted: visit.interrupted, hives }));
    form.append('audio', new Blob([await fs.readFile(visit.audioPath)], { type: 'audio/mp4' }), `${visit.id}.m4a`);
    const response = await fetch(`${env.FIELD_VOICE_URL}/visits/process`, { method: 'POST', body: form, signal: AbortSignal.timeout(15 * 60_000) });
    if (!response.ok) throw new Error(`Hermes/transkripsjon svarte ${response.status}. Opptaket er fortsatt sikret.`);
    const result = resultSchema.parse(await response.json());
    await prisma.$transaction(async tx => {
      const owned = await tx.fieldVisit.updateMany({ where: { id: visit.id, processingToken: token, status: 'processing' }, data: { status: 'ready', transcript: result.transcript, summary: result.summary, processingToken: null } });
      if (!owned.count) return;
      const allowedHives = new Set(hives.map(h => h.id));
      for (const input of result.entries) {
        // Invalid identities and unsupported writes stay visible as clarification, never as guessed events.
        const validHive = input.hiveId && allowedHives.has(input.hiveId);
        const validSource = !!input.sourceText.trim() && result.transcript.includes(input.sourceText);
        const kind = validSource && (validHive || input.kind === 'clarification') ? input.kind : 'clarification';
        const payload = validSource ? input.payload : { ...input.payload, proposedSourceText: input.sourceText, notes: `Kildeutdraget kunne ikke bekreftes i transkripsjonen. Kontroller opptaket. ${input.payload.notes || ''}` };
        await tx.visitEntry.create({ data: { visitId: visit.id, kind, hiveId: validHive ? input.hiveId : null, sourceText: validSource ? input.sourceText : '', payload: JSON.stringify(payload) } });
      }
    });
  } catch (error) {
    console.error('Visit processing failed:', visit.id, error instanceof Error ? error.message : 'Unknown error');
    await prisma.fieldVisit.updateMany({ where: { id: visit.id, processingToken: token }, data: { status: 'failed', processingToken: null, lastError: error instanceof z.ZodError ? 'Hermes returnerte et ugyldig registreringsforslag. Prøv igjen.' : error instanceof Error ? error.message : 'Behandlingen feilet.' } });
  }
}

export function startVisitWorker() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    try { await processNextVisit(); } catch (error) { console.error('Visit worker:', error); }
    if (!stopped) { timer = setTimeout(run, 3000); timer.unref(); }
  };
  void run();
  return () => { stopped = true; clearTimeout(timer); };
}

export async function acceptVisitEntry(userId: string, visitId: string, entryId: string, version: number) {
  return prisma.$transaction(async tx => {
    const entry = await tx.visitEntry.findFirst({ where: { id: entryId, visitId, visit: { userId } } });
    if (!entry) throw new Error('Registreringen finnes ikke.');
    // The entry itself is the idempotency key, including after an HTTP response is lost.
    if (entry.state === 'accepted') return entry;
    if (entry.version !== version || entry.state !== 'pending') throw new Error('Registreringen er endret. Last besøket på nytt.');
    if (!entry.hiveId || entry.kind === 'clarification') throw new Error('Avklar kube og registreringstype først.');
    const payload = JSON.parse(entry.payload);
    let entityId: string;
    if (entry.kind === 'inspection') {
      entityId = (await createInspection(tx, userId, createInspectionSchema.parse({ ...payload, hiveId: entry.hiveId }), { visitId, entryId })).id;
    } else if (entry.kind === 'feeding') {
      entityId = (await createFeeding(tx, userId, createFeedingSchema.parse({ ...payload, hiveId: entry.hiveId }))).id;
    } else {
      const task = z.object({ title: z.string().trim().min(1).max(200), notes: z.string().optional(), dueAt: z.string().datetime().nullish() }).parse(payload);
      if (!task.dueAt) throw new Error('Velg en dato for å legge oppfølgingen i kalenderen. Udatert oppfølging kan stå åpen i besøket.');
      const access = await tx.hive.findFirst({ where: { id: entry.hiveId, apiary: { userApiaries: { some: { userId, role: { not: 'viewer' } } } } } });
      if (!access) throw new Error('Ingen skrivetilgang til kuben.');
      entityId = (await tx.calendarEvent.create({ data: { userId, hiveId: entry.hiveId, apiaryId: access.apiaryId, title: task.title, description: task.notes, eventType: 'other', eventDate: new Date(task.dueAt), allDay: true } })).id;
    }
    const updated = await tx.visitEntry.update({ where: { id: entry.id }, data: { state: 'accepted', entityId, version: { increment: 1 } } });
    await tx.auditLog.create({ data: auditData({ userId, entityType: 'VisitEntry', entityId: entry.id, action: 'accept', before: entry, after: updated }) });
    return updated;
  });
}
