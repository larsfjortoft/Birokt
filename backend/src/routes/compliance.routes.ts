import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import prisma from '../utils/prisma.js';
import { apiaryAccess, hiveAccess } from '../services/accessService.js';
import { addCalendarYears, auditData } from '../services/complianceService.js';
import { calculatePagination, ErrorCodes, sendError, sendSuccess } from '../utils/response.js';
import { executeIdempotent } from '../services/idempotencyService.js';

const router = Router(); router.use(authenticate);
const eventTypes = ['mortality','disease_suspicion','biosecurity_measure','cleaning_disinfection','sample','analysis_result','animal_health_visit','official_control','authority_notification','other'] as const;
const fields = {
  apiaryId: z.string().uuid().nullable().optional(), hiveId: z.string().uuid().nullable().optional(), colonyNumber: z.number().int().min(1).max(2).nullable().optional(),
  eventType: z.enum(eventTypes), occurredAt: z.string().datetime({ offset: true }), title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(), mortalityCount: z.number().int().min(0).nullable().optional(),
  suspectedCause: z.string().trim().max(1000).nullable().optional(), diseaseName: z.string().trim().max(255).nullable().optional(),
  diagnosisStatus: z.enum(['suspected','confirmed','ruled_out','unknown']).nullable().optional(), sampleReference: z.string().trim().max(255).nullable().optional(),
  sampleTakenAt: z.string().datetime({ offset: true }).nullable().optional(), laboratoryName: z.string().trim().max(255).nullable().optional(),
  analysisType: z.string().trim().max(255).nullable().optional(), analysisResult: z.string().trim().max(5000).nullable().optional(),
  resultReceivedAt: z.string().datetime({ offset: true }).nullable().optional(), professionalName: z.string().trim().max(255).nullable().optional(),
  professionalContact: z.string().trim().max(255).nullable().optional(), authorityName: z.string().trim().max(255).nullable().optional(),
  authorityReference: z.string().trim().max(255).nullable().optional(), notificationRequired: z.boolean().nullable().optional(),
  notifiedAt: z.string().datetime({ offset: true }).nullable().optional(), followUpDueAt: z.string().datetime({ offset: true }).nullable().optional(),
};
const validateEvent = (data: any, ctx: z.RefinementCtx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (data.eventType === 'mortality' && (!data.hiveId || (data.mortalityCount === undefined && !data.description))) issue('mortalityCount', 'Mortality requires a hive and count or explanation');
  if (data.eventType === 'sample' && (!data.sampleReference || !data.sampleTakenAt || (!data.hiveId && !data.apiaryId))) issue('sampleReference', 'Sample requires reference, date and affected hive/apiary');
  if (data.eventType === 'analysis_result' && (!data.analysisType || !data.analysisResult || !data.resultReceivedAt || !data.sampleReference)) issue('analysisResult', 'Analysis result requires analysis, result, date and sample reference');
  if (data.eventType === 'animal_health_visit' && !data.professionalName) issue('professionalName', 'Animal health visit requires professional');
  if (data.eventType === 'official_control' && (!data.authorityName || !data.authorityReference)) issue('authorityReference', 'Official control requires authority and reference');
  if (data.eventType === 'authority_notification' && (!data.authorityName || !data.notifiedAt)) issue('notifiedAt', 'Authority notification requires authority and notification time');
  if (['biosecurity_measure','cleaning_disinfection'].includes(data.eventType) && !data.description) issue('description', 'Performed measure must be described');
};
const createSchema = z.object(fields).superRefine(validateEvent);
const updateSchema = z.object(fields).partial().extend({ baseVersion: z.number().int().positive(), reason: z.string().trim().min(1) });
const listSchema = z.object({ hiveId: z.string().uuid().optional(), apiaryId: z.string().uuid().optional(), eventType: z.enum(eventTypes).optional(),
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(), includeVoided: z.string().transform(v => v === 'true').optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'), perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20') });
const idSchema = z.object({ id: z.string().uuid() }); const voidSchema = z.object({ reason: z.string().trim().min(1).max(1000) });
const dates = ['occurredAt','sampleTakenAt','resultReceivedAt','notifiedAt','followUpDueAt'];
const mapData = (body: any) => Object.fromEntries(Object.entries(body).filter(([k]) => !['baseVersion','reason'].includes(k)).map(([k,v]) => [k, dates.includes(k) && v ? new Date(v as string) : v]));

