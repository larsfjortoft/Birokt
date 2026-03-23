import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

router.use(authenticate);

// Validation schemas
const createJournalSchema = z.object({
  entryDate: z.string(),
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1),
  category: z.enum(['general', 'weather', 'bloom', 'bees', 'harvest', 'observation', 'other']).default('general'),
  tags: z.array(z.string().trim()).default([]),
  mood: z.enum(['positive', 'neutral', 'negative']).optional(),
  temperature: z.number().optional(),
});

const updateJournalSchema = z.object({
  entryDate: z.string().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string().trim().min(1).optional(),
  category: z.enum(['general', 'weather', 'bloom', 'bees', 'harvest', 'observation', 'other']).optional(),
  tags: z.array(z.string().trim()).optional(),
  mood: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
  temperature: z.number().nullable().optional(),
});

const listJournalSchema = z.object({
  category: z.enum(['general', 'weather', 'bloom', 'bees', 'harvest', 'observation', 'other']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// GET /journal - List journal entries
router.get('/', validateQuery(listJournalSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { category, startDate, endDate, search, page, perPage } = req.query as unknown as {
      category?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page: number;
      perPage: number;
    };

    const where: Record<string, unknown> = { userId };

    if (category) where.category = category;

    if (startDate || endDate) {
      where.entryDate = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const total = await prisma.journalEntry.count({ where });

    const entries = await prisma.journalEntry.findMany({
      where,
      orderBy: { entryDate: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = entries.map(e => ({
      id: e.id,
      entryDate: e.entryDate,
      title: e.title,
      content: e.content,
      category: e.category,
      tags: JSON.parse(e.tags),
      mood: e.mood,
      temperature: e.temperature,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    sendSuccess(res, result, 200, calculatePagination(page, perPage, total));
  } catch (error) {
    console.error('List journal entries error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list journal entries', 500);
  }
});

// POST /journal - Create journal entry
router.post('/', validateBody(createJournalSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { entryDate, title, content, category, tags, mood, temperature } = req.body;

    const entry = await prisma.journalEntry.create({
      data: {
        userId,
        entryDate: new Date(entryDate),
        title,
        content,
        category,
        tags: JSON.stringify(tags),
        mood,
        temperature,
      },
    });

    sendSuccess(res, {
      id: entry.id,
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: JSON.parse(entry.tags),
      mood: entry.mood,
      temperature: entry.temperature,
      createdAt: entry.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create journal entry error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create journal entry', 500);
  }
});

// GET /journal/:id - Get single journal entry
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const entry = await prisma.journalEntry.findUnique({ where: { id } });

    if (!entry) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Journal entry not found', 404);
      return;
    }

    if (entry.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this entry', 403);
      return;
    }

    sendSuccess(res, {
      id: entry.id,
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: JSON.parse(entry.tags),
      mood: entry.mood,
      temperature: entry.temperature,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  } catch (error) {
    console.error('Get journal entry error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get journal entry', 500);
  }
});

// PUT /journal/:id - Update journal entry
router.put('/:id', validateParams(idParamSchema), validateBody(updateJournalSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { entryDate, title, content, category, tags, mood, temperature } = req.body;

    const existing = await prisma.journalEntry.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Journal entry not found', 404);
      return;
    }

    if (existing.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this entry', 403);
      return;
    }

    const entry = await prisma.journalEntry.update({
      where: { id },
      data: {
        ...(entryDate !== undefined && { entryDate: new Date(entryDate) }),
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        ...(mood !== undefined && { mood }),
        ...(temperature !== undefined && { temperature }),
      },
    });

    sendSuccess(res, {
      id: entry.id,
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: JSON.parse(entry.tags),
      mood: entry.mood,
      temperature: entry.temperature,
      updatedAt: entry.updatedAt,
    });
  } catch (error) {
    console.error('Update journal entry error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update journal entry', 500);
  }
});

// DELETE /journal/:id
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const entry = await prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Journal entry not found', 404);
      return;
    }

    if (entry.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this entry', 403);
      return;
    }

    await prisma.journalEntry.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete journal entry error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete journal entry', 500);
  }
});

export default router;
