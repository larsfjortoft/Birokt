import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

router.use(authenticate);

// Validation schemas
const createProductionSchema = z.object({
  hiveId: z.string().uuid().optional(),
  apiaryId: z.string().uuid().optional(),
  harvestDate: z.string(),
  productType: z.enum(['honey', 'wax', 'propolis', 'pollen', 'royal_jelly']),
  honeyType: z.string().trim().max(100).optional(),
  amountKg: z.number().positive(),
  qualityGrade: z.enum(['A', 'B', 'C', 'premium', 'standard', 'bulk']).optional(),
  moistureContent: z.number().min(0).max(100).optional(),
  pricePerKg: z.number().positive().optional(),
  soldTo: z.string().trim().max(255).optional(),
  saleDate: z.string().optional(),
  notes: z.string().trim().optional(),
});

const updateProductionSchema = z.object({
  productType: z.enum(['honey', 'wax', 'propolis', 'pollen', 'royal_jelly']).optional(),
  honeyType: z.string().trim().max(100).optional(),
  amountKg: z.number().positive().optional(),
  qualityGrade: z.enum(['A', 'B', 'C', 'premium', 'standard', 'bulk']).optional(),
  moistureContent: z.number().min(0).max(100).optional(),
  pricePerKg: z.number().positive().optional(),
  soldTo: z.string().trim().max(255).optional(),
  saleDate: z.string().optional(),
  notes: z.string().trim().optional(),
});

const listProductionSchema = z.object({
  hiveId: z.string().uuid().optional(),
  apiaryId: z.string().uuid().optional(),
  productType: z.enum(['honey', 'wax', 'propolis', 'pollen', 'royal_jelly']).optional(),
  year: z.string().transform(Number).pipe(z.number().int().min(2000).max(2100)).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// Helper to check access
async function checkAccess(userId: string, hiveId?: string | null, apiaryId?: string | null): Promise<boolean> {
  if (hiveId) {
    const hive = await prisma.hive.findUnique({
      where: { id: hiveId },
      select: { apiaryId: true },
    });
    if (!hive) return false;
    apiaryId = hive.apiaryId;
  }

  if (apiaryId) {
    const userApiary = await prisma.userApiary.findUnique({
      where: { userId_apiaryId: { userId, apiaryId } },
    });
    return !!userApiary;
  }

  return false;
}

// GET /production - List production records
router.get('/', validateQuery(listProductionSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hiveId, apiaryId, productType, year, startDate, endDate, page, perPage } = req.query as unknown as {
      hiveId?: string;
      apiaryId?: string;
      productType?: string;
      year?: number;
      startDate?: string;
      endDate?: string;
      page: number;
      perPage: number;
    };

    // Get user's apiaries
    const userApiaries = await prisma.userApiary.findMany({
      where: { userId },
      select: { apiaryId: true },
    });
    const apiaryIds = userApiaries.map(ua => ua.apiaryId);

    if (apiaryId && !apiaryIds.includes(apiaryId)) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this apiary', 403);
      return;
    }

    if (hiveId) {
      const hive = await prisma.hive.findFirst({
        where: { id: hiveId, apiaryId: { in: apiaryIds } },
        select: { id: true },
      });
      if (!hive) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
        return;
      }
    }

    // Build date filter
    let dateFilter: { gte?: Date; lte?: Date } = {};
    if (year) {
      dateFilter = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      };
    } else {
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
    }

    const where = {
      userId,
      ...(hiveId && { hiveId }),
      ...(apiaryId ? { apiaryId } : { apiaryId: { in: apiaryIds } }),
      ...(productType && { productType }),
      ...(Object.keys(dateFilter).length > 0 && { harvestDate: dateFilter }),
    };

    const total = await prisma.production.count({ where });

    const productions = await prisma.production.findMany({
      where,
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
          },
        },
        apiary: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { harvestDate: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Calculate summary
    const summary = await prisma.production.aggregate({
      where,
      _sum: {
        amountKg: true,
        totalRevenue: true,
      },
    });

    const result = productions.map(p => ({
      id: p.id,
      hive: p.hive ? {
        id: p.hive.id,
        hiveNumber: p.hive.hiveNumber,
      } : null,
      apiary: p.apiary ? {
        id: p.apiary.id,
        name: p.apiary.name,
      } : null,
      harvestDate: p.harvestDate,
      productType: p.productType,
      honeyType: p.honeyType,
      amountKg: p.amountKg,
      qualityGrade: p.qualityGrade,
      moistureContent: p.moistureContent,
      pricePerKg: p.pricePerKg,
      totalRevenue: p.totalRevenue,
      soldTo: p.soldTo,
      saleDate: p.saleDate,
      notes: p.notes,
      createdAt: p.createdAt,
    }));

    sendSuccess(res, result, 200, {
      ...calculatePagination(page, perPage, total),
      summary: {
        totalAmountKg: summary._sum.amountKg || 0,
        totalRevenue: summary._sum.totalRevenue || 0,
      },
    } as any);
  } catch (error) {
    console.error('List production error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list production', 500);
  }
});