async function ensureAccess(userId: string, body: any) {
  if (body.hiveId && !await hiveAccess(userId, body.hiveId)) return false;
  if (body.apiaryId && !await apiaryAccess(userId, body.apiaryId)) return false;
  return !!(body.hiveId || body.apiaryId);
}
router.get('/', validateQuery(listSchema), async (req, res) => {
  const { hiveId, apiaryId, eventType, from, to, includeVoided, page, perPage } = req.query as any; const userId = req.user!.id;
  const allowed = (await prisma.userApiary.findMany({ where: { userId }, select: { apiaryId: true } })).map(x => x.apiaryId);
  const where: any = { OR: [{ apiaryId: { in: allowed } }, { hive: { apiaryId: { in: allowed } } }], ...(hiveId && { hiveId }), ...(apiaryId && { apiaryId }),
    ...(eventType && { eventType }), ...(!includeVoided && { voidedAt: null }), ...(from && { occurredAt: { gte: new Date(from) } }), ...(to && { occurredAt: { lt: new Date(to) } }) };
  const [total, rows] = await Promise.all([prisma.complianceEvent.count({ where }), prisma.complianceEvent.findMany({ where, orderBy: { occurredAt: 'desc' }, skip: (page - 1) * perPage, take: perPage })]);
  sendSuccess(res, rows, 200, calculatePagination(page, perPage, total));
});
router.post('/', validateBody(createSchema), async (req, res) => {
  const userId = req.user!.id; if (!await ensureAccess(userId, req.body)) { sendError(res, ErrorCodes.FORBIDDEN, 'No access to affected hive/apiary', 403); return; }
  const row = await executeIdempotent(req,res,201,()=>prisma.$transaction(async tx => { const occurredAt = new Date(req.body.occurredAt); const created = await tx.complianceEvent.create({ data: { ...mapData(req.body), userId, retentionUntil: addCalendarYears(occurredAt) } as any }); await tx.auditLog.create({ data: auditData({ userId, entityType: 'ComplianceEvent', entityId: created.id, action: 'create', after: created, requestId: res.locals.requestId }) }); return created; })); if(row)sendSuccess(res, row, 201);
});
router.get('/:id', validateParams(idSchema), async (req, res) => {
  const row = await prisma.complianceEvent.findUnique({ where: { id: req.params.id } }); if (!row) { sendError(res, ErrorCodes.NOT_FOUND, 'Compliance event not found', 404); return; }
  if (!await ensureAccess(req.user!.id, row)) { sendError(res, ErrorCodes.FORBIDDEN, 'No access', 403); return; }
  const audit = await prisma.auditLog.findMany({ where: { entityType: 'ComplianceEvent', entityId: row.id }, orderBy: { occurredAt: 'asc' } }); sendSuccess(res, { ...row, audit });
});
router.put('/:id', validateParams(idSchema), validateBody(updateSchema), async (req, res) => {
  const userId = req.user!.id; try { const row = await prisma.$transaction(async tx => { const before = await tx.complianceEvent.findUnique({ where: { id: req.params.id } }); if (!before) throw Object.assign(new Error('Not found'), { status: 404 }); if (!await ensureAccess(userId, before)) throw Object.assign(new Error('No access'), { status: 403 }); if (before.version !== req.body.baseVersion) throw Object.assign(new Error('Version conflict'), { status: 409, code: ErrorCodes.VERSION_CONFLICT }); const merged = { ...before, ...req.body }; const parsed = createSchema.safeParse({ ...merged, occurredAt: new Date(merged.occurredAt).toISOString(), sampleTakenAt: merged.sampleTakenAt ? new Date(merged.sampleTakenAt).toISOString() : null, resultReceivedAt: merged.resultReceivedAt ? new Date(merged.resultReceivedAt).toISOString() : null, notifiedAt: merged.notifiedAt ? new Date(merged.notifiedAt).toISOString() : null, followUpDueAt: merged.followUpDueAt ? new Date(merged.followUpDueAt).toISOString() : null }); if (!parsed.success) throw Object.assign(new Error(parsed.error.issues[0].message), { status: 422 }); const updated = await tx.complianceEvent.update({ where: { id: before.id }, data: { ...mapData(req.body), version: { increment: 1 } } as any }); await tx.auditLog.create({ data: auditData({ userId, entityType: 'ComplianceEvent', entityId: before.id, action: 'update', before, after: updated, reason: req.body.reason, requestId: res.locals.requestId }) }); return updated; }); sendSuccess(res, row); } catch (e) { const x=e as any; sendError(res, x.code ?? ErrorCodes.VALIDATION_ERROR, x.message, x.status ?? 422); }
});
router.post('/:id/void', validateParams(idSchema), validateBody(voidSchema), async (req, res) => {
  const userId=req.user!.id; const before=await prisma.complianceEvent.findUnique({where:{id:req.params.id}}); if(!before){sendError(res,ErrorCodes.NOT_FOUND,'Compliance event not found',404);return;} if(!await ensureAccess(userId,before)){sendError(res,ErrorCodes.FORBIDDEN,'No access',403);return;} const row=await prisma.$transaction(async tx=>{const updated=await tx.complianceEvent.update({where:{id:before.id},data:{voidedAt:new Date(),voidReason:req.body.reason,voidedById:userId,version:{increment:1}}});await tx.auditLog.create({data:auditData({userId,entityType:'ComplianceEvent',entityId:before.id,action:'void',before,after:updated,reason:req.body.reason,requestId:res.locals.requestId})});return updated;});sendSuccess(res,row);
});
export default router;
