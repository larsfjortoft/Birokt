import { Router, Request, Response, NextFunction } from 'express';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { serializeVisit, acceptVisitEntry, visitEntrySchema } from '../services/visitService.js';
import { auditData } from '../services/complianceService.js';
import { correctVisitInspection } from '../services/inspectionService.js';
import { createFeedingSchema } from '../services/feedingService.js';

const router = Router();
router.use(authenticate);
const dir = path.resolve(env.VISIT_AUDIO_DIR);
const upload = multer({ dest: dir, limits: { fileSize: 24 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, done) => {
  done(null, ['audio/m4a', 'audio/mp4', 'audio/x-m4a', 'application/octet-stream'].includes(file.mimetype));
} });
const handle = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, _next: NextFunction) => {
  void fn(req, res).catch(error => {
    if (res.headersSent) return;
    if (error instanceof z.ZodError) sendError(res, 'VALIDATION_ERROR', 'Kontroller feltene i registreringen.', 400, error.issues.map(i => ({ field: i.path.join('.'), message: i.message })));
    else sendError(res, 'VISIT_ERROR', error instanceof Error ? error.message : 'Besøket kunne ikke behandles.', 409);
  });
};
async function ownVisit(req: Request) {
  const id = z.string().uuid().parse(req.params.id);
  const visit = await prisma.fieldVisit.findFirst({ where: { id, userId: req.user!.id } });
  if (!visit) throw new Error('Besøket finnes ikke.');
  return visit;
}
async function validateHive(userId: string, hiveId: string | null) {
  if (hiveId && !await prisma.hive.findFirst({ where: { id: hiveId, apiary: { userApiaries: { some: { userId, role: { not: 'viewer' } } } } } })) throw new Error('Ingen tilgang til kuben.');
}

router.get('/', handle(async (req, res) => {
  const visits = await prisma.fieldVisit.findMany({ where: { userId: req.user!.id }, orderBy: { startedAt: 'desc' }, take: 100, include: { _count: { select: { entries: true } } } });
  sendSuccess(res, visits.map(serializeVisit));
}));
router.post('/', handle(async (req, res) => {
  const input = z.object({ id: z.string().uuid(), apiaryId: z.string().uuid(), startedAt: z.string().datetime(), endedAt: z.string().datetime(), interrupted: z.boolean().default(false) }).refine(d => Date.parse(d.endedAt) >= Date.parse(d.startedAt), { message: 'Slutt må være etter start.' }).parse(req.body);
  const existing = await prisma.fieldVisit.findUnique({ where: { id: input.id } });
  if (existing) {
    if (existing.userId !== req.user!.id || existing.apiaryId !== input.apiaryId || existing.startedAt.toISOString() !== input.startedAt || existing.endedAt.toISOString() !== input.endedAt || existing.interrupted !== input.interrupted) throw new Error('Besøks-ID brukes allerede med andre opplysninger.');
    sendSuccess(res, serializeVisit(existing)); return;
  }
  const access = await prisma.userApiary.findUnique({ where: { userId_apiaryId: { userId: req.user!.id, apiaryId: input.apiaryId } }, include: { apiary: true } });
  if (!access || access.role === 'viewer') throw new Error('Ingen skrivetilgang til bigården.');
  const visit = await prisma.fieldVisit.create({ data: { ...input, userId: req.user!.id, apiaryName: access.apiary.name, startedAt: new Date(input.startedAt), endedAt: new Date(input.endedAt) } });
  sendSuccess(res, serializeVisit(visit), 201);
}));
router.get('/:id', handle(async (req, res) => {
  const visit = await ownVisit(req);
  const entries = await prisma.visitEntry.findMany({ where: { visitId: visit.id }, orderBy: { createdAt: 'asc' } });
  sendSuccess(res, serializeVisit({ ...visit, entries }));
}));

