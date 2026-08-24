import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import prisma from '../utils/prisma.js';
import { calculatePagination, ErrorCodes, sendError, sendSuccess } from '../utils/response.js';
import { auditData, stableRequestHash } from '../services/complianceService.js';
import { canEditApiary } from '../services/accessService.js';

const router = Router();
router.use(authenticate);

const movementType = z.enum(['initial', 'permanent', 'temporary', 'return', 'other', 'manual_backfill']);
const moveSchema = z.object({
  hiveId: z.string().uuid(),
  toApiaryId: z.string().uuid(),
  startedAt: z.string().datetime({ offset: true }),
  movementType,
  reason: z.string().trim().max(1000).optional(),
});
const batchMoveSchema = moveSchema.omit({ hiveId: true }).extend({
  hiveIds: z.array(z.string().uuid()).min(1).max(100).refine(v => new Set(v).size === v.length, 'Duplicate hive IDs'),
});
const correctionSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
  startedAt: z.string().datetime({ offset: true }).optional(),
  endedAt: z.string().datetime({ offset: true }).nullable().optional(),
  apiaryId: z.string().uuid().optional(),
  movementType: movementType.optional(),
});
const querySchema = z.object({
  hiveId: z.string().uuid().optional(), apiaryId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});
const idSchema = z.object({ id: z.string().uuid() });

class PlacementError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}

async function moveHives(req: Request, hiveIds: string[], input: z.infer<typeof batchMoveSchema>) {
  const userId = req.user!.id;
  const startedAt = new Date(input.startedAt);
  return prisma.$transaction(async tx => {
    if (!await canEditApiary(userId, input.toApiaryId, tx)) throw new PlacementError(ErrorCodes.FORBIDDEN, 'No edit access to target apiary', 403);
    const target = await tx.apiary.findUnique({ where: { id: input.toApiaryId } });
    if (!target) throw new PlacementError(ErrorCodes.NOT_FOUND, 'Target apiary not found', 404);
    const batchId = hiveIds.length > 1 ? randomUUID() : null;
    const results = [];
    for (const hiveId of hiveIds) {
      const hive = await tx.hive.findUnique({ where: { id: hiveId } });
      if (!hive) throw new PlacementError(ErrorCodes.NOT_FOUND, `Hive ${hiveId} not found`, 404);
      if (!await canEditApiary(userId, hive.apiaryId, tx)) throw new PlacementError(ErrorCodes.FORBIDDEN, `No edit access to hive ${hiveId}`, 403);
      const current = await tx.hivePlacement.findFirst({ where: { hiveId, endedAt: null, voidedAt: null } });
      if (current && startedAt < current.startedAt) throw new PlacementError(ErrorCodes.PLACEMENT_CONFLICT, `Movement predates current placement for hive ${hiveId}`);
      const overlap = await tx.hivePlacement.findFirst({ where: {
        hiveId, voidedAt: null, startedAt: { lt: startedAt },
        OR: [{ endedAt: null }, { endedAt: { gt: startedAt } }],
        ...(current ? { id: { not: current.id } } : {}),
      }});
      if (overlap) throw new PlacementError(ErrorCodes.PLACEMENT_CONFLICT, `Placement overlaps existing history for hive ${hiveId}`);
      const closed = current ? await tx.hivePlacement.update({ where: { id: current.id }, data: { endedAt: startedAt } }) : null;
      const placement = await tx.hivePlacement.create({ data: {
        hiveId, apiaryId: target.id, startedAt, movementType: input.movementType, reason: input.reason,
        apiaryName: target.name, locationName: target.locationName, locationLat: target.locationLat,
        locationLng: target.locationLng, createdById: userId, movementBatchId: batchId,
      }});
      const updatedHive = await tx.hive.update({ where: { id: hiveId }, data: { apiaryId: target.id } });
      await tx.auditLog.create({ data: auditData({ userId, entityType: 'HivePlacement', entityId: placement.id,
        action: 'create', before: closed, after: placement, reason: input.reason, requestId: req.res?.locals.requestId }) });
      results.push({ closedPlacement: closed, placement, currentApiaryId: updatedHive.apiaryId });
    }
    return results;
  });
}

async function withIdempotency(req: Request, res: Response, work: () => Promise<unknown>) {
  const key = req.header('Idempotency-Key');
  if (!key) { sendError(res, ErrorCodes.VALIDATION_ERROR, 'Idempotency-Key header is required', 400); return; }
  if (key.length > 255) { sendError(res, ErrorCodes.VALIDATION_ERROR, 'Idempotency-Key is too long', 400); return; }
  const userId = req.user!.id; const route = req.path; const requestHash = stableRequestHash(req.body);
  const existing = await prisma.idempotencyRequest.findUnique({ where: { userId_route_key: { userId, route, key } } });
  if (existing) {
    if (existing.requestHash !== requestHash) { sendError(res, ErrorCodes.IDEMPOTENCY_KEY_REUSED, 'Idempotency key was reused with a different request', 409); return; }
    if (existing.responseJson && existing.statusCode) { res.status(existing.statusCode).json(JSON.parse(existing.responseJson)); return; }
    sendError(res, 'REQUEST_IN_PROGRESS', 'The original request is still processing', 409); return;
  }
  await prisma.idempotencyRequest.create({ data: { userId, route, key, requestHash, expiresAt: new Date(Date.now() + 24 * 3600_000) } });
  try {
    const data = await work();
    const envelope = { success: true, data, meta: { timestamp: new Date().toISOString(), requestId: res.locals.requestId } };
    await prisma.idempotencyRequest.update({ where: { userId_route_key: { userId, route, key } }, data: { state: 'completed', statusCode: 201, responseJson: JSON.stringify(envelope) } });
    res.status(201).json(envelope);
  } catch (error) {
    await prisma.idempotencyRequest.delete({ where: { userId_route_key: { userId, route, key } } }).catch(() => undefined);
    throw error;
  }
}

