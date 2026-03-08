import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';
import { cacheResponse } from '../middleware/cacheMiddleware.js';
import { cacheDeletePattern } from '../utils/cache.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createApiarySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  location: z.object({
    name: z.string().trim().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }).optional(),
  type: z.enum(['permanent', 'seasonal', 'heather_route']).default('permanent'),
});

const updateApiarySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional(),
  location: z.object({
    name: z.string().trim().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }).optional(),
  type: z.enum(['permanent', 'seasonal', 'heather_route']).optional(),
  active: z.boolean().optional(),
});

const listApiariesSchema = z.object({
  includeInactive: z.string().transform(v => v === 'true').optional(),
  type: z.enum(['permanent', 'seasonal', 'heather_route']).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// GET /apiaries - List all apiaries for the user
router.get('/', validateQuery(listApiariesSchema), cacheResponse(60), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { includeInactive, type } = req.query;

    const where = {
      userApiaries: {
        some: { userId },
      },
      ...(includeInactive !== 'true' && { active: true }),
      ...(type && { type: type as string }),
    };

    const apiaries = await prisma.apiary.findMany({
      where,
      include: {
        hives: {
          select: {
            id: true,
            status: true,
            strength: true,
          },
        },
        userApiaries: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform response
    const result = apiaries.map(apiary => {
      const hives = apiary.hives;
      const activeHives = hives.filter(h => h.status === 'active');

      return {
        id: apiary.id,
        name: apiary.name,
        description: apiary.description,
        location: {
          name: apiary.locationName,
          lat: apiary.locationLat,
          lng: apiary.locationLng,
        },
        type: apiary.type,
        active: apiary.active,
        hiveCount: hives.length,
        stats: {
          healthy: activeHives.filter(h => h.strength === 'strong' || h.strength === 'medium').length,
          warning: activeHives.filter(h => h.strength === 'weak').length,
          critical: 0, // Would need inspection data for this
        },
        role: apiary.userApiaries[0]?.role || 'viewer',
        createdAt: apiary.createdAt,
      };
    });

    sendSuccess(res, result);
  } catch (error) {
    console.error('List apiaries error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list apiaries', 500);
  }
});

// POST /apiaries - Create new apiary
router.post('/', validateBody(createApiarySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, location, type } = req.body;

    const apiary = await prisma.apiary.create({
      data: {
        name,
        description,
        locationName: location?.name,
        locationLat: location?.lat,
        locationLng: location?.lng,
        type,
        userApiaries: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
    });

    // Invalidate apiaries cache for this user
    cacheDeletePattern(`response:${userId}:/api/v1/apiaries`);

    sendSuccess(res, {
      id: apiary.id,
      name: apiary.name,
      description: apiary.description,
      location: {
        name: apiary.locationName,
        lat: apiary.locationLat,
        lng: apiary.locationLng,
      },
      type: apiary.type,
      active: apiary.active,
      createdAt: apiary.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create apiary error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create apiary', 500);
  }
});

// GET /apiaries/:id - Get single apiary with details
router.get('/:id', validateParams(idParamSchema), cacheResponse(60), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Check access
    const userApiary = await prisma.userApiary.findUnique({
      where: {
        userId_apiaryId: { userId, apiaryId: id },
      },
    });

    if (!userApiary) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this apiary', 403);
      return;
    }

    const apiary = await prisma.apiary.findUnique({
      where: { id },
      include: {
        hives: {
          orderBy: { hiveNumber: 'asc' },
          include: {
            inspections: {
              orderBy: { inspectionDate: 'desc' },
              take: 1,
              select: {
                inspectionDate: true,
                healthStatus: true,
                strength: true,
              },
            },
          },
        },
        userApiaries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!apiary) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Apiary not found', 404);
      return;
    }

    sendSuccess(res, {
      id: apiary.id,
      name: apiary.name,
      description: apiary.description,
      location: {
        name: apiary.locationName,
        lat: apiary.locationLat,
        lng: apiary.locationLng,
      },
      type: apiary.type,
      active: apiary.active,
      hives: apiary.hives.map(hive => ({
        id: hive.id,
        hiveNumber: hive.hiveNumber,
        status: hive.status,
        strength: hive.strength,
        lastInspection: hive.inspections[0]?.inspectionDate || null,
      })),
      collaborators: apiary.userApiaries.map(ua => ({
        userId: ua.user.id,
        name: ua.user.name,
        role: ua.role,
      })),
      createdAt: apiary.createdAt,
    });
  } catch (error) {
    console.error('Get apiary error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get apiary', 500);
  }
});

// PUT /apiaries/:id - Update apiary
router.put('/:id', validateParams(idParamSchema), validateBody(updateApiarySchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, description, location, type, active } = req.body;

    // Check access (only owner can update)
    const userApiary = await prisma.userApiary.findUnique({
      where: {
        userId_apiaryId: { userId, apiaryId: id },
      },
    });

    if (!userApiary || userApiary.role !== 'owner') {
      sendError(res, ErrorCodes.FORBIDDEN, 'Only the owner can update this apiary', 403);
      return;
    }

    const apiary = await prisma.apiary.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(location?.name !== undefined && { locationName: location.name }),
        ...(location?.lat !== undefined && { locationLat: location.lat }),
        ...(location?.lng !== undefined && { locationLng: location.lng }),
        ...(type && { type }),
        ...(active !== undefined && { active }),
      },
    });

    // Invalidate apiaries cache for this user
    cacheDeletePattern(`response:${userId}:/api/v1/apiaries`);

    sendSuccess(res, {
      id: apiary.id,
      name: apiary.name,
      description: apiary.description,
      location: {
        name: apiary.locationName,
        lat: apiary.locationLat,
        lng: apiary.locationLng,
      },
      type: apiary.type,
      active: apiary.active,
      updatedAt: apiary.updatedAt,
    });
  } catch (error) {
    console.error('Update apiary error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update apiary', 500);
  }
});

// DELETE /apiaries/:id - Delete apiary
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Check access (only owner can delete)
    const userApiary = await prisma.userApiary.findUnique({
      where: {
        userId_apiaryId: { userId, apiaryId: id },
      },
    });

    if (!userApiary || userApiary.role !== 'owner') {
      sendError(res, ErrorCodes.FORBIDDEN, 'Only the owner can delete this apiary', 403);
      return;
    }

    // Check if there are hives
    const hiveCount = await prisma.hive.count({ where: { apiaryId: id } });

    if (hiveCount > 0) {
      // Soft delete (set inactive)
      await prisma.apiary.update({
        where: { id },
        data: { active: false },
      });
    } else {
      // Hard delete if no hives
      await prisma.apiary.delete({ where: { id } });
    }

    // Invalidate apiaries cache for this user
    cacheDeletePattern(`response:${userId}:/api/v1/apiaries`);

    res.status(204).send();
  } catch (error) {
    console.error('Delete apiary error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete apiary', 500);
  }
});

export default router;