router.post('/:id/audio', handle(async (req, res) => {
  await ownVisit(req);
  await fs.mkdir(dir, { recursive: true });
  await new Promise<void>((resolve, reject) => upload.single('audio')(req, res, error => error ? reject(error) : resolve()));
  if (!req.file?.size) throw new Error('Lydfilen mangler eller er tom.');
  const temporary = req.file.path;
  try {
    const visit = await ownVisit(req);
    const bytes = await fs.readFile(temporary);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const final = path.join(dir, `${visit.id}.m4a`);
    // Flush before receipt. link creates the destination exclusively; concurrent retries cannot replace it.
    const file = await fs.open(temporary, 'r+');
    try { await file.sync(); } finally { await file.close(); }
    try { await fs.link(temporary, final); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const savedHash = createHash('sha256').update(await fs.readFile(final)).digest('hex');
    if (savedHash !== hash || (visit.audioHash && visit.audioHash !== hash)) throw new Error('Besøket har allerede en annen lydfil.');
    if (process.platform !== 'win32') { const directory = await fs.open(dir, 'r'); try { await directory.sync(); } finally { await directory.close(); } }
    await prisma.fieldVisit.updateMany({ where: { id: visit.id, status: 'awaiting_audio' }, data: { audioPath: final, audioHash: hash, audioBytes: bytes.length, status: 'queued' } });
    const saved = await prisma.fieldVisit.findUniqueOrThrow({ where: { id: visit.id } });
    sendSuccess(res, serializeVisit(saved));
  } finally { await fs.unlink(temporary).catch(() => undefined); }
}));
router.get('/:id/audio', handle(async (req, res) => {
  const visit = await ownVisit(req);
  if (!visit.audioPath) throw new Error('Opptaket er ikke mottatt.');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.type('audio/mp4').sendFile(path.resolve(visit.audioPath));
}));
router.post('/:id/retry', handle(async (req, res) => {
  const visit = await ownVisit(req);
  if (!visit.audioPath || visit.status !== 'failed') throw new Error('Besøket kan bare behandles på nytt etter en behandlingsfeil.');
  await prisma.fieldVisit.updateMany({ where: { id: visit.id, status: 'failed' }, data: { status: 'queued', lastError: null } });
  sendSuccess(res, { queued: true });
}));
router.put('/:id/review', handle(async (req, res) => {
  const visit = await ownVisit(req);
  const data = z.object({ version: z.number().int(), reviewed: z.boolean(), notes: z.string().max(20000).optional() }).parse(req.body);
  await prisma.$transaction(async tx => {
    const result = await tx.fieldVisit.updateMany({ where: { id: visit.id, version: data.version }, data: { reviewedAt: data.reviewed ? new Date() : null, reviewNotes: data.notes, version: { increment: 1 } } });
    if (!result.count) throw new Error('Besøket er endret. Last på nytt.');
    await tx.auditLog.create({ data: auditData({ userId: req.user!.id, entityType: 'FieldVisit', entityId: visit.id, action: 'review', before: visit, after: data }) });
  });
  sendSuccess(res, { saved: true });
}));
router.post('/:id/entries', handle(async (req, res) => {
  const visit = await ownVisit(req);
  const input = visitEntrySchema.parse(req.body);
  await validateHive(req.user!.id, input.hiveId);
  const entry = await prisma.visitEntry.create({ data: { ...input, sourceText: '', visitId: visit.id, origin: 'manual', payload: JSON.stringify(input.payload) } });
  sendSuccess(res, entry, 201);
}));
router.put('/:id/entries/:entryId', handle(async (req, res) => {
  await ownVisit(req);
  const data = visitEntrySchema.omit({ sourceText: true }).extend({ version: z.number().int(), state: z.enum(['pending', 'rejected', 'accepted']).default('pending') }).parse(req.body);
  await validateHive(req.user!.id, data.hiveId);
  await prisma.$transaction(async tx => {
    const before = await tx.visitEntry.findFirst({ where: { id: req.params.entryId, visitId: req.params.id } });
    if (!before || before.version !== data.version) throw new Error('Registreringen er endret. Last på nytt.');
    if (before.state === 'accepted') {
      if (data.state !== 'accepted' || data.kind !== before.kind || !data.hiveId || !before.entityId) throw new Error('Registrert type kan ikke endres. Rett opplysningene eller annuller i journalen.');
      if (before.kind === 'inspection') await correctVisitInspection(tx, req.user!.id, before.entityId, { ...data.payload, hiveId: data.hiveId });
      else if (before.kind === 'feeding') {
        const input = createFeedingSchema.parse({ ...data.payload, hiveId: data.hiveId });
        const oldFeeding = await tx.feeding.findUniqueOrThrow({ where: { id: before.entityId } });
        const feeding = await tx.feeding.update({ where: { id: before.entityId }, data: { ...input, feedingDate: new Date(input.feedingDate) } });
        await tx.auditLog.create({ data: auditData({ userId: req.user!.id, entityType: 'Feeding', entityId: feeding.id, action: 'correct', before: oldFeeding, after: feeding }) });
      } else {
        const task = z.object({ title: z.string().trim().min(1).max(200), notes: z.string().optional(), dueAt: z.string().datetime().nullish() }).parse(data.payload);
        await tx.calendarEvent.update({ where: { id: before.entityId }, data: { title: task.title, description: task.notes, hiveId: data.hiveId, ...(task.dueAt ? { eventDate: new Date(task.dueAt) } : {}) } });
      }
    } else if (data.state === 'accepted') throw new Error('Bruk godkjenning for å registrere et forslag.');
    const result = await tx.visitEntry.updateMany({ where: { id: before.id, version: data.version }, data: { kind: data.kind, hiveId: data.hiveId, state: data.state, payload: JSON.stringify(data.payload), origin: before.origin === 'manual' ? 'manual' : 'corrected', version: { increment: 1 } } });
    if (!result.count) throw new Error('Registreringen er endret. Last på nytt.');
    await tx.auditLog.create({ data: auditData({ userId: req.user!.id, entityType: 'VisitEntry', entityId: before.id, action: data.state === 'rejected' ? 'reject' : 'correct', before, after: data }) });
  });
  sendSuccess(res, { saved: true });
}));
router.post('/:id/entries/:entryId/accept', handle(async (req, res) => {
  await ownVisit(req);
  const { version } = z.object({ version: z.number().int() }).parse(req.body);
  sendSuccess(res, await acceptVisitEntry(req.user!.id, req.params.id, req.params.entryId, version));
}));
export default router;
