import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { auditData } from './complianceService.js';

// Omitted fields are not observations. Explicit false and zero remain valid findings.
export const createInspectionSchema = z.object({
  hiveId: z.string().uuid(),
  inspectionDate: z.string().datetime(),
  weather: z.object({ temperature: z.number().optional(), windSpeed: z.number().optional(), condition: z.string().trim().max(100).optional() }).optional(),
  assessment: z.object({
    strength: z.enum(['weak', 'medium', 'strong']).nullish(),
    temperament: z.enum(['calm', 'nervous', 'aggressive']).nullish(),
    queenSeen: z.boolean().nullish(), queenLaying: z.boolean().nullish(),
  }).optional(),
  frames: z.object({ brood: z.number().int().min(0).nullish(), honey: z.number().int().min(0).nullish(), pollen: z.number().int().min(0).nullish(), empty: z.number().int().min(0).nullish() }).optional(),
  health: z.object({
    status: z.enum(['healthy', 'warning', 'critical']).nullish(),
    varroaLevel: z.enum(['none', 'low', 'medium', 'high']).nullish(),
    diseases: z.array(z.string()).nullish(), pests: z.array(z.string()).nullish(),
  }).optional(),
  actions: z.array(z.object({ actionType: z.string().trim().min(1), details: z.record(z.unknown()).default({}) })).optional(),
  colonies: z.array(z.object({
    colonyNumber: z.number().int().min(1).max(2),
    strength: z.enum(['weak', 'medium', 'strong']).nullish(), temperament: z.enum(['calm', 'nervous', 'aggressive']).nullish(),
    queenSeen: z.boolean().nullish(), queenLaying: z.boolean().nullish(), needsFood: z.boolean().nullish(),
    healthStatus: z.enum(['healthy', 'warning', 'critical']).nullish(),
  })).max(2).optional(),
  notes: z.string().trim().optional(),
});

export async function createInspection(tx: Prisma.TransactionClient, userId: string, input: unknown, source?: { visitId: string; entryId: string }) {
  const data = createInspectionSchema.parse(input);
  const { hiveId, inspectionDate, weather, assessment, frames, health, actions, colonies, notes } = data;
  const hive = await tx.hive.findUnique({ where: { id: hiveId } });
  const access = hive && await tx.userApiary.findUnique({ where: { userId_apiaryId: { userId, apiaryId: hive.apiaryId } } });
  if (!access || access.role === 'viewer') throw new Error('Ingen skrivetilgang til kuben.');
  const primary = colonies?.find(c => c.colonyNumber === 1);
  const created = await tx.inspection.create({ data: {
    hiveId, userId, inspectionDate: new Date(inspectionDate),
    temperature: weather?.temperature, windSpeed: weather?.windSpeed, weatherCondition: weather?.condition,
    strength: primary?.strength ?? assessment?.strength, temperament: primary?.temperament ?? assessment?.temperament,
    queenSeen: primary?.queenSeen ?? assessment?.queenSeen ?? null, queenLaying: primary?.queenLaying ?? assessment?.queenLaying ?? null,
    broodFrames: frames?.brood ?? null, honeyFrames: frames?.honey ?? null, pollenFrames: frames?.pollen ?? null, emptyFrames: frames?.empty ?? null,
    healthStatus: primary?.healthStatus ?? health?.status ?? null, varroaLevel: health?.varroaLevel,
    diseases: JSON.stringify(health?.diseases ?? []), pests: JSON.stringify(health?.pests ?? []),
    metadata: JSON.stringify({ observationVersion: 1, diseasesObserved: health?.diseases != null, pestsObserved: health?.pests != null, ...(colonies?.length ? { colonies } : {}), ...(source ? { source } : {}) }),
    notes, actions: actions ? { create: actions.map(a => ({ actionType: a.actionType, details: JSON.stringify(a.details) })) } : undefined,
  }, include: { hive: { select: { id: true, hiveNumber: true } }, actions: true } });
  // Backdated inspections must not replace a more recent snapshot.
  const newer = await tx.inspection.findFirst({ where: { hiveId, inspectionDate: { gt: created.inspectionDate } }, select: { id: true } });
  if (!newer) await tx.hive.update({ where: { id: hiveId }, data: {
    ...(created.strength != null ? { strength: created.strength } : {}),
    ...(frames?.brood != null ? { currentBroodFrames: frames.brood } : {}),
    ...(frames?.honey != null ? { currentHoneyFrames: frames.honey } : {}),
  } });
  await tx.auditLog.create({ data: auditData({ userId, entityType: 'Inspection', entityId: created.id, action: 'create', after: created }) });
  return created;
}

export function observationQuality(metadata: string) {
  try { return JSON.parse(metadata).observationVersion === 1 ? 'explicit' : 'legacy_unverified'; }
  catch { return 'legacy_unverified'; }
}

export function observedList(value: string, metadata: string, key: 'diseases' | 'pests') {
  try {
    const meta = JSON.parse(metadata);
    return meta.observationVersion === 1 && !meta[`${key}Observed`] ? null : JSON.parse(value);
  } catch { return null; }
}

export async function correctVisitInspection(tx: Prisma.TransactionClient, userId: string, id: string, input: unknown) {
  const data = createInspectionSchema.parse(input);
  const before = await tx.inspection.findUniqueOrThrow({ where: { id } });
  const target = await tx.hive.findFirst({ where: { id: data.hiveId, apiary: { userApiaries: { some: { userId, role: { not: 'viewer' } } } } } });
  if (!target || before.voidedAt) throw new Error('Registreringen kan ikke rettes.');
  const metadata = JSON.parse(before.metadata);
  const colony = data.colonies?.find(c => c.colonyNumber === 1);
  const after = await tx.inspection.update({ where: { id }, data: {
    hiveId: data.hiveId, inspectionDate: new Date(data.inspectionDate),
    strength: colony?.strength ?? data.assessment?.strength ?? null,
    temperament: colony?.temperament ?? data.assessment?.temperament ?? null,
    queenSeen: colony?.queenSeen ?? data.assessment?.queenSeen ?? null,
    queenLaying: colony?.queenLaying ?? data.assessment?.queenLaying ?? null,
    broodFrames: data.frames?.brood ?? null, honeyFrames: data.frames?.honey ?? null,
    pollenFrames: data.frames?.pollen ?? null, emptyFrames: data.frames?.empty ?? null,
    healthStatus: colony?.healthStatus ?? data.health?.status ?? null, varroaLevel: data.health?.varroaLevel ?? null,
    diseases: JSON.stringify(data.health?.diseases ?? []), pests: JSON.stringify(data.health?.pests ?? []), notes: data.notes ?? null,
    metadata: JSON.stringify({ ...metadata, ...(data.colonies?.length ? { colonies: data.colonies } : { colonies: [] }), diseasesObserved: data.health?.diseases != null, pestsObserved: data.health?.pests != null }),
    version: { increment: 1 },
  } });
  await tx.auditLog.create({ data: auditData({ userId, entityType: 'Inspection', entityId: id, action: 'correct', before, after, reason: 'Rettet ved besøksgjennomgang på PC' }) });
  return after;
}
