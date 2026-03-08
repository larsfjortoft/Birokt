import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createInspectionSchema = z.object({
  hiveId: z.string().uuid(),
  inspectionDate: z.string().datetime(),
  weather: z.object({
    temperature: z.number().optional(),
    windSpeed: z.number().optional(),
    condition: z.string().trim().max(100).optional(),
  }).optional(),
  assessment: z.object({
    strength: z.enum(['weak', 'medium', 'strong']).optional(),
    temperament: z.enum(['calm', 'nervous', 'aggressive']).optional(),
    queenSeen: z.boolean().default(false),
    queenLaying: z.boolean().default(false),
  }).optional(),
  frames: z.object({
    brood: z.number().int().min(0).default(0),
    honey: z.number().int().min(0).default(0),
    pollen: z.number().int().min(0).default(0),
    empty: z.number().int().min(0).default(0),
  }).optional(),
  health: z.object({
    status: z.enum(['healthy', 'warning', 'critical']).default('healthy'),
    varroaLevel: z.enum(['none', 'low', 'medium', 'high']).optional(),
    diseases: z.array(z.string()).default([]),
    pests: z.array(z.string()).default([]),
  }).optional(),
  actions: z.array(z.object({
    actionType: z.string().trim(),
    details: z.record(z.unknown()).default({}),
  })).optional(),
  notes: z.string().trim().optional(),
});

const updateInspectionSchema = z.object({
  weather: z.object({
    temperature: z.number().optional(),
    windSpeed: z.number().optional(),
    condition: z.string().trim().max(100).optional(),
  }).optional(),
  assessment: z.object({
    strength: z.enum(['weak', 'medium', 'strong']).optional(),
    temperament: z.enum(['calm', 'nervous', 'aggressive']).optional(),
    queenSeen: z.boolean().optional(),
    queenLaying: z.boolean().optional(),
  }).optional(),
  frames: z.object({
    brood: z.number().int().min(0).optional(),
    honey: z.number().int().min(0).optional(),
    pollen: z.number().int().min(0).optional(),
    empty: z.number().int().min(0).optional(),
  }).optional(),
  health: z.object({
    status: z.enum(['healthy', 'warning', 'critical']).optional(),
    varroaLevel: z.enum(['none', 'low', 'medium', 'high']).optional(),
    diseases: z.array(z.string()).optional(),
    pests: z.array(z.string()).optional(),
  }).optional(),
  notes: z.string().trim().optional(),
});

const listInspectionsSchema = z.object({
  hiveId: z.string().uuid().optional(),
  apiaryId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  healthStatus: z.enum(['healthy', 'warning', 'critical']).optional(),
  search: z.string().trim().max(200).optional(),
  strength: z.enum(['weak', 'medium', 'strong']).optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 10, // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP and HEIC are allowed.'));
    }
  },
});

// Photo upload directories
const uploadsDir = 'uploads';
const photosDir = path.join(uploadsDir, 'photos');

async function ensureDirectories() {
  try {
    await fs.mkdir(photosDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create uploads directory:', error);
  }
}
ensureDirectories();

// Process and save image
async function processAndSaveImage(buffer: Buffer, filename: string): Promise<{
  filePath: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  fileSize: number;
}> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const subDir = path.join(photosDir, String(year), month);

  await fs.mkdir(subDir, { recursive: true });

  // Process full-size image
  const fullImage = await sharp(buffer)
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const metadata = await sharp(fullImage).metadata();

  // Generate thumbnail
  const thumbnail = await sharp(buffer)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();

  const fullPath = path.join(subDir, `${filename}.jpg`);
  const thumbPath = path.join(subDir, `${filename}_thumb.jpg`);

  await fs.writeFile(fullPath, fullImage);
  await fs.writeFile(thumbPath, thumbnail);

  // Generate URLs
  const baseUrl = process.env.CDN_URL || '/uploads';
  const urlPath = `photos/${year}/${month}`;

  return {
    filePath: fullPath,
    url: `${baseUrl}/${urlPath}/${filename}.jpg`,
    thumbnailUrl: `${baseUrl}/${urlPath}/${filename}_thumb.jpg`,
    width: metadata.width || 0,
    height: metadata.height || 0,
    fileSize: fullImage.length,
  };
}

