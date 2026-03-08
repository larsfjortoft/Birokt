import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

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

// Validation schemas
const listPhotosSchema = z.object({
  hiveId: z.string().uuid().optional(),
  inspectionId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// Ensure uploads directory exists
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

// Helper to check hive access
async function checkHiveAccess(userId: string, hiveId: string): Promise<boolean> {
  const hive = await prisma.hive.findUnique({
    where: { id: hiveId },
    select: { apiaryId: true },
  });

  if (!hive) return false;

  const userApiary = await prisma.userApiary.findUnique({
    where: {
      userId_apiaryId: { userId, apiaryId: hive.apiaryId },
    },
  });

  return !!userApiary;
}

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

  // Generate URLs (relative for local storage)
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

// POST /photos/upload - Upload photos
router.post('/upload', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const files = req.files as Express.Multer.File[];
    const { hiveId, inspectionId } = req.body;
    const captions = req.body.captions ? JSON.parse(req.body.captions) : [];

    if (!files || files.length === 0) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'No files uploaded', 400);
      return;
    }

    if (!hiveId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'hiveId is required', 400);
      return;
    }

    // Check hive access
    const hasAccess = await checkHiveAccess(userId, hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    // If inspectionId provided, verify it exists and belongs to hive
    if (inspectionId) {
      const inspection = await prisma.inspection.findUnique({
        where: { id: inspectionId },
      });

      if (!inspection || inspection.hiveId !== hiveId) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid inspection ID', 400);
        return;
      }
    }

    // Process and save all files
    const savedPhotos = await Promise.all(
      files.map(async (file, index) => {
        const photoId = uuidv4();
        const processed = await processAndSaveImage(file.buffer, photoId);

        const photo = await prisma.photo.create({
          data: {
            id: photoId,
            hiveId,
            userId,
            inspectionId: inspectionId || null,
            filePath: processed.filePath,
            url: processed.url,
            thumbnailUrl: processed.thumbnailUrl,
            fileSize: processed.fileSize,
            mimeType: 'image/jpeg',
            width: processed.width,
            height: processed.height,
            caption: captions[index] || null,
          },
        });

        return {
          id: photo.id,
          url: photo.url,
          thumbnailUrl: photo.thumbnailUrl,
          fileSize: photo.fileSize,
          mimeType: photo.mimeType,
          width: photo.width,
          height: photo.height,
          createdAt: photo.createdAt,
        };
      })
    );

    sendSuccess(res, savedPhotos, 201);
  } catch (error) {
    console.error('Upload photos error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to upload photos', 500);
  }
});

// GET /photos - List photos
router.get('/', validateQuery(listPhotosSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { hiveId, inspectionId, startDate, endDate, page, perPage } = req.query as unknown as {
      hiveId?: string;
      inspectionId?: string;
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

    // Get user's hives
    const userHives = await prisma.hive.findMany({
      where: { apiaryId: { in: apiaryIds } },
      select: { id: true },
    });
    const hiveIds = userHives.map(h => h.id);

    if (hiveId && !hiveIds.includes(hiveId)) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
      return;
    }

    if (inspectionId) {
      const inspection = await prisma.inspection.findUnique({
        where: { id: inspectionId },
        select: { hiveId: true },
      });
      if (!inspection || !hiveIds.includes(inspection.hiveId)) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this inspection', 403);
        return;
      }
    }

    const where = {
      hiveId: hiveId ? hiveId : { in: hiveIds },
      ...(inspectionId && { inspectionId }),
      ...(startDate && { createdAt: { gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { lte: new Date(endDate) } }),
    };

    const total = await prisma.photo.count({ where });

    const photos = await prisma.photo.findMany({
      where,
      include: {
        hive: {
          select: {
            id: true,
            hiveNumber: true,
          },
        },
        inspection: {
          select: {
            id: true,
            inspectionDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = photos.map(photo => ({
      id: photo.id,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl,
      hive: photo.hive,
      inspection: photo.inspection,
      caption: photo.caption,
      tags: JSON.parse(photo.tags),
      fileSize: photo.fileSize,
      dimensions: {
        width: photo.width,
        height: photo.height,
      },
      createdAt: photo.createdAt,
    }));

    sendSuccess(res, result, 200, calculatePagination(page, perPage, total));
  } catch (error) {
    console.error('List photos error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list photos', 500);
  }
});

// DELETE /photos/:id - Delete photo
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const photo = await prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Photo not found', 404);
      return;
    }

    // Check access
    const hasAccess = await checkHiveAccess(userId, photo.hiveId);
    if (!hasAccess) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this photo', 403);
      return;
    }

    // Delete files from disk
    try {
      await fs.unlink(photo.filePath);
      if (photo.thumbnailUrl) {
        const thumbPath = photo.filePath.replace('.jpg', '_thumb.jpg');
        await fs.unlink(thumbPath);
      }
    } catch (fileError) {
      console.error('Failed to delete photo files:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await prisma.photo.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    console.error('Delete photo error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete photo', 500);
  }
});

export default router;
