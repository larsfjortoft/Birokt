import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import prisma from '../utils/prisma.js';
import { calculatePagination, ErrorCodes, sendError, sendSuccess } from '../utils/response.js';
import { addCalendarYears, auditData } from '../services/complianceService.js';
import { hiveAccess } from '../services/accessService.js';
import { executeIdempotent } from '../services/idempotencyService.js';

const router = Router();
router.use(authenticate);

const baseSchema = z.object({
  hiveId: z.string().uuid(), startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }).optional(), ongoing: z.boolean().default(false),
  productName: z.string().trim().min(1).max(255), productType: z.string().trim().max(100).optional(),
  target: z.string().trim().max(100).optional(), scope: z.enum(['whole_hive', 'colony']).default('whole_hive'),
  colonyNumber: z.number().int().min(1).max(2).optional(), dosage: z.string().trim().max(1000).optional(),
  administeredAmount: z.number().positive().finite(), administeredUnit: z.string().trim().min(1).max(50),
  medicineAcquisitionId: z.string().uuid().optional(), supplierName: z.string().trim().min(1).max(255),
  supplierAddress: z.string().trim().max(1000).optional(), acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  veterinarianName: z.string().trim().max(255).optional(), veterinarianContact: z.string().trim().max(255).optional(),
  prescriptionReference: z.string().trim().max(255).optional(), productBatchNumber: z.string().trim().max(255).optional(),
  withholdingPeriodDays: z.number().int().min(0), notes: z.string().trim().max(5000).optional(),
}).superRefine((data, ctx) => {
  if (!data.ongoing && !data.endDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date is required unless treatment is ongoing' });
  if (data.endDate && new Date(data.endDate) < new Date(data.startDate)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date cannot precede start date' });
  if (data.scope === 'colony' && data.colonyNumber === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['colonyNumber'], message: 'Colony number is required for colony scope' });
});
const batchSchema = z.object({ treatments: z.array(baseSchema).min(1).max(100) });
const updateSchema = z.object({
  baseVersion: z.number().int().positive(), reason: z.string().trim().min(1).max(1000),
  endDate: z.string().datetime({ offset: true }).nullable().optional(), ongoing: z.boolean().optional(),
  productName: z.string().trim().min(1).max(255).optional(), dosage: z.string().trim().max(1000).optional(),
  administeredAmount: z.number().positive().finite().optional(), administeredUnit: z.string().trim().min(1).max(50).optional(),
  withholdingPeriodDays: z.number().int().min(0).optional(), notes: z.string().trim().max(5000).nullable().optional(),
});
const voidSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
const idSchema = z.object({ id: z.string().uuid() });
const listSchema = z.object({
  hiveId: z.string().uuid().optional(), from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(),
  includeVoided: z.string().transform(v => v === 'true').optional(), page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

function withholdingEnd(start: Date, days: number) { const result = new Date(start); result.setUTCDate(result.getUTCDate() + days); return result; }
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createOne(tx: Tx, userId: string, body: z.infer<typeof baseSchema>, groupId: string | null, requestId?: string) {
  const access = await hiveAccess(userId, body.hiveId, tx);
  if (!access || access.access.role === 'viewer') throw Object.assign(new Error('No edit access to hive'), { status: 403, code: ErrorCodes.FORBIDDEN });
  if (body.scope === 'colony' && access.hive.hiveType === 'single_queen' && body.colonyNumber !== 1) {
    throw Object.assign(new Error('Single-queen hives only allow colony 1'), { status: 422, code: ErrorCodes.VALIDATION_ERROR });
  }
  if (body.medicineAcquisitionId && !await tx.medicineAcquisition.findFirst({ where: { id: body.medicineAcquisitionId, userId, voidedAt: null } })) {
    throw Object.assign(new Error('Medicine acquisition not found'), { status: 422, code: ErrorCodes.VALIDATION_ERROR });
  }
  const start = new Date(body.startDate); const end = body.endDate ? new Date(body.endDate) : null;
  const treatment = await tx.treatment.create({ data: {
    hiveId: body.hiveId, userId, treatmentDate: start, startDate: start, endDate: end, ongoing: body.ongoing,
    productName: body.productName, productType: body.productType, target: body.target, scope: body.scope,
    colonyNumber: body.scope === 'colony' ? body.colonyNumber : null, dosage: body.dosage,
    administeredAmount: body.administeredAmount, administeredUnit: body.administeredUnit,
    medicineAcquisitionId: body.medicineAcquisitionId, treatmentGroupId: groupId, supplierName: body.supplierName,
    supplierAddress: body.supplierAddress, acquisitionDate: new Date(`${body.acquisitionDate}T00:00:00.000Z`),
    veterinarianName: body.veterinarianName, veterinarianContact: body.veterinarianContact,
    prescriptionReference: body.prescriptionReference, productBatchNumber: body.productBatchNumber,
    withholdingPeriodDays: body.withholdingPeriodDays, withholdingEndDate: withholdingEnd(start, body.withholdingPeriodDays),
    retentionUntil: addCalendarYears(end ?? start), notes: body.notes, hiveNumberSnapshot: access.hive.hiveNumber,
    apiaryIdAtTreatment: access.hive.apiaryId, apiaryNameSnapshot: access.hive.apiary.name,
  }});
  await tx.auditLog.create({ data: auditData({ userId, entityType: 'Treatment', entityId: treatment.id, action: 'create', after: treatment, requestId }) });
  return treatment;
}

router.get('/', validateQuery(listSchema), async (req, res) => {
  const { hiveId, from, to, includeVoided, page, perPage } = req.query as any; const userId = req.user!.id;
  const apiaryIds = (await prisma.userApiary.findMany({ where: { userId }, select: { apiaryId: true } })).map(x => x.apiaryId);
  const where: any = { hive: { apiaryId: { in: apiaryIds } }, ...(hiveId && { hiveId }), ...(!includeVoided && { voidedAt: null }),
    ...(from && { startDate: { gte: new Date(from) } }), ...(to && { startDate: { lt: new Date(to) } }) };
  const [total, rows] = await Promise.all([prisma.treatment.count({ where }), prisma.treatment.findMany({ where,
    include: { hive: { select: { id: true, hiveNumber: true, apiary: { select: { name: true } } } }, medicineAcquisition: true },
    orderBy: { startDate: 'desc' }, skip: (page - 1) * perPage, take: perPage })]);
  sendSuccess(res, rows.map(row => ({ ...row, isActive: row.ongoing || (!!row.withholdingEndDate && row.withholdingEndDate >= new Date()) })), 200, calculatePagination(page, perPage, total));
});

router.post('/', validateBody(baseSchema), async (req, res) => {
  try { const row = await executeIdempotent(req,res,201,()=>prisma.$transaction(tx => createOne(tx, req.user!.id, req.body, null, res.locals.requestId))); if(row)sendSuccess(res, row, 201); }
  catch (e) { const x = e as any; sendError(res, x.code ?? ErrorCodes.INTERNAL_ERROR, x.message ?? 'Failed to create treatment', x.status ?? 500); }
});
router.post('/batch', validateBody(batchSchema), async (req, res) => {
  try {
    const groupId = randomUUID();
    const result = await executeIdempotent(req,res,201,async()=>{const rows = await prisma.$transaction(async tx => { const out = []; for (const item of req.body.treatments) out.push(await createOne(tx, req.user!.id, item, groupId, res.locals.requestId)); return out; });return { treatmentGroupId: groupId, treatments: rows };});
    if(result)sendSuccess(res,result,201);
  } catch (e) { const x = e as any; sendError(res, x.code ?? ErrorCodes.INTERNAL_ERROR, x.message ?? 'Failed to create treatments', x.status ?? 500); }
});

router.get('/:id', validateParams(idSchema), async (req, res) => {
  const row = await prisma.treatment.findUnique({ where: { id: req.params.id }, include: { hive: { include: { apiary: true } }, medicineAcquisition: true } });
  if (!row) { sendError(res, ErrorCodes.NOT_FOUND, 'Treatment not found', 404); return; }
  if (!await hiveAccess(req.user!.id, row.hiveId)) { sendError(res, ErrorCodes.FORBIDDEN, 'No access to treatment', 403); return; }
  const audit = await prisma.auditLog.findMany({ where: { entityType: 'Treatment', entityId: row.id }, orderBy: { occurredAt: 'asc' } });
  sendSuccess(res, { ...row, audit });
});

router.put('/:id', validateParams(idSchema), validateBody(updateSchema), async (req, res) => {
  try {
    const userId = req.user!.id; const row = await prisma.$transaction(async tx => {
      const before = await tx.treatment.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('Treatment not found'), { status: 404, code: ErrorCodes.NOT_FOUND });
      if (!await hiveAccess(userId, before.hiveId, tx)) throw Object.assign(new Error('No access'), { status: 403, code: ErrorCodes.FORBIDDEN });
      if (before.version !== req.body.baseVersion) throw Object.assign(new Error(`Version conflict: server=${before.version}, client=${req.body.baseVersion}`), { status: 409, code: ErrorCodes.VERSION_CONFLICT });
      const newEnd = req.body.endDate === undefined ? before.endDate : req.body.endDate ? new Date(req.body.endDate) : null;
      const candidate = addCalendarYears(newEnd ?? before.startDate);
      const retentionUntil = before.retentionUntil && before.retentionUntil > candidate ? before.retentionUntil : candidate;
      const updated = await tx.treatment.update({ where: { id: before.id }, data: {
        productName: req.body.productName, dosage: req.body.dosage, administeredAmount: req.body.administeredAmount,
        administeredUnit: req.body.administeredUnit, withholdingPeriodDays: req.body.withholdingPeriodDays,
        withholdingEndDate: req.body.withholdingPeriodDays === undefined ? undefined : withholdingEnd(before.startDate, req.body.withholdingPeriodDays),
        notes: req.body.notes, endDate: newEnd, ongoing: req.body.ongoing, retentionUntil, version: { increment: 1 },
      }});
      await tx.auditLog.create({ data: auditData({ userId, entityType: 'Treatment', entityId: before.id, action: 'update', before, after: updated, reason: req.body.reason, requestId: res.locals.requestId }) });
      return updated;
    }); sendSuccess(res, row);
  } catch (e) { const x = e as any; sendError(res, x.code ?? ErrorCodes.INTERNAL_ERROR, x.message ?? 'Update failed', x.status ?? 500); }
});

router.post('/:id/void', validateParams(idSchema), validateBody(voidSchema), async (req, res) => {
  try {
    const userId = req.user!.id; const row = await prisma.$transaction(async tx => {
      const before = await tx.treatment.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('Treatment not found'), { status: 404, code: ErrorCodes.NOT_FOUND });
      if (!await hiveAccess(userId, before.hiveId, tx)) throw Object.assign(new Error('No access'), { status: 403, code: ErrorCodes.FORBIDDEN });
      const updated = await tx.treatment.update({ where: { id: before.id }, data: { voidedAt: new Date(), voidReason: req.body.reason, voidedById: userId, version: { increment: 1 } } });
      await tx.auditLog.create({ data: auditData({ userId, entityType: 'Treatment', entityId: before.id, action: 'void', before, after: updated, reason: req.body.reason, requestId: res.locals.requestId }) });
      return updated;
    }); sendSuccess(res, row);
  } catch (e) { const x = e as any; sendError(res, x.code ?? ErrorCodes.INTERNAL_ERROR, x.message ?? 'Void failed', x.status ?? 500); }
});
router.delete('/:id', validateParams(idSchema), (_req, res) => sendError(res, ErrorCodes.RECORD_RETENTION_PROTECTED, 'Behandlingsjournalen kan ikke slettes. Bruk annullering med begrunnelse.', 409));

export default router;
