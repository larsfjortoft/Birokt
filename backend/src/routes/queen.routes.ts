import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

router.use(authenticate);

// Validation schemas
const createQueenSchema = z.object({
  queenCode: z.string().trim().min(1).max(50),
  year: z.number().int().min(2000).max(2100),
  race: z.string().trim().max(100).optional(),
  color: z.enum(['white', 'yellow', 'red', 'green', 'blue']).optional(),
  marked: z.boolean().optional(),
  clipped: z.boolean().optional(),
  origin: z.enum(['own_production', 'purchased', 'swarm', 'gifted', 'other']).optional(),
  status: z.enum(['virgin', 'mated', 'laying', 'failed', 'dead', 'sold', 'missing']).optional(),
  motherId: z.string().uuid().optional(),
  matingDate: z.string().optional(),
  matingStation: z.string().trim().max(255).optional(),
  currentHiveId: z.string().uuid().optional(),
  introducedDate: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  temperament: z.enum(['calm', 'nervous', 'aggressive']).optional(),
  productivity: z.enum(['low', 'medium', 'high']).optional(),
  swarmTendency: z.enum(['low', 'medium', 'high']).optional(),
  notes: z.string().trim().optional(),
});

const updateQueenSchema = z.object({
  queenCode: z.string().trim().min(1).max(50).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  race: z.string().trim().max(100).optional().nullable(),
  color: z.enum(['white', 'yellow', 'red', 'green', 'blue']).optional().nullable(),
  marked: z.boolean().optional(),
  clipped: z.boolean().optional(),
  origin: z.enum(['own_production', 'purchased', 'swarm', 'gifted', 'other']).optional(),
  status: z.enum(['virgin', 'mated', 'laying', 'failed', 'dead', 'sold', 'missing']).optional(),
  motherId: z.string().uuid().optional().nullable(),
  matingDate: z.string().optional().nullable(),
  matingStation: z.string().trim().max(255).optional().nullable(),
  currentHiveId: z.string().uuid().optional().nullable(),
  introducedDate: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  temperament: z.enum(['calm', 'nervous', 'aggressive']).optional().nullable(),
  productivity: z.enum(['low', 'medium', 'high']).optional().nullable(),
  swarmTendency: z.enum(['low', 'medium', 'high']).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const listQueensSchema = z.object({
  status: z.string().optional(),
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  race: z.string().optional(),
  hiveId: z.string().uuid().optional(),
  motherId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

const moveQueenSchema = z.object({
  hiveId: z.string().uuid(),
  date: z.string(),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
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

// GET /queens - List queens
router.get('/', validateQuery(listQueensSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, year, race, hiveId, motherId, search, page, perPage } = req.query as unknown as {
      status?: string;
      year?: number;
      race?: string;
      hiveId?: string;
      motherId?: string;
      search?: string;
      page: number;
      perPage: number;
    };

    const where: Record<string, unknown> = { userId };

    if (status) where.status = status;
    if (year) where.year = year;
    if (race) where.race = race;
    if (hiveId) where.currentHiveId = hiveId;
    if (motherId) where.motherId = motherId;
    if (search) {
      where.OR = [
        { queenCode: { contains: search } },
        { notes: { contains: search } },
        { race: { contains: search } },
      ];
    }

    const total = await prisma.queen.count({ where });

    const queens = await prisma.queen.findMany({
      where,
      include: {
        mother: { select: { id: true, queenCode: true } },
        currentHive: {
          select: {
            id: true,
            hiveNumber: true,
            apiary: { select: { name: true } },
          },
        },
        _count: { select: { daughters: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = queens.map(q => ({
      id: q.id,
      queenCode: q.queenCode,
      year: q.year,
      race: q.race,
      color: q.color,
      marked: q.marked,
      clipped: q.clipped,
      origin: q.origin,
      status: q.status,
      statusDate: q.statusDate,
      rating: q.rating,
      temperament: q.temperament,
      productivity: q.productivity,
      swarmTendency: q.swarmTendency,
      mother: q.mother ? { id: q.mother.id, queenCode: q.mother.queenCode } : null,
      currentHive: q.currentHive ? {
        id: q.currentHive.id,
        hiveNumber: q.currentHive.hiveNumber,
        apiaryName: q.currentHive.apiary.name,
      } : null,
      daughterCount: q._count.daughters,
      notes: q.notes,
      createdAt: q.createdAt,
    }));

    sendSuccess(res, result, 200, calculatePagination(page, perPage, total));
  } catch (error) {
    console.error('List queens error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list queens', 500);
  }
});

// POST /queens - Create queen
router.post('/', validateBody(createQueenSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      queenCode, year, race, color, marked, clipped, origin, status,
      motherId, matingDate, matingStation, currentHiveId, introducedDate,
      rating, temperament, productivity, swarmTendency, notes,
    } = req.body;

    // If assigning to a hive, check access
    if (currentHiveId) {
      const hasAccess = await checkHiveAccess(userId, currentHiveId);
      if (!hasAccess) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
        return;
      }
    }

    // If motherId provided, verify it belongs to user
    if (motherId) {
      const mother = await prisma.queen.findFirst({ where: { id: motherId, userId } });
      if (!mother) {
        sendError(res, ErrorCodes.NOT_FOUND, 'Mother queen not found', 404);
        return;
      }
    }

    const queen = await prisma.queen.create({
      data: {
        queenCode,
        year,
        race,
        color,
        marked: marked ?? false,
        clipped: clipped ?? false,
        origin: origin ?? 'own_production',
        status: status ?? 'virgin',
        motherId,
        matingDate: matingDate ? new Date(matingDate) : null,
        matingStation,
        currentHiveId,
        introducedDate: introducedDate ? new Date(introducedDate) : null,
        rating,
        temperament,
        productivity,
        swarmTendency,
        notes,
        userId,
      },
    });

    // If assigned to hive, create initial hive log
    if (currentHiveId) {
      await prisma.queenHiveLog.create({
        data: {
          queenId: queen.id,
          hiveId: currentHiveId,
          action: 'introduced',
          date: introducedDate ? new Date(introducedDate) : new Date(),
          reason: 'Initial placement',
          userId,
        },
      });
    }

    sendSuccess(res, {
      id: queen.id,
      queenCode: queen.queenCode,
      year: queen.year,
      status: queen.status,
      createdAt: queen.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create queen error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create queen', 500);
  }
});

// GET /queens/:id - Get queen details
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const queen = await prisma.queen.findFirst({
      where: { id, userId },
      include: {
        mother: { select: { id: true, queenCode: true, year: true, race: true, status: true } },
        daughters: {
          select: { id: true, queenCode: true, year: true, race: true, status: true },
          orderBy: { year: 'desc' },
        },
        currentHive: {
          select: {
            id: true,
            hiveNumber: true,
            apiary: { select: { id: true, name: true } },
          },
        },
        hiveHistory: {
          include: {
            hive: {
              select: {
                id: true,
                hiveNumber: true,
                apiary: { select: { name: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!queen) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Queen not found', 404);
      return;
    }

    sendSuccess(res, {
      id: queen.id,
      queenCode: queen.queenCode,
      year: queen.year,
      race: queen.race,
      color: queen.color,
      marked: queen.marked,
      clipped: queen.clipped,
      origin: queen.origin,
      status: queen.status,
      statusDate: queen.statusDate,
      motherId: queen.motherId,
      matingDate: queen.matingDate,
      matingStation: queen.matingStation,
      currentHiveId: queen.currentHiveId,
      introducedDate: queen.introducedDate,
      rating: queen.rating,
      temperament: queen.temperament,
      productivity: queen.productivity,
      swarmTendency: queen.swarmTendency,
      notes: queen.notes,
      createdAt: queen.createdAt,
      updatedAt: queen.updatedAt,
      mother: queen.mother ? {
        id: queen.mother.id,
        queenCode: queen.mother.queenCode,
        year: queen.mother.year,
        race: queen.mother.race,
        status: queen.mother.status,
      } : null,
      daughters: queen.daughters.map(d => ({
        id: d.id,
        queenCode: d.queenCode,
        year: d.year,
        race: d.race,
        status: d.status,
      })),
      currentHive: queen.currentHive ? {
        id: queen.currentHive.id,
        hiveNumber: queen.currentHive.hiveNumber,
        apiaryId: queen.currentHive.apiary.id,
        apiaryName: queen.currentHive.apiary.name,
      } : null,
      hiveHistory: queen.hiveHistory.map(h => ({
        id: h.id,
        hive: {
          id: h.hive.id,
          hiveNumber: h.hive.hiveNumber,
          apiaryName: h.hive.apiary.name,
        },
        action: h.action,
        date: h.date,
        reason: h.reason,
        notes: h.notes,
        createdAt: h.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get queen error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get queen', 500);
  }
});

// PUT /queens/:id - Update queen
router.put('/:id', validateParams(idParamSchema), validateBody(updateQueenSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await prisma.queen.findFirst({ where: { id, userId } });
    if (!existing) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Queen not found', 404);
      return;
    }

    const {
      queenCode, year, race, color, marked, clipped, origin, status,
      motherId, matingDate, matingStation, currentHiveId, introducedDate,
      rating, temperament, productivity, swarmTendency, notes,
    } = req.body;

    // Check hive access if changing hive
    if (currentHiveId !== undefined && currentHiveId !== null) {
      const hasAccess = await checkHiveAccess(userId, currentHiveId);
      if (!hasAccess) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (queenCode !== undefined) updateData.queenCode = queenCode;
    if (year !== undefined) updateData.year = year;
    if (race !== undefined) updateData.race = race;
    if (color !== undefined) updateData.color = color;
    if (marked !== undefined) updateData.marked = marked;
    if (clipped !== undefined) updateData.clipped = clipped;
    if (origin !== undefined) updateData.origin = origin;
    if (status !== undefined) {
      updateData.status = status;
      updateData.statusDate = new Date();
    }
    if (motherId !== undefined) updateData.motherId = motherId;
    if (matingDate !== undefined) updateData.matingDate = matingDate ? new Date(matingDate) : null;
    if (matingStation !== undefined) updateData.matingStation = matingStation;
    if (currentHiveId !== undefined) updateData.currentHiveId = currentHiveId;
    if (introducedDate !== undefined) updateData.introducedDate = introducedDate ? new Date(introducedDate) : null;
    if (rating !== undefined) updateData.rating = rating;
    if (temperament !== undefined) updateData.temperament = temperament;
    if (productivity !== undefined) updateData.productivity = productivity;
    if (swarmTendency !== undefined) updateData.swarmTendency = swarmTendency;
    if (notes !== undefined) updateData.notes = notes;

    const queen = await prisma.queen.update({
      where: { id },
      data: updateData,
    });

    sendSuccess(res, { id: queen.id, updatedAt: queen.updatedAt });
  } catch (error) {
    console.error('Update queen error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update queen', 500);
  }
});

// DELETE /queens/:id
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const queen = await prisma.queen.findFirst({ where: { id, userId } });
    if (!queen) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Queen not found', 404);
      return;
    }

    await prisma.queen.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete queen error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete queen', 500);
  }
});

// POST /queens/:id/move - Move queen to another hive
router.post('/:id/move', validateParams(idParamSchema), validateBody(moveQueenSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { hiveId, date, reason, notes } = req.body;

    const queen = await prisma.queen.findFirst({ where: { id, userId } });
    if (!queen) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Queen not found', 404);
      return;
    }

    // Check access to target hive
    const hasAccess = await checkHiveAccess(userId, hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    // If queen was in a previous hive, log removal
    if (queen.currentHiveId) {
      await prisma.queenHiveLog.create({
        data: {
          queenId: id,
          hiveId: queen.currentHiveId,
          action: 'removed',
          date: new Date(date),
          reason: reason || 'Moved to another hive',
          notes,
          userId,
        },
      });
    }

    // Log introduction to new hive
    await prisma.queenHiveLog.create({
      data: {
        queenId: id,
        hiveId,
        action: 'introduced',
        date: new Date(date),
        reason,
        notes,
        userId,
      },
    });

    // Update queen's current hive
    const updated = await prisma.queen.update({
      where: { id },
      data: {
        currentHiveId: hiveId,
        introducedDate: new Date(date),
      },
    });

    sendSuccess(res, {
      id: updated.id,
      currentHiveId: updated.currentHiveId,
      introducedDate: updated.introducedDate,
    });
  } catch (error) {
    console.error('Move queen error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to move queen', 500);
  }
});

export default router;