// Helper function to check hive access
async function checkHiveAccess(userId: string, hiveId: string): Promise<{ hasAccess: boolean; hive?: { apiaryId: string } }> {
  const hive = await prisma.hive.findUnique({
    where: { id: hiveId },
    select: { apiaryId: true },
  });

  if (!hive) return { hasAccess: false };

  const userApiary = await prisma.userApiary.findUnique({
    where: {
      userId_apiaryId: { userId, apiaryId: hive.apiaryId },
    },
  });

  return { hasAccess: !!userApiary, hive };
}

// GET /inspections - List inspections
router.get('/', validateQuery(listInspectionsSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hiveId, apiaryId, startDate, endDate, healthStatus, search, strength, page, perPage } = req.query as unknown as {
      hiveId?: string;
      apiaryId?: string;
      startDate?: string;
      endDate?: string;
      healthStatus?: string;
      search?: string;
      strength?: string;
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

    // Build where clause
    let hiveIds: string[] | undefined;
    if (hiveId) {
      const hive = await prisma.hive.findFirst({
        where: { id: hiveId, apiaryId: { in: apiaryIds } },
        select: { id: true },
      });
      if (!hive) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
        return;
      }
      hiveIds = [hiveId];
    } else if (apiaryId) {
      const hives = await prisma.hive.findMany({
        where: { apiaryId },
        select: { id: true },
      });
      hiveIds = hives.map(h => h.id);
    } else {
      const hives = await prisma.hive.findMany({
        where: { apiaryId: { in: apiaryIds } },
        select: { id: true },
      });
      hiveIds = hives.map(h => h.id);
    }

    const where: Record<string, unknown> = {
      hiveId: { in: hiveIds },
      ...(startDate && { inspectionDate: { gte: new Date(startDate) } }),
      ...(endDate && { inspectionDate: { lte: new Date(endDate) } }),
      ...(healthStatus && { healthStatus }),
      ...(strength && { strength }),
    };

    // SQLite contains is case-sensitive, use raw filter for case-insensitive search
    if (search) {
      where.notes = { contains: search };
    }

    const total = await prisma.inspection.count({ where });

    const inspections = await prisma.inspection.findMany({
      where,
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
            apiary: {
              select: { name: true },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        photos: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
          },
        },
        actions: true,
      },
      orderBy: { inspectionDate: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = inspections.map(inspection => ({
      id: inspection.id,
      hive: {
        id: inspection.hive.id,
        hiveNumber: inspection.hive.hiveNumber,
        apiaryName: inspection.hive.apiary.name,
      },
      user: inspection.user,
      inspectionDate: inspection.inspectionDate,
      weather: {
        temperature: inspection.temperature,
        windSpeed: inspection.windSpeed,
        condition: inspection.weatherCondition,
      },
      assessment: {
        strength: inspection.strength,
        temperament: inspection.temperament,
        queenSeen: inspection.queenSeen,
        queenLaying: inspection.queenLaying,
      },
      frames: {
        brood: inspection.broodFrames,
        honey: inspection.honeyFrames,
        pollen: inspection.pollenFrames,
        empty: inspection.emptyFrames,
      },
      health: {
        status: inspection.healthStatus,
        varroaLevel: inspection.varroaLevel,
        diseases: JSON.parse(inspection.diseases),
        pests: JSON.parse(inspection.pests),
      },
      photos: inspection.photos,
      actions: inspection.actions.map(a => ({
        id: a.id,
        actionType: a.actionType,
        details: JSON.parse(a.details),
      })),
      notes: inspection.notes,
      createdAt: inspection.createdAt,
    }));

    sendSuccess(res, result, 200, calculatePagination(page, perPage, total));
  } catch (error) {
    console.error('List inspections error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list inspections', 500);
  }
});

