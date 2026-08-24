import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';
import { cacheResponse } from '../middleware/cacheMiddleware.js';
import { cacheDeletePattern } from '../utils/cache.js';
import { auditData } from '../services/complianceService.js';

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
  registrationNumber: z.string().trim().max(100).optional(),
  operatorName: z.string().trim().max(255).optional(),
  operatorAddress: z.string().trim().max(1000).optional(),
  organizationNumber: z.string().trim().max(50).optional(),
  validFrom: z.string().datetime({ offset: true }).optional(),
  validTo: z.string().datetime({ offset: true }).optional(),
});

const updateApiarySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().nullable().optional(),
  location: z.object({
    name: z.string().trim().nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  }).optional(),
  type: z.enum(['permanent', 'seasonal', 'heather_route']).optional(),
  active: z.boolean().optional(),
  registrationNumber: z.string().trim().max(100).nullable().optional(),
  operatorName: z.string().trim().max(255).nullable().optional(),
  operatorAddress: z.string().trim().max(1000).nullable().optional(),
  organizationNumber: z.string().trim().max(50).nullable().optional(),
  validFrom: z.string().datetime({ offset: true }).nullable().optional(),
  validTo: z.string().datetime({ offset: true }).nullable().optional(),
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
        registrationNumber: apiary.registrationNumber,
        operatorName: apiary.operatorName,
        operatorAddress: apiary.operatorAddress,
        organizationNumber: apiary.organizationNumber,
        validFrom: apiary.validFrom,
        validTo: apiary.validTo,
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
    const { name, description, location, type, registrationNumber, operatorName, operatorAddress, organizationNumber, validFrom, validTo } = req.body;

    const apiary = await prisma.$transaction(async tx => {
      const created = await tx.apiary.create({ data: {
        name,
        description,
        locationName: location?.name,
        locationLat: location?.lat,
        locationLng: location?.lng,
        type,
        registrationNumber, operatorName, operatorAddress, organizationNumber,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        userApiaries: {
          create: {
            userId,
            role: 'owner',
          },
        },
      }});
      await tx.auditLog.create({ data: auditData({ userId, entityType: 'Apiary', entityId: created.id, action: 'create', after: created, requestId: res.locals.requestId }) });
      return created;
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
      registrationNumber: apiary.registrationNumber,
      operatorName: apiary.operatorName,
      operatorAddress: apiary.operatorAddress,
      organizationNumber: apiary.organizationNumber,
      validFrom: apiary.validFrom,
      validTo: apiary.validTo,
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
      registrationNumber: apiary.registrationNumber,
      operatorName: apiary.operatorName,
      operatorAddress: apiary.operatorAddress,
      organizationNumber: apiary.organizationNumber,
      validFrom: apiary.validFrom,
      validTo: apiary.validTo,
      hives: apiary.hives.map(hive => ({
        id: hive.id,
        hiveNumber: hive.hiveNumber,
        status: hive.status,
        strength: hive.strength,
        hiveType: hive.hiveType,
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
    const { name, description, location, type, active, registrationNumber, operatorName, operatorAddress, organizationNumber, validFrom, validTo } = req.body;

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

    const apiary = await prisma.$transaction(async tx => {
      const before = await tx.apiary.findUniqueOrThrow({ where: { id } });
      const updated = await tx.apiary.update({ where: { id }, data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(location?.name !== undefined && { locationName: location.name }),
        ...(location?.lat !== undefined && { locationLat: location.lat }),
        ...(location?.lng !== undefined && { locationLng: location.lng }),
        ...(type && { type }),
        ...(active !== undefined && { active }),
        ...(registrationNumber !== undefined && { registrationNumber }),
        ...(operatorName !== undefined && { operatorName }),
        ...(operatorAddress !== undefined && { operatorAddress }),
        ...(organizationNumber !== undefined && { organizationNumber }),
        ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
        ...(validTo !== undefined && { validTo: validTo ? new Date(validTo) : null }),
      }});
      await tx.auditLog.create({ data: auditData({ userId, entityType: 'Apiary', entityId: id, action: 'update', before, after: updated, requestId: res.locals.requestId }) });
      return updated;
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
      registrationNumber: apiary.registrationNumber,
      operatorName: apiary.operatorName,
      operatorAddress: apiary.operatorAddress,
      organizationNumber: apiary.organizationNumber,
      validFrom: apiary.validFrom,
      validTo: apiary.validTo,
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

    await prisma.$transaction(async tx => {
      const before = await tx.apiary.findUniqueOrThrow({ where: { id } });
      const updated = await tx.apiary.update({ where: { id }, data: { active: false } });
      await tx.auditLog.create({ data: auditData({ userId, entityType: 'Apiary', entityId: id, action: 'update', before, after: updated, reason: 'Deactivated instead of hard deletion', requestId: res.locals.requestId }) });
    });

    // Invalidate apiaries cache for this user
    cacheDeletePattern(`response:${userId}:/api/v1/apiaries`);

    res.status(204).send();
  } catch (error) {
    console.error('Delete apiary error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete apiary', 500);
  }
});

export default router;
