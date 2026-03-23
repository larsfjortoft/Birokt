import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createHiveSchema = z.object({
  apiaryId: z.string().uuid(),
  hiveNumber: z.string().trim().min(1).max(50),
  hiveType: z.enum(['langstroth', 'topbar', 'warre']).default('langstroth'),
  status: z.enum(['active', 'nuc', 'inactive', 'dead', 'sold']).default('active'),
  queen: z.object({
    year: z.number().int().min(2000).max(2100).optional(),
    marked: z.boolean().default(false),
    color: z.enum(['white', 'yellow', 'red', 'green', 'blue']).optional(),
    race: z.string().trim().max(50).optional(),
  }).optional(),
  notes: z.string().trim().optional(),
});

const updateHiveSchema = z.object({
  hiveNumber: z.string().trim().min(1).max(50).optional(),
  hiveType: z.enum(['langstroth', 'topbar', 'warre']).optional(),
  status: z.enum(['active', 'nuc', 'inactive', 'dead', 'sold']).optional(),
  strength: z.enum(['weak', 'medium', 'strong']).optional(),
  boxCount: z.number().int().min(1).max(10).optional(),
  queen: z.object({
    year: z.number().int().min(2000).max(2100).optional(),
    marked: z.boolean().optional(),
    color: z.enum(['white', 'yellow', 'red', 'green', 'blue']).optional(),
    race: z.string().trim().max(50).optional(),
  }).optional(),
  notes: z.string().trim().optional(),
});