// POST /inspections - Create new inspection
router.post('/', validateBody(createInspectionSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hiveId, inspectionDate, weather, assessment, frames, health, actions, notes } = req.body;

    // Check hive access
    const { hasAccess } = await checkHiveAccess(userId, hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    // Create inspection with optional actions
    const inspection = await prisma.inspection.create({
      data: {
        hiveId,
        userId,
        inspectionDate: new Date(inspectionDate),
        temperature: weather?.temperature,
        windSpeed: weather?.windSpeed,
        weatherCondition: weather?.condition,
        strength: assessment?.strength,
        temperament: assessment?.temperament,
        queenSeen: assessment?.queenSeen || false,
        queenLaying: assessment?.queenLaying || false,
        broodFrames: frames?.brood || 0,
        honeyFrames: frames?.honey || 0,
        pollenFrames: frames?.pollen || 0,
        emptyFrames: frames?.empty || 0,
        healthStatus: health?.status || 'healthy',
        varroaLevel: health?.varroaLevel,
        diseases: JSON.stringify(health?.diseases || []),
        pests: JSON.stringify(health?.pests || []),
        notes,
        actions: actions ? {
          create: actions.map((a: { actionType: string; details: Record<string, unknown> }) => ({
            actionType: a.actionType,
            details: JSON.stringify(a.details),
          })),
        } : undefined,
      },
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
          },
        },
        actions: true,
      },
    });

    // Update hive with latest stats
    await prisma.hive.update({
      where: { id: hiveId },
      data: {
        strength: assessment?.strength,
        currentBroodFrames: frames?.brood,
        currentHoneyFrames: frames?.honey,
      },
    });

    sendSuccess(res, {
      id: inspection.id,
      hive: inspection.hive,
      inspectionDate: inspection.inspectionDate,
      weather: {
        temperature: inspection.temperature,
        windSpeed: inspection.windSpeed,
        condition: inspection.weatherCondition,
      },
      assessment: {
        strength: inspection.strength,
        temperament: inspection.temperament,
        queenSeen: inspection.queenSeen,
        queenLaying: inspection.queenLaying,
      },
      frames: {
        brood: inspection.broodFrames,
        honey: inspection.honeyFrames,
        pollen: inspection.pollenFrames,
        empty: inspection.emptyFrames,
      },
      health: {
        status: inspection.healthStatus,
        varroaLevel: inspection.varroaLevel,
        diseases: JSON.parse(inspection.diseases),
        pests: JSON.parse(inspection.pests),
      },
      actions: inspection.actions.map(a => ({
        id: a.id,
        actionType: a.actionType,
        details: JSON.parse(a.details),
      })),
      notes: inspection.notes,
      createdAt: inspection.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create inspection error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create inspection', 500);
  }
});

// GET /inspections/:id - Get single inspection
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
            apiaryId: true,
            apiary: {
              select: { name: true },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        photos: true,
        actions: true,
      },
    });

    if (!inspection) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Inspection not found', 404);
      return;
    }

    // Check access
    const { hasAccess } = await checkHiveAccess(userId, inspection.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this inspection', 403);
      return;
    }

    sendSuccess(res, {
      id: inspection.id,
      hive: {
        id: inspection.hive.id,
        hiveNumber: inspection.hive.hiveNumber,
        apiaryName: inspection.hive.apiary.name,
      },
      user: inspection.user,
      inspectionDate: inspection.inspectionDate,
      weather: {
        temperature: inspection.temperature,
        windSpeed: inspection.windSpeed,
        condition: inspection.weatherCondition,
      },
      assessment: {
        strength: inspection.strength,
        temperament: inspection.temperament,
        queenSeen: inspection.queenSeen,
        queenLaying: inspection.queenLaying,
      },
      frames: {
        brood: inspection.broodFrames,
        honey: inspection.honeyFrames,
        pollen: inspection.pollenFrames,
        empty: inspection.emptyFrames,
      },
      health: {
        status: inspection.healthStatus,
        varroaLevel: inspection.varroaLevel,
        diseases: JSON.parse(inspection.diseases),
        pests: JSON.parse(inspection.pests),
      },
      photos: inspection.photos.map(p => ({
        id: p.id,
        url: p.url,
        thumbnailUrl: p.thumbnailUrl,
        caption: p.caption,
      })),
      actions: inspection.actions.map(a => ({
        id: a.id,
        actionType: a.actionType,
        details: JSON.parse(a.details),
      })),
      notes: inspection.notes,
      createdAt: inspection.createdAt,
    });
  } catch (error) {
    console.error('Get inspection error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get inspection', 500);
  }
});

