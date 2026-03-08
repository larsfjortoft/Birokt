import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

router.use(authenticate);

// Validation schemas
const createFeedingSchema = z.object({
  hiveId: z.string().uuid(),
  feedingDate: z.string(),
  feedType: z.enum(['sugar_syrup', 'sugar_dough', 'fondant', 'ready_feed', 'pollen_patty', 'pollen_substitute', 'honey', 'other']),
  amountKg: z.number().positive().max(100),
  sugarConcentration: z.number().min(0).max(100).optional(),
  reason: z.enum(['spring_buildup', 'spring_stimulation', 'winter_prep', 'emergency', 'nuc_support', 'stimulation', 'other']).optional(),
  notes: z.string().trim().optional(),
});

const updateFeedingSchema = z.object({
  feedType: z.enum(['sugar_syrup', 'sugar_dough', 'fondant', 'ready_feed', 'pollen_patty', 'pollen_substitute', 'honey', 'other']).optional(),
  amountKg: z.number().positive().max(100).optional(),
  sugarConcentration: z.number().min(0).max(100).optional(),
  reason: z.enum(['spring_buildup', 'spring_stimulation', 'winter_prep', 'emergency', 'nuc_support', 'stimulation', 'other']).optional(),
  notes: z.string().trim().optional(),
});

const listFeedingsSchema = z.object({
  hiveId: z.string().uuid().optional(),
  feedType: z.enum(['sugar_syrup', 'sugar_dough', 'fondant', 'ready_feed', 'pollen_patty', 'pollen_substitute', 'honey', 'other']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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

// GET /feedings - List feedings
router.get('/', validateQuery(listFeedingsSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hiveId, feedType, startDate, endDate, page, perPage } = req.query as unknown as {
      hiveId?: string;
      feedType?: string;
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

    const where = {
      hiveId: hiveId ? hiveId : { in: hiveIds },
      ...(feedType && { feedType }),
      ...(startDate && { feedingDate: { gte: new Date(startDate) } }),
      ...(endDate && { feedingDate: { lte: new Date(endDate) } }),
    };

    const total = await prisma.feeding.count({ where });

    const feedings = await prisma.feeding.findMany({
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
      orderBy: { feedingDate: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = feedings.map(f => ({
      id: f.id,
      hive: {
        id: f.hive.id,
        hiveNumber: f.hive.hiveNumber,
        apiaryName: f.hive.apiary.name,
      },
      feedingDate: f.feedingDate,
      feedType: f.feedType,
      amountKg: f.amountKg,
      sugarConcentration: f.sugarConcentration,
      reason: f.reason,
      notes: f.notes,
      createdAt: f.createdAt,
    }));

    sendSuccess(res, result, 200, calculatePagination(page, perPage, total));
  } catch (error) {
    console.error('List feedings error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list feedings', 500);
  }
});

// POST /feedings - Create feeding
router.post('/', validateBody(createFeedingSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hiveId, feedingDate, feedType, amountKg, sugarConcentration, reason, notes } = req.body;

    const hasAccess = await checkHiveAccess(userId, hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    const feeding = await prisma.feeding.create({
      data: {
        hiveId,
        userId,
        feedingDate: new Date(feedingDate),
        feedType,
        amountKg,
        sugarConcentration,
        reason,
        notes,
      },
    });

    sendSuccess(res, {
      id: feeding.id,
      feedingDate: feeding.feedingDate,
      feedType: feeding.feedType,
      amountKg: feeding.amountKg,
      createdAt: feeding.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create feeding error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create feeding', 500);
  }
});

// GET /feedings/:id - Get single feeding
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const feeding = await prisma.feeding.findUnique({
      where: { id },
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
            apiary: { select: { name: true } },
          },
        },
      },
    });

    if (!feeding) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Feeding not found', 404);
      return;
    }

    const hasAccess = await checkHiveAccess(userId, feeding.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this feeding', 403);
      return;
    }

    sendSuccess(res, {
      id: feeding.id,
      hive: {
        id: feeding.hive.id,
        hiveNumber: feeding.hive.hiveNumber,
        apiaryName: feeding.hive.apiary.name,
      },
      feedingDate: feeding.feedingDate,
      feedType: feeding.feedType,
      amountKg: feeding.amountKg,
      sugarConcentration: feeding.sugarConcentration,
      reason: feeding.reason,
      notes: feeding.notes,
      createdAt: feeding.createdAt,
    });
  } catch (error) {
    console.error('Get feeding error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get feeding', 500);
  }
});

// PUT /feedings/:id - Update feeding
router.put('/:id', validateParams(idParamSchema), validateBody(updateFeedingSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { feedType, amountKg, sugarConcentration, reason, notes } = req.body;

    const existing = await prisma.feeding.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Feeding not found', 404);
      return;
    }

    const hasAccess = await checkHiveAccess(userId, existing.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this feeding', 403);
      return;
    }

    const feeding = await prisma.feeding.update({
      where: { id },
      data: {
        ...(feedType && { feedType }),
        ...(amountKg !== undefined && { amountKg }),
        ...(sugarConcentration !== undefined && { sugarConcentration }),
        ...(reason !== undefined && { reason }),
        ...(notes !== undefined && { notes }),
      },
    });

    sendSuccess(res, { id: feeding.id, updatedAt: feeding.updatedAt });
  } catch (error) {
    console.error('Update feeding error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update feeding', 500);
  }
});

// DELETE /feedings/:id
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const feeding = await prisma.feeding.findUnique({ where: { id } });
    if (!feeding) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Feeding not found', 404);
      return;
    }

    const hasAccess = await checkHiveAccess(userId, feeding.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this feeding', 403);
      return;
    }

    await prisma.feeding.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete feeding error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete feeding', 500);
  }
});

export default router;
