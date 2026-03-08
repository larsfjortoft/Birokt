import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

router.use(authenticate);

// Validation schemas
const createTreatmentSchema = z.object({
  hiveId: z.string().uuid(),
  treatmentDate: z.string(),
  productName: z.string().trim().min(1).max(255),
  productType: z.enum(['organic_acid', 'essential_oil', 'synthetic', 'biological', 'chemical', 'other']).optional(),
  target: z.enum(['varroa', 'nosema', 'foulbrood', 'wax_moth', 'other']).optional(),
  dosage: z.string().trim().max(255).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  withholdingPeriodDays: z.number().int().min(0).optional(),
  notes: z.string().trim().optional(),
});

const updateTreatmentSchema = z.object({
  productName: z.string().trim().min(1).max(255).optional(),
  productType: z.enum(['organic_acid', 'essential_oil', 'synthetic', 'biological', 'chemical', 'other']).optional(),
  target: z.enum(['varroa', 'nosema', 'foulbrood', 'wax_moth', 'other']).optional(),
  dosage: z.string().trim().max(255).optional(),
  endDate: z.string().optional(),
  notes: z.string().trim().optional(),
});

const listTreatmentsSchema = z.object({
  hiveId: z.string().uuid().optional(),
  activeOnly: z.string().transform(v => v === 'true').optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// Helper to check hive access
async function checkHiveAccess(userId: string, hiveId: string): Promise<boolean> {
  const hive = await prisma.hive.findUnique({
    where: { id: hiveId },
    select: { apiaryId: true },
  });
  if (!hive) return false;

  const userApiary = await prisma.userApiary.findUnique({
    where: { userId_apiaryId: { userId, apiaryId: hive.apiaryId } },
  });
  return !!userApiary;
}

// GET /treatments - List treatments
router.get('/', validateQuery(listTreatmentsSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hiveId, activeOnly, startDate, endDate, page, perPage } = req.query as unknown as {
      hiveId?: string;
      activeOnly?: boolean;
      startDate?: string;
      endDate?: string;
      page: number;
      perPage: number;
    };

    // Get user's hives
    const userApiaries = await prisma.userApiary.findMany({
      where: { userId },
      select: { apiaryId: true },
    });
    const apiaryIds = userApiaries.map(ua => ua.apiaryId);

    const userHives = await prisma.hive.findMany({
      where: { apiaryId: { in: apiaryIds } },
      select: { id: true },
    });
    const hiveIds = userHives.map(h => h.id);

    if (hiveId && !hiveIds.includes(hiveId)) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    const now = new Date();
    const where = {
      hiveId: hiveId ? hiveId : { in: hiveIds },
      ...(startDate && { treatmentDate: { gte: new Date(startDate) } }),
      ...(endDate && { treatmentDate: { lte: new Date(endDate) } }),
      ...(activeOnly && { withholdingEndDate: { gte: now } }),
    };

    const total = await prisma.treatment.count({ where });

    const treatments = await prisma.treatment.findMany({
      where,
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
            apiary: { select: { name: true } },
          },
        },
      },
      orderBy: { treatmentDate: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = treatments.map(t => ({
      id: t.id,
      hive: {
        id: t.hive.id,
        hiveNumber: t.hive.hiveNumber,
        apiaryName: t.hive.apiary.name,
      },
      treatmentDate: t.treatmentDate,
      productName: t.productName,
      productType: t.productType,
      target: t.target,
      dosage: t.dosage,
      startDate: t.startDate,
      endDate: t.endDate,
      withholdingPeriodDays: t.withholdingPeriodDays,
      withholdingEndDate: t.withholdingEndDate,
      isActive: t.withholdingEndDate ? t.withholdingEndDate >= now : false,
      notes: t.notes,
      createdAt: t.createdAt,
    }));

    sendSuccess(res, result, 200, calculatePagination(page, perPage, total));
  } catch (error) {
    console.error('List treatments error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list treatments', 500);
  }
});

// POST /treatments - Create treatment
router.post('/', validateBody(createTreatmentSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hiveId, treatmentDate, productName, productType, target, dosage, startDate, endDate, withholdingPeriodDays, notes } = req.body;

    const hasAccess = await checkHiveAccess(userId, hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    // Calculate withholding end date
    let withholdingEndDate: Date | null = null;
    if (withholdingPeriodDays && withholdingPeriodDays > 0) {
      withholdingEndDate = new Date(startDate);
      withholdingEndDate.setDate(withholdingEndDate.getDate() + withholdingPeriodDays);
    }

    const treatment = await prisma.treatment.create({
      data: {
        hiveId,
        userId,
        treatmentDate: new Date(treatmentDate),
        productName,
        productType,
        target,
        dosage,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        withholdingPeriodDays,
        withholdingEndDate,
        notes,
      },
    });

    sendSuccess(res, {
      id: treatment.id,
      treatmentDate: treatment.treatmentDate,
      productName: treatment.productName,
      withholdingEndDate: treatment.withholdingEndDate,
      createdAt: treatment.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create treatment error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create treatment', 500);
  }
});

// GET /treatments/:id - Get single treatment
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const treatment = await prisma.treatment.findUnique({
      where: { id },
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
            apiaryId: true,
            apiary: { select: { name: true } },
          },
        },
      },
    });

    if (!treatment) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Treatment not found', 404);
      return;
    }

    const hasAccess = await checkHiveAccess(userId, treatment.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this treatment', 403);
      return;
    }

    sendSuccess(res, {
      id: treatment.id,
      hive: {
        id: treatment.hive.id,
        hiveNumber: treatment.hive.hiveNumber,
        apiaryName: treatment.hive.apiary.name,
      },
      treatmentDate: treatment.treatmentDate,
      productName: treatment.productName,
      productType: treatment.productType,
      target: treatment.target,
      dosage: treatment.dosage,
      startDate: treatment.startDate,
      endDate: treatment.endDate,
      withholdingPeriodDays: treatment.withholdingPeriodDays,
      withholdingEndDate: treatment.withholdingEndDate,
      notes: treatment.notes,
      createdAt: treatment.createdAt,
    });
  } catch (error) {
    console.error('Get treatment error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get treatment', 500);
  }
});

// PUT /treatments/:id - Update treatment
router.put('/:id', validateParams(idParamSchema), validateBody(updateTreatmentSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { productName, productType, target, dosage, endDate, notes } = req.body;

    const existing = await prisma.treatment.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Treatment not found', 404);
      return;
    }

    const hasAccess = await checkHiveAccess(userId, existing.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this treatment', 403);
      return;
    }

    const treatment = await prisma.treatment.update({
      where: { id },
      data: {
        ...(productName && { productName }),
        ...(productType !== undefined && { productType }),
        ...(target !== undefined && { target }),
        ...(dosage !== undefined && { dosage }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    });

    sendSuccess(res, { id: treatment.id, updatedAt: treatment.updatedAt });
  } catch (error) {
    console.error('Update treatment error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update treatment', 500);
  }
});

// DELETE /treatments/:id
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const treatment = await prisma.treatment.findUnique({ where: { id } });
    if (!treatment) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Treatment not found', 404);
      return;
    }

    const hasAccess = await checkHiveAccess(userId, treatment.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this treatment', 403);
      return;
    }

    await prisma.treatment.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete treatment error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete treatment', 500);
  }
});

export default router;
