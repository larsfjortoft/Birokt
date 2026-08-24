import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import prisma from '../utils/prisma.js';
import { addCalendarYears, auditData } from '../services/complianceService.js';
import { calculatePagination, ErrorCodes, sendError, sendSuccess } from '../utils/response.js';

const router = Router(); router.use(authenticate);
const createSchema = z.object({
  productName: z.string().trim().min(1).max(255), acquiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplierName: z.string().trim().min(1).max(255), supplierAddress: z.string().trim().max(1000).optional(),
  acquiredAmount: z.number().positive().finite(), acquiredUnit: z.string().trim().min(1).max(50),
  acquisitionReference: z.string().trim().min(1).max(255),
});
const listSchema = z.object({ page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'), perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'), includeVoided: z.string().transform(v => v === 'true').optional() });
const idSchema = z.object({ id: z.string().uuid() }); const voidSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

router.post('/', validateBody(createSchema), async (req, res) => {
  const userId = req.user!.id; const acquiredOn = new Date(`${req.body.acquiredOn}T00:00:00.000Z`);
  const row = await prisma.$transaction(async tx => {
    const created = await tx.medicineAcquisition.create({ data: { ...req.body, userId, acquiredOn, retentionUntil: addCalendarYears(acquiredOn) } });
    await tx.auditLog.create({ data: auditData({ userId, entityType: 'MedicineAcquisition', entityId: created.id, action: 'create', after: created, requestId: res.locals.requestId }) });
    return created;
  }); sendSuccess(res, row, 201);
});
router.get('/', validateQuery(listSchema), async (req, res) => {
  const { page, perPage, includeVoided } = req.query as any; const where = { userId: req.user!.id, ...(!includeVoided && { voidedAt: null }) };
  const [total, rows] = await Promise.all([prisma.medicineAcquisition.count({ where }), prisma.medicineAcquisition.findMany({ where, orderBy: { acquiredOn: 'desc' }, skip: (page - 1) * perPage, take: perPage })]);
  sendSuccess(res, rows, 200, calculatePagination(page, perPage, total));
});
router.get('/:id', validateParams(idSchema), async (req, res) => {
  const row = await prisma.medicineAcquisition.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { treatments: true } });
  if (!row) { sendError(res, ErrorCodes.NOT_FOUND, 'Medicine acquisition not found', 404); return; } sendSuccess(res, row);
});
router.post('/:id/void', validateParams(idSchema), validateBody(voidSchema), async (req, res) => {
  const userId = req.user!.id;
  const row = await prisma.$transaction(async tx => {
    const before = await tx.medicineAcquisition.findFirst({ where: { id: req.params.id, userId } });
    if (!before) return null;
    const updated = await tx.medicineAcquisition.update({ where: { id: before.id }, data: { voidedAt: new Date(), voidReason: req.body.reason, voidedById: userId } });
    await tx.auditLog.create({ data: auditData({ userId, entityType: 'MedicineAcquisition', entityId: before.id, action: 'void', before, after: updated, reason: req.body.reason, requestId: res.locals.requestId }) }); return updated;
  });
  if (!row) { sendError(res, ErrorCodes.NOT_FOUND, 'Medicine acquisition not found', 404); return; } sendSuccess(res, row);
});
export default router;
