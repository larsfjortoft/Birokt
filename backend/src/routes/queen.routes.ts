import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

router.use(authenticate);

const queenStatusSchema = z.enum(['virgin', 'mated', 'laying', 'failed', 'dead', 'sold', 'missing']);
const colonyNumberSchema = z.number().int().min(1).max(2);
const replacementActionSchema = z.enum(['remove', 'dead']);

const createQueenSchema = z.object({
  queenCode: z.string().trim().min(1).max(50),
  year: z.number().int().min(2000).max(2100),
  race: z.string().trim().max(100).optional(),
  color: z.enum(['white', 'yellow', 'red', 'green', 'blue']).optional(),
  marked: z.boolean().optional(),
  clipped: z.boolean().optional(),
  origin: z.enum(['own_production', 'purchased', 'swarm', 'gifted', 'other']).optional(),
  status: queenStatusSchema.optional(),
  motherId: z.string().uuid().optional(),
  matingDate: z.string().optional(),
  matingStation: z.string().trim().max(255).optional(),
  currentHiveId: z.string().uuid().optional(),
  currentColonyNumber: colonyNumberSchema.optional(),
  replaceExisting: z.boolean().optional(),
  replacementAction: replacementActionSchema.optional(),
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
  status: queenStatusSchema.optional(),
  motherId: z.string().uuid().optional().nullable(),
  matingDate: z.string().optional().nullable(),
  matingStation: z.string().trim().max(255).optional().nullable(),
  currentHiveId: z.string().uuid().optional().nullable(),
  currentColonyNumber: colonyNumberSchema.optional().nullable(),
  replaceExisting: z.boolean().optional(),
  replacementAction: replacementActionSchema.optional(),
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
  currentColonyNumber: colonyNumberSchema.optional(),
  replaceExisting: z.boolean().optional(),
  replacementAction: replacementActionSchema.optional(),
  date: z.string(),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

type RouteError = Error & {
  code: string;
  statusCode: number;
};

type HivePlacement = {
  hiveId: string;
  hiveNumber: string;
  hiveType: 'single_queen' | 'double_queen';
  colonyNumber: number;
};

type PlacementOptions = {
  date: Date;
  reason?: string;
  notes?: string;
  replaceExisting?: boolean;
  replacementAction?: 'remove' | 'dead';
};

type PlacementConflictQueen = {
  id: string;
  queenCode: string;
  currentColonyNumber: number | null;
};

function routeError(code: string, message: string, statusCode: number): RouteError {
  const error = new Error(message) as RouteError;
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function isRouteError(error: unknown): error is RouteError {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && 'statusCode' in error;
}

function formatColonyLabel(colonyNumber: number): string {
  return `bifolk ${colonyNumber}`;
}

async function getAccessibleHivePlacement(
  userId: string,
  hiveId: string,
  requestedColonyNumber?: number | null,
): Promise<HivePlacement> {
  const hive = await prisma.hive.findUnique({
    where: { id: hiveId },
    select: {
      id: true,
      hiveNumber: true,
      hiveType: true,
      apiaryId: true,
    },
  });

  if (!hive) {
    throw routeError(ErrorCodes.NOT_FOUND, 'Hive not found', 404);
  }

  const userApiary = await prisma.userApiary.findUnique({
    where: { userId_apiaryId: { userId, apiaryId: hive.apiaryId } },
  });

  if (!userApiary) {
    throw routeError(ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
  }

  const hiveType = hive.hiveType === 'double_queen' ? 'double_queen' : 'single_queen';

  if (hiveType === 'double_queen') {
    if (!requestedColonyNumber) {
      throw routeError(
        ErrorCodes.VALIDATION_ERROR,
        `Double-queen hive ${hive.hiveNumber} requires currentColonyNumber (1 or 2)`,
        400,
      );
    }
  } else if (requestedColonyNumber && requestedColonyNumber !== 1) {
    throw routeError(
      ErrorCodes.VALIDATION_ERROR,
      `Single-queen hive ${hive.hiveNumber} only supports currentColonyNumber 1`,
      400,
    );
  }

  return {
    hiveId: hive.id,
    hiveNumber: hive.hiveNumber,
    hiveType,
    colonyNumber: hiveType === 'double_queen' ? requestedColonyNumber! : 1,
  };
}

async function findPlacementConflicts(
  tx: Prisma.TransactionClient,
  userId: string,
  placement: HivePlacement,
  excludeQueenId?: string,
): Promise<PlacementConflictQueen[]> {
  const where: Prisma.QueenWhereInput = placement.hiveType === 'double_queen'
    ? {
        userId,
        currentHiveId: placement.hiveId,
        id: excludeQueenId ? { not: excludeQueenId } : undefined,
        OR: [
          { currentColonyNumber: placement.colonyNumber },
          { currentColonyNumber: null },
        ],
      }
    : {
        userId,
        currentHiveId: placement.hiveId,
        id: excludeQueenId ? { not: excludeQueenId } : undefined,
      };

  return tx.queen.findMany({
    where,
    select: {
      id: true,
      queenCode: true,
      currentColonyNumber: true,
    },
  });
}

async function handlePlacementConflict(
  tx: Prisma.TransactionClient,
  userId: string,
  occupyingQueen: PlacementConflictQueen,
  placement: HivePlacement,
  incomingQueenCode: string,
  options: PlacementOptions,
): Promise<void> {
  if (!options.replaceExisting || !options.replacementAction) {
    const colonyDescription = placement.hiveType === 'double_queen'
      ? ` ${formatColonyLabel(placement.colonyNumber)}`
      : '';
    throw routeError(
      ErrorCodes.DUPLICATE_ENTRY,
      `Hive ${placement.hiveNumber}${colonyDescription} already has queen ${occupyingQueen.queenCode}. Set replaceExisting and replacementAction to replace her.`,
      409,
    );
  }

  const replacementNote = options.notes
    ? `${options.notes} Replaced by ${incomingQueenCode}.`
    : `Replaced by ${incomingQueenCode}.`;

  await tx.queenHiveLog.create({
    data: {
      queenId: occupyingQueen.id,
      hiveId: placement.hiveId,
      colonyNumber: placement.colonyNumber,
      action: 'removed',
      date: options.date,
      reason: options.replacementAction === 'dead'
        ? `Replaced and marked dead by ${incomingQueenCode}`
        : `Replaced and taken out by ${incomingQueenCode}`,
      notes: replacementNote,
      userId,
    },
  });

  await tx.queen.update({
    where: { id: occupyingQueen.id },
    data: {
      currentHiveId: null,
      currentColonyNumber: null,
      ...(options.replacementAction === 'dead'
        ? { status: 'dead', statusDate: options.date }
        : {}),
    },
  });
}

async function assignQueenToPlacement(
  tx: Prisma.TransactionClient,
  userId: string,
  queen: { id: string; queenCode: string; currentHiveId: string | null; currentColonyNumber: number | null },
  placement: HivePlacement,
  options: PlacementOptions,
): Promise<void> {
  const existingQueens = await findPlacementConflicts(tx, userId, placement, queen.id);
  if (existingQueens.length > 1) {
    throw routeError(
      ErrorCodes.DUPLICATE_ENTRY,
      `Hive ${placement.hiveNumber} has multiple queens registered in the target slot. Clean up the hive first.`,
      409,
    );
  }

  if (existingQueens[0]) {
    await handlePlacementConflict(tx, userId, existingQueens[0], placement, queen.queenCode, options);
  }

  if (queen.currentHiveId) {
    await tx.queenHiveLog.create({
      data: {
        queenId: queen.id,
        hiveId: queen.currentHiveId,
        colonyNumber: queen.currentColonyNumber,
        action: 'removed',
        date: options.date,
        reason: options.reason || 'Moved to another hive',
        notes: options.notes,
        userId,
      },
    });
  }

  await tx.queenHiveLog.create({
    data: {
      queenId: queen.id,
      hiveId: placement.hiveId,
      colonyNumber: placement.colonyNumber,
      action: 'introduced',
      date: options.date,
      reason: options.reason,
      notes: options.notes,
      userId,
    },
  });

  await tx.queen.update({
    where: { id: queen.id },
    data: {
      currentHiveId: placement.hiveId,
      currentColonyNumber: placement.colonyNumber,
      introducedDate: options.date,
    },
  });
}

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
            hiveType: true,
            apiary: { select: { name: true } },
          },
        },
        _count: { select: { daughters: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = queens.map((q) => ({
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
      currentColonyNumber: q.currentColonyNumber,
      mother: q.mother ? { id: q.mother.id, queenCode: q.mother.queenCode } : null,
      currentHive: q.currentHive ? {
        id: q.currentHive.id,
        hiveNumber: q.currentHive.hiveNumber,
        hiveType: q.currentHive.hiveType,
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

router.post('/', validateBody(createQueenSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      queenCode, year, race, color, marked, clipped, origin, status,
      motherId, matingDate, matingStation, currentHiveId, currentColonyNumber,
      replaceExisting, replacementAction, introducedDate,
      rating, temperament, productivity, swarmTendency, notes,
    } = req.body;

    if (!currentHiveId && currentColonyNumber) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'currentColonyNumber requires currentHiveId', 400);
      return;
    }

    if (replacementAction && !replaceExisting) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'replacementAction requires replaceExisting=true', 400);
      return;
    }

    if (motherId) {
      const mother = await prisma.queen.findFirst({ where: { id: motherId, userId } });
      if (!mother) {
        sendError(res, ErrorCodes.NOT_FOUND, 'Mother queen not found', 404);
        return;
      }
    }

    const placement = currentHiveId
      ? await getAccessibleHivePlacement(userId, currentHiveId, currentColonyNumber)
      : null;
    const placementDate = introducedDate ? new Date(introducedDate) : new Date();

    const queen = await prisma.$transaction(async (tx) => {
      const created = await tx.queen.create({
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
          currentHiveId: null,
          currentColonyNumber: null,
          introducedDate: placement ? placementDate : null,
          rating,
          temperament,
          productivity,
          swarmTendency,
          notes,
          userId,
        },
      });

      if (placement) {
        await assignQueenToPlacement(tx, userId, {
          id: created.id,
          queenCode: created.queenCode,
          currentHiveId: null,
          currentColonyNumber: null,
        }, placement, {
          date: placementDate,
          reason: 'Initial placement',
          notes,
          replaceExisting,
          replacementAction,
        });
      }

      return created;
    });

    sendSuccess(res, {
      id: queen.id,
      queenCode: queen.queenCode,
      year: queen.year,
      status: queen.status,
      createdAt: queen.createdAt,
    }, 201);
  } catch (error) {
    if (isRouteError(error)) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }

    console.error('Create queen error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create queen', 500);
  }
});

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
            hiveType: true,
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
      currentColonyNumber: queen.currentColonyNumber,
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
      daughters: queen.daughters.map((d) => ({
        id: d.id,
        queenCode: d.queenCode,
        year: d.year,
        race: d.race,
        status: d.status,
      })),
      currentHive: queen.currentHive ? {
        id: queen.currentHive.id,
        hiveNumber: queen.currentHive.hiveNumber,
        hiveType: queen.currentHive.hiveType,
        apiaryId: queen.currentHive.apiary.id,
        apiaryName: queen.currentHive.apiary.name,
      } : null,
      hiveHistory: queen.hiveHistory.map((h) => ({
        id: h.id,
        hive: {
          id: h.hive.id,
          hiveNumber: h.hive.hiveNumber,
          apiaryName: h.hive.apiary.name,
        },
        colonyNumber: h.colonyNumber,
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
      motherId, matingDate, matingStation, currentHiveId, currentColonyNumber,
      replaceExisting, replacementAction, introducedDate,
      rating, temperament, productivity, swarmTendency, notes,
    } = req.body;

    if (replacementAction && !replaceExisting) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'replacementAction requires replaceExisting=true', 400);
      return;
    }

    if (!currentHiveId && currentColonyNumber) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'currentColonyNumber requires currentHiveId', 400);
      return;
    }

    if (motherId) {
      const mother = await prisma.queen.findFirst({ where: { id: motherId, userId } });
      if (!mother) {
        sendError(res, ErrorCodes.NOT_FOUND, 'Mother queen not found', 404);
        return;
      }
    }

    const placementRequested = currentHiveId !== undefined || currentColonyNumber !== undefined || introducedDate !== undefined;
    const targetHiveId = currentHiveId === undefined ? existing.currentHiveId : currentHiveId;
    const targetColonyNumber = currentColonyNumber === undefined ? existing.currentColonyNumber : currentColonyNumber;
    const placementDate = introducedDate ? new Date(introducedDate) : new Date();

    const placement = targetHiveId
      ? await getAccessibleHivePlacement(userId, targetHiveId, targetColonyNumber)
      : null;

    const needsPlacementMove = placementRequested && (
      (placement?.hiveId ?? null) !== existing.currentHiveId
      || (placement?.colonyNumber ?? null) !== existing.currentColonyNumber
    );

    const updatedQueen = await prisma.$transaction(async (tx) => {
      if (needsPlacementMove && placement) {
        await assignQueenToPlacement(tx, userId, {
          id: existing.id,
          queenCode: existing.queenCode,
          currentHiveId: existing.currentHiveId,
          currentColonyNumber: existing.currentColonyNumber,
        }, placement, {
          date: placementDate,
          reason: 'Updated placement',
          notes,
          replaceExisting,
          replacementAction,
        });
      } else if (placementRequested && !placement && existing.currentHiveId) {
        await tx.queenHiveLog.create({
          data: {
            queenId: existing.id,
            hiveId: existing.currentHiveId,
            colonyNumber: existing.currentColonyNumber,
            action: 'removed',
            date: placementDate,
            reason: 'Removed from hive',
            notes,
            userId,
          },
        });
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
      if (rating !== undefined) updateData.rating = rating;
      if (temperament !== undefined) updateData.temperament = temperament;
      if (productivity !== undefined) updateData.productivity = productivity;
      if (swarmTendency !== undefined) updateData.swarmTendency = swarmTendency;
      if (notes !== undefined) updateData.notes = notes;

      if (placementRequested) {
        updateData.currentHiveId = placement?.hiveId ?? null;
        updateData.currentColonyNumber = placement?.colonyNumber ?? null;
        updateData.introducedDate = placement ? placementDate : null;
      }

      return tx.queen.update({
        where: { id },
        data: updateData,
      });
    });

    sendSuccess(res, { id: updatedQueen.id, updatedAt: updatedQueen.updatedAt });
  } catch (error) {
    if (isRouteError(error)) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }

    console.error('Update queen error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update queen', 500);
  }
});

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