// POST /production - Create production record
router.post('/', validateBody(createProductionSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    let {
      hiveId, apiaryId, harvestDate, productType, honeyType, amountKg,
      qualityGrade, moistureContent, pricePerKg, soldTo, saleDate, notes
    } = req.body;

    if (!hiveId && !apiaryId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Either hiveId or apiaryId is required', 400);
      return;
    }

    // If hiveId is provided, get the apiaryId from the hive
    if (hiveId && !apiaryId) {
      const hive = await prisma.hive.findUnique({
        where: { id: hiveId },
        select: { apiaryId: true },
      });
      if (hive) {
        apiaryId = hive.apiaryId;
      }
    }

    const hasAccess = await checkAccess(userId, hiveId, apiaryId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access', 403);
      return;
    }

    // Calculate total revenue
    const totalRevenue = pricePerKg ? pricePerKg * amountKg : null;

    const production = await prisma.production.create({
      data: {
        hiveId,
        apiaryId,
        userId,
        harvestDate: new Date(harvestDate),
        productType,
        honeyType,
        amountKg,
        qualityGrade,
        moistureContent,
        pricePerKg,
        totalRevenue,
        soldTo,
        saleDate: saleDate ? new Date(saleDate) : null,
        notes,
      },
    });

    sendSuccess(res, {
      id: production.id,
      harvestDate: production.harvestDate,
      productType: production.productType,
      amountKg: production.amountKg,
      totalRevenue: production.totalRevenue,
      createdAt: production.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create production error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create production', 500);
  }
});

// GET /production/:id - Get single production
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
            apiary: { select: { name: true } },
          },
        },
        apiary: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!production) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Production not found', 404);
      return;
    }

    if (production.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this production', 403);
      return;
    }

    sendSuccess(res, {
      id: production.id,
      hive: production.hive ? {
        id: production.hive.id,
        hiveNumber: production.hive.hiveNumber,
        apiaryName: production.hive.apiary.name,
      } : null,
      apiary: production.apiary,
      harvestDate: production.harvestDate,
      productType: production.productType,
      honeyType: production.honeyType,
      amountKg: production.amountKg,
      qualityGrade: production.qualityGrade,
      moistureContent: production.moistureContent,
      pricePerKg: production.pricePerKg,
      totalRevenue: production.totalRevenue,
      soldTo: production.soldTo,
      saleDate: production.saleDate,
      notes: production.notes,
      createdAt: production.createdAt,
    });
  } catch (error) {
    console.error('Get production error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get production', 500);
  }
});

// PUT /production/:id - Update production
router.put('/:id', validateParams(idParamSchema), validateBody(updateProductionSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const updates = req.body;

    const existing = await prisma.production.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Production not found', 404);
      return;
    }

    if (existing.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this production', 403);
      return;
    }

    // Recalculate total revenue if price or amount changed
    let totalRevenue = existing.totalRevenue;
    const newAmount = updates.amountKg ?? existing.amountKg;
    const newPrice = updates.pricePerKg ?? existing.pricePerKg;
    if (newPrice) {
      totalRevenue = newPrice * newAmount;
    }

    const production = await prisma.production.update({
      where: { id },
      data: {
        ...updates,
        ...(updates.saleDate && { saleDate: new Date(updates.saleDate) }),
        totalRevenue,
      },
    });

    sendSuccess(res, { id: production.id, updatedAt: production.updatedAt });
  } catch (error) {
    console.error('Update production error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update production', 500);
  }
});

// DELETE /production/:id
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const production = await prisma.production.findUnique({ where: { id } });
    if (!production) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Production not found', 404);
      return;
    }

    if (production.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this production', 403);
      return;
    }

    await prisma.production.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete production error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete production', 500);
  }
});

export default router;