router.get('/', validateQuery(querySchema), async (req, res) => {
  const userId = req.user!.id; const { hiveId, apiaryId, from, to, page, perPage } = req.query as any;
  const allowed = (await prisma.userApiary.findMany({ where: { userId }, select: { apiaryId: true } })).map(v => v.apiaryId);
  if (apiaryId && !allowed.includes(apiaryId)) { sendError(res, ErrorCodes.FORBIDDEN, 'No access to apiary', 403); return; }
  const where: any = { apiaryId: apiaryId ?? { in: allowed }, ...(hiveId && { hiveId }),
    ...(to && { startedAt: { lt: new Date(to) } }),
    ...(from && { OR: [{ endedAt: null }, { endedAt: { gt: new Date(from) } }] }),
  };
  const [total, rows] = await Promise.all([prisma.hivePlacement.count({ where }), prisma.hivePlacement.findMany({ where, orderBy: { startedAt: 'desc' }, skip: (page - 1) * perPage, take: perPage })]);
  sendSuccess(res, rows, 200, calculatePagination(page, perPage, total));
});

router.get('/:id', validateParams(idSchema), async (req, res) => {
  const row = await prisma.hivePlacement.findUnique({ where: { id: req.params.id } });
  if (!row) { sendError(res, ErrorCodes.NOT_FOUND, 'Placement not found', 404); return; }
  if (!await prisma.userApiary.findUnique({ where: { userId_apiaryId: { userId: req.user!.id, apiaryId: row.apiaryId } } })) { sendError(res, ErrorCodes.FORBIDDEN, 'No access to placement', 403); return; }
  sendSuccess(res, row);
});

router.post('/move', validateBody(moveSchema), async (req, res) => {
  try { await withIdempotency(req, res, async () => (await moveHives(req, [req.body.hiveId], { ...req.body, hiveIds: [req.body.hiveId] }))[0]); }
  catch (e) { const x = e as PlacementError; sendError(res, x.code || ErrorCodes.INTERNAL_ERROR, x.message || 'Movement failed', x.status || 500); }
});
router.post('/batch-move', validateBody(batchMoveSchema), async (req, res) => {
  try { await withIdempotency(req, res, () => moveHives(req, req.body.hiveIds, req.body)); }
  catch (e) { const x = e as PlacementError; sendError(res, x.code || ErrorCodes.INTERNAL_ERROR, x.message || 'Movement failed', x.status || 500); }
});

router.post('/:id/correct', validateParams(idSchema), validateBody(correctionSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await prisma.$transaction(async tx => {
      const original = await tx.hivePlacement.findUnique({ where: { id: req.params.id } });
      if (!original) throw new PlacementError(ErrorCodes.NOT_FOUND, 'Placement not found', 404);
      const apiaryId = req.body.apiaryId ?? original.apiaryId;
      if (!await canEditApiary(userId, apiaryId, tx)) throw new PlacementError(ErrorCodes.FORBIDDEN, 'No edit access', 403);
      const apiary = await tx.apiary.findUniqueOrThrow({ where: { id: apiaryId } });
      await tx.hivePlacement.update({ where: { id: original.id }, data: { voidedAt: new Date(), voidReason: req.body.reason } });
      const corrected = await tx.hivePlacement.create({ data: {
        hiveId: original.hiveId, apiaryId, startedAt: req.body.startedAt ? new Date(req.body.startedAt) : original.startedAt,
        endedAt: req.body.endedAt === undefined ? original.endedAt : req.body.endedAt ? new Date(req.body.endedAt) : null,
        movementType: req.body.movementType ?? original.movementType, reason: original.reason,
        apiaryName: apiary.name, locationName: apiary.locationName, locationLat: apiary.locationLat, locationLng: apiary.locationLng,
        createdById: userId, correctionOfId: original.id,
      }});
      await tx.auditLog.create({ data: auditData({ userId, entityType: 'HivePlacement', entityId: original.id, action: 'correct', before: original, after: corrected, reason: req.body.reason, requestId: res.locals.requestId }) });
      return corrected;
    });
    sendSuccess(res, result, 201);
  } catch (e) { const x = e as PlacementError; sendError(res, x.code || ErrorCodes.PLACEMENT_CONFLICT, x.message || 'Correction failed', x.status || 409); }
});

export default router;