router.post('/:id/move', validateParams(idParamSchema), validateBody(moveQueenSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const {
      hiveId, currentColonyNumber, replaceExisting, replacementAction, date, reason, notes,
    } = req.body;

    if (replacementAction && !replaceExisting) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'replacementAction requires replaceExisting=true', 400);
      return;
    }

    const queen = await prisma.queen.findFirst({ where: { id, userId } });
    if (!queen) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Queen not found', 404);
      return;
    }

    const placement = await getAccessibleHivePlacement(userId, hiveId, currentColonyNumber);
    if (queen.currentHiveId === placement.hiveId && queen.currentColonyNumber === placement.colonyNumber) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Queen is already in the selected hive slot', 400);
      return;
    }

    const movementDate = new Date(date);

    await prisma.$transaction(async (tx) => {
      await assignQueenToPlacement(tx, userId, {
        id: queen.id,
        queenCode: queen.queenCode,
        currentHiveId: queen.currentHiveId,
        currentColonyNumber: queen.currentColonyNumber,
      }, placement, {
        date: movementDate,
        reason,
        notes,
        replaceExisting,
        replacementAction,
      });
    });

    sendSuccess(res, {
      id: queen.id,
      currentHiveId: placement.hiveId,
      currentColonyNumber: placement.colonyNumber,
      introducedDate: movementDate,
    });
  } catch (error) {
    if (isRouteError(error)) {
      sendError(res, error.code, error.message, error.statusCode);
      return;
    }

    console.error('Move queen error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to move queen', 500);
  }
});

export default router;