// PUT /inspections/:id - Update inspection
router.put('/:id', validateParams(idParamSchema), validateBody(updateInspectionSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { weather, assessment, frames, health, notes } = req.body;

    // Get inspection and check access
    const existingInspection = await prisma.inspection.findUnique({
      where: { id },
    });

    if (!existingInspection) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Inspection not found', 404);
      return;
    }

    const { hasAccess } = await checkHiveAccess(userId, existingInspection.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this inspection', 403);
      return;
    }

    const inspection = await prisma.inspection.update({
      where: { id },
      data: {
        ...(weather?.temperature !== undefined && { temperature: weather.temperature }),
        ...(weather?.windSpeed !== undefined && { windSpeed: weather.windSpeed }),
        ...(weather?.condition !== undefined && { weatherCondition: weather.condition }),
        ...(assessment?.strength && { strength: assessment.strength }),
        ...(assessment?.temperament && { temperament: assessment.temperament }),
        ...(assessment?.queenSeen !== undefined && { queenSeen: assessment.queenSeen }),
        ...(assessment?.queenLaying !== undefined && { queenLaying: assessment.queenLaying }),
        ...(frames?.brood !== undefined && { broodFrames: frames.brood }),
        ...(frames?.honey !== undefined && { honeyFrames: frames.honey }),
        ...(frames?.pollen !== undefined && { pollenFrames: frames.pollen }),
        ...(frames?.empty !== undefined && { emptyFrames: frames.empty }),
        ...(health?.status && { healthStatus: health.status }),
        ...(health?.varroaLevel !== undefined && { varroaLevel: health.varroaLevel }),
        ...(health?.diseases && { diseases: JSON.stringify(health.diseases) }),
        ...(health?.pests && { pests: JSON.stringify(health.pests) }),
        ...(notes !== undefined && { notes }),
      },
    });

    sendSuccess(res, {
      id: inspection.id,
      updatedAt: inspection.updatedAt,
    });
  } catch (error) {
    console.error('Update inspection error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update inspection', 500);
  }
});

// POST /inspections/:id/photos - Upload photos for inspection
router.post('/:id/photos', validateParams(idParamSchema), upload.array('photos', 10), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'No files uploaded', 400);
      return;
    }

    // Get inspection and check access
    const inspection = await prisma.inspection.findUnique({
      where: { id },
      select: { id: true, hiveId: true },
    });

    if (!inspection) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Inspection not found', 404);
      return;
    }

    const { hasAccess } = await checkHiveAccess(userId, inspection.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this inspection', 403);
      return;
    }

    // Process and save all files
    const savedPhotos = await Promise.all(
      files.map(async (file) => {
        const photoId = uuidv4();
        const processed = await processAndSaveImage(file.buffer, photoId);

        const photo = await prisma.photo.create({
          data: {
            id: photoId,
            hiveId: inspection.hiveId,
            userId,
            inspectionId: inspection.id,
            filePath: processed.filePath,
            url: processed.url,
            thumbnailUrl: processed.thumbnailUrl,
            fileSize: processed.fileSize,
            mimeType: 'image/jpeg',
            width: processed.width,
            height: processed.height,
          },
        });

        return {
          id: photo.id,
          url: photo.url,
          thumbnailUrl: photo.thumbnailUrl,
          fileSize: photo.fileSize,
          width: photo.width,
          height: photo.height,
        };
      })
    );

    sendSuccess(res, { urls: savedPhotos.map(p => p.url) }, 201);
  } catch (error) {
    console.error('Upload inspection photos error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to upload photos', 500);
  }
});

// DELETE /inspections/:id - Delete inspection
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Get inspection and check access
    const inspection = await prisma.inspection.findUnique({
      where: { id },
    });

    if (!inspection) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Inspection not found', 404);
      return;
    }

    const { hasAccess } = await checkHiveAccess(userId, inspection.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this inspection', 403);
      return;
    }

    await prisma.inspection.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Delete inspection error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete inspection', 500);
  }
});

export default router;
