import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.js';
import { cacheResponse } from '../middleware/cacheMiddleware.js';
import prisma from '../utils/prisma.js';

const router = Router();

router.use(authenticate);

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(20)).default('5'),
});

// GET /search?q=<query>&limit=5
router.get(
  '/',
  cacheResponse(30),
  validateQuery(searchQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { q, limit } = req.query as unknown as { q: string; limit: string };
      const parsedLimit = parseInt(limit as string, 10) || 5;
      const userId = req.user!.id;

      // Get user's accessible apiary IDs
      const userApiaries = await prisma.userApiary.findMany({
        where: { userId },
        select: { apiaryId: true },
      });
      const apiaryIds = userApiaries.map((ua) => ua.apiaryId);

      if (apiaryIds.length === 0) {
        sendSuccess(res, { query: q, results: { hives: [], inspections: [], treatments: [], queens: [] } });
        return;
      }

      // Get hive IDs accessible to user
      const hives = await prisma.hive.findMany({
        where: { apiaryId: { in: apiaryIds } },
        select: { id: true },
      });
      const hiveIds = hives.map((h) => h.id);

      // Run all searches in parallel
      const [hiveResults, inspectionResults, treatmentResults, queenResults] = await Promise.all([
        // Search hives by hiveNumber or notes
        prisma.hive.findMany({
          where: {
            id: { in: hiveIds },
            OR: [
              { hiveNumber: { contains: q } },
              { notes: { contains: q } },
            ],
          },
          select: {
            id: true,
            hiveNumber: true,
            status: true,
            notes: true,
            apiary: { select: { id: true, name: true } },
          },
          take: parsedLimit,
        }),

        // Search inspections by notes
        prisma.inspection.findMany({
          where: {
            hiveId: { in: hiveIds },
            notes: { contains: q },
          },
          select: {
            id: true,
            inspectionDate: true,
            notes: true,
            hive: {
              select: {
                id: true,
                hiveNumber: true,
                apiary: { select: { name: true } },
              },
            },
          },
          orderBy: { inspectionDate: 'desc' },
          take: parsedLimit,
        }),

        // Search treatments by productName or notes
        prisma.treatment.findMany({
          where: {
            hiveId: { in: hiveIds },
            OR: [
              { productName: { contains: q } },
              { notes: { contains: q } },
            ],
          },
          select: {
            id: true,
            productName: true,
            treatmentDate: true,
            notes: true,
            hive: {
              select: {
                id: true,
                hiveNumber: true,
                apiary: { select: { name: true } },
              },
            },
          },
          orderBy: { treatmentDate: 'desc' },
          take: parsedLimit,
        }),

        // Search queens by queenCode or notes — only user's own queens
        prisma.queen.findMany({
          where: {
            userId,
            OR: [
              { queenCode: { contains: q } },
              { notes: { contains: q } },
            ],
          },
          select: {
            id: true,
            queenCode: true,
            year: true,
            race: true,
            status: true,
            notes: true,
            currentHive: {
              select: {
                id: true,
                hiveNumber: true,
                apiary: { select: { name: true } },
              },
            },
          },
          take: parsedLimit,
        }),
      ]);

      sendSuccess(res, {
        query: q,
        results: {
          hives: hiveResults.map((h) => ({
            id: h.id,
            hiveNumber: h.hiveNumber,
            status: h.status,
            apiaryName: h.apiary.name,
            apiaryId: h.apiary.id,
            notes: h.notes,
          })),
          inspections: inspectionResults.map((i) => ({
            id: i.id,
            inspectionDate: i.inspectionDate,
            notes: i.notes,
            hiveId: i.hive.id,
            hiveNumber: i.hive.hiveNumber,
            apiaryName: i.hive.apiary.name,
          })),
          treatments: treatmentResults.map((t) => ({
            id: t.id,
            productName: t.productName,
            treatmentDate: t.treatmentDate,
            notes: t.notes,
            hiveId: t.hive.id,
            hiveNumber: t.hive.hiveNumber,
            apiaryName: t.hive.apiary.name,
          })),
          queens: queenResults.map((q) => ({
            id: q.id,
            queenCode: q.queenCode,
            year: q.year,
            race: q.race,
            status: q.status,
            notes: q.notes,
            hiveId: q.currentHive?.id,
            hiveNumber: q.currentHive?.hiveNumber,
            apiaryName: q.currentHive?.apiary.name,
          })),
        },
      });
    } catch (error) {
      console.error('[Search] Error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Søk feilet', 500);
    }
  }
);

export default router;