const listHivesSchema = z.object({
  apiaryId: z.string().uuid().optional(),
  status: z.enum(['active', 'nuc', 'inactive', 'dead', 'sold']).optional(),
  strength: z.enum(['weak', 'medium', 'strong']).optional(),
  healthStatus: z.enum(['healthy', 'warning', 'critical']).optional(),
  sortBy: z.enum(['hive_number', 'last_inspection', 'strength', 'created_at']).default('hive_number'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const qrCodeParamSchema = z.object({
  qrCode: z.string().min(1),
});

// Helper function to check apiary access
async function checkApiaryAccess(userId: string, apiaryId: string): Promise<boolean> {
  const userApiary = await prisma.userApiary.findUnique({
    where: {
      userId_apiaryId: { userId, apiaryId },
    },
  });
  return !!userApiary;
}

// GET /hives - List all hives
router.get('/', validateQuery(listHivesSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { apiaryId, status, strength, healthStatus, sortBy, order, page, perPage } = req.query as unknown as {
      apiaryId?: string;
      status?: string;
      strength?: string;
      healthStatus?: string;
      sortBy: string;
      order: string;
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

    const where = {
      apiaryId: apiaryId ? apiaryId : { in: apiaryIds },
      ...(status && { status }),
      ...(strength && { strength }),
    };

    // Build orderBy
    const orderByField = sortBy === 'hive_number' ? 'hiveNumber' :
                         sortBy === 'last_inspection' ? 'updatedAt' :
                         sortBy === 'created_at' ? 'createdAt' : 'strength';

    let hives = await prisma.hive.findMany({
      where,
      include: {
        apiary: {
          select: {
            id: true,
            name: true,
          },
        },
        inspections: {
          orderBy: { inspectionDate: 'desc' },
          take: 1,
          select: {
            id: true,
            inspectionDate: true,
            healthStatus: true,
            strength: true,
          },
        },
        _count: {
          select: {
            inspections: true,
            productions: true,
          },
        },
      },
      orderBy: { [orderByField]: order },
    });

    // Filter by healthStatus from latest inspection (post-query)
    if (healthStatus) {
      hives = hives.filter(hive =>
        hive.inspections[0]?.healthStatus === healthStatus
      );
    }

    const total = hives.length;

    // Apply pagination after filtering
    hives = hives.slice((page - 1) * perPage, page * perPage);

    const result = hives.map(hive => ({
      id: hive.id,
      hiveNumber: hive.hiveNumber,
      qrCode: hive.qrCode,
      apiary: hive.apiary,
      status: hive.status,
      strength: hive.strength,
      hiveType: hive.hiveType,
      boxCount: hive.boxCount,
      queen: {
        year: hive.queenYear,
        marked: hive.queenMarked,
        color: hive.queenColor,
        race: hive.queenRace,
      },
      currentFrames: {
        brood: hive.currentBroodFrames,
        honey: hive.currentHoneyFrames,
      },
      lastInspection: hive.inspections[0] ? {
        date: hive.inspections[0].inspectionDate,
        healthStatus: hive.inspections[0].healthStatus,
        strength: hive.inspections[0].strength,
      } : null,
      stats: {
        totalInspections: hive._count.inspections,
        totalProductionKg: 0, // Would need to sum production
      },
      createdAt: hive.createdAt,
    }));

    sendSuccess(res, result, 200, calculatePagination(page, perPage, total));
  } catch (error) {
    console.error('List hives error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list hives', 500);
  }
});

// POST /hives - Create new hive
router.post('/', validateBody(createHiveSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { apiaryId, hiveNumber, hiveType, status, queen, notes } = req.body;

    // Check apiary access
    const hasAccess = await checkApiaryAccess(userId, apiaryId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this apiary', 403);
      return;
    }

    // Generate QR code
    const year = new Date().getFullYear();
    const qrCode = `QR-${hiveNumber}-${year}`;

    const hive = await prisma.hive.create({
      data: {
        apiaryId,
        hiveNumber,
        hiveType,
        status,
        qrCode,
        queenYear: queen?.year,
        queenMarked: queen?.marked || false,
        queenColor: queen?.color,
        queenRace: queen?.race,
        notes,
      },
      include: {
        apiary: {
          select: { id: true, name: true },
        },
      },
    });

    sendSuccess(res, {
      id: hive.id,
      hiveNumber: hive.hiveNumber,
      qrCode: hive.qrCode,
      apiary: hive.apiary,
      status: hive.status,
      hiveType: hive.hiveType,
      queen: {
        year: hive.queenYear,
        marked: hive.queenMarked,
        color: hive.queenColor,
        race: hive.queenRace,
      },
      notes: hive.notes,
      createdAt: hive.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create hive error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create hive', 500);
  }
});

// GET /hives/:id - Get single hive with details
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const hive = await prisma.hive.findUnique({
      where: { id },
      include: {
        apiary: {
          select: {
            id: true,
            name: true,
            locationName: true,
            locationLat: true,
            locationLng: true,
          },
        },
        inspections: {
          orderBy: { inspectionDate: 'desc' },
          take: 10,
          select: {
            id: true,
            inspectionDate: true,
            strength: true,
            healthStatus: true,
            notes: true,
          },
        },
        treatments: {
          orderBy: { treatmentDate: 'desc' },
          take: 5,
          select: {
            id: true,
            treatmentDate: true,
            productName: true,
            withholdingEndDate: true,
          },
        },
        _count: {
          select: {
            inspections: true,
            treatments: true,
            feedings: true,
          },
        },
      },
    });

    if (!hive) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Hive not found', 404);
      return;
    }

    // Check access
    const hasAccess = await checkApiaryAccess(userId, hive.apiaryId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    sendSuccess(res, {
      id: hive.id,
      hiveNumber: hive.hiveNumber,
      qrCode: hive.qrCode,
      apiary: {
        id: hive.apiary.id,
        name: hive.apiary.name,
        location: {
          name: hive.apiary.locationName,
          lat: hive.apiary.locationLat,
          lng: hive.apiary.locationLng,
        },
      },
      status: hive.status,
      strength: hive.strength,
      hiveType: hive.hiveType,
      boxCount: hive.boxCount,
      queen: {
        year: hive.queenYear,
        marked: hive.queenMarked,
        color: hive.queenColor,
        race: hive.queenRace,
      },
      currentFrames: {
        brood: hive.currentBroodFrames,
        honey: hive.currentHoneyFrames,
      },
      inspections: hive.inspections,
      treatments: hive.treatments.map(t => ({
        id: t.id,
        date: t.treatmentDate,
        product: t.productName,
        withholdingEnd: t.withholdingEndDate,
      })),
      stats: {
        totalInspections: hive._count.inspections,
        totalTreatments: hive._count.treatments,
        totalFeedings: hive._count.feedings,
      },
      notes: hive.notes,
      createdAt: hive.createdAt,
    });
  } catch (error) {
    console.error('Get hive error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get hive', 500);
  }
});

// GET /hives/qr/:qrCode - Get hive by QR code
router.get('/qr/:qrCode', validateParams(qrCodeParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { qrCode } = req.params;

    const hive = await prisma.hive.findUnique({
      where: { qrCode },
      include: {
        apiary: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!hive) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Hive not found', 404);
      return;
    }

    // Check access
    const hasAccess = await checkApiaryAccess(userId, hive.apiaryId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    sendSuccess(res, {
      id: hive.id,
      hiveNumber: hive.hiveNumber,
      qrCode: hive.qrCode,
      apiary: hive.apiary,
      status: hive.status,
      strength: hive.strength,
    });
  } catch (error) {
    console.error('Get hive by QR error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get hive', 500);
  }
});

// PUT /hives/:id - Update hive
router.put('/:id', validateParams(idParamSchema), validateBody(updateHiveSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { hiveNumber, hiveType, status, strength, boxCount, queen, notes } = req.body;

    // Get hive and check access
    const existingHive = await prisma.hive.findUnique({
      where: { id },
    });

    if (!existingHive) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Hive not found', 404);
      return;
    }

    const hasAccess = await checkApiaryAccess(userId, existingHive.apiaryId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    const hive = await prisma.hive.update({
      where: { id },
      data: {
        ...(hiveNumber && { hiveNumber }),
        ...(hiveType && { hiveType }),
        ...(status && { status }),
        ...(strength && { strength }),
        ...(boxCount && { boxCount }),
        ...(queen?.year !== undefined && { queenYear: queen.year }),
        ...(queen?.marked !== undefined && { queenMarked: queen.marked }),
        ...(queen?.color !== undefined && { queenColor: queen.color }),
        ...(queen?.race !== undefined && { queenRace: queen.race }),
        ...(notes !== undefined && { notes }),
      },
    });

    sendSuccess(res, {
      id: hive.id,
      hiveNumber: hive.hiveNumber,
      status: hive.status,
      strength: hive.strength,
      boxCount: hive.boxCount,
      queen: {
        year: hive.queenYear,
        marked: hive.queenMarked,
        color: hive.queenColor,
        race: hive.queenRace,
      },
      notes: hive.notes,
      updatedAt: hive.updatedAt,
    });
  } catch (error) {
    console.error('Update hive error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update hive', 500);
  }
});

// DELETE /hives/:id - Delete hive
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Get hive and check access
    const hive = await prisma.hive.findUnique({
      where: { id },
    });

    if (!hive) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Hive not found', 404);
      return;
    }

    const userApiary = await prisma.userApiary.findUnique({
      where: {
        userId_apiaryId: { userId, apiaryId: hive.apiaryId },
      },
    });

    if (!userApiary || userApiary.role !== 'owner') {
      sendError(res, ErrorCodes.FORBIDDEN, 'Only the owner can delete hives', 403);
      return;
    }

    // Soft delete by setting status to inactive
    await prisma.hive.update({
      where: { id },
      data: { status: 'inactive' },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete hive error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete hive', 500);
  }
});

export default router;
