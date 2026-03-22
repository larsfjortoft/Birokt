import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes, calculatePagination } from '../utils/response.js';
import prisma from '../utils/prisma.js';
import { pushToGoogle, deleteFromGoogle, pullFromGoogle, isEnabled as isGoogleEnabled } from '../services/googleCalendar.js';

const router = Router();

router.use(authenticate);

// Event types
const eventTypes = ['visit', 'feeding', 'queen_breeding', 'treatment', 'harvest', 'meeting', 'other'] as const;

// Validation schemas
const createEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().optional(),
  eventDate: z.string(),
  endDate: z.string().optional(),
  eventType: z.enum(eventTypes),
  allDay: z.boolean().default(true),
  color: z.string().trim().optional(),
  apiaryId: z.string().uuid().optional(),
  hiveId: z.string().uuid().optional(),
  notes: z.string().trim().optional(),
});

const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().optional(),
  eventDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  eventType: z.enum(eventTypes).optional(),
  allDay: z.boolean().optional(),
  color: z.string().trim().nullable().optional(),
  apiaryId: z.string().uuid().nullable().optional(),
  hiveId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  completed: z.boolean().optional(),
});

const listEventsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  eventType: z.enum(eventTypes).optional(),
  apiaryId: z.string().uuid().optional(),
  hiveId: z.string().uuid().optional(),
  completed: z.enum(['true', 'false']).optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  perPage: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('50'),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// Helper to check apiary access
async function checkApiaryAccess(userId: string, apiaryId: string): Promise<boolean> {
  const userApiary = await prisma.userApiary.findUnique({
    where: { userId_apiaryId: { userId, apiaryId } },
  });
  return !!userApiary;
}

// Helper to check hive access
async function checkHiveAccess(userId: string, hiveId: string): Promise<boolean> {
  const hive = await prisma.hive.findUnique({
    where: { id: hiveId },
    select: { apiaryId: true },
  });
  if (!hive) return false;

  return checkApiaryAccess(userId, hive.apiaryId);
}

// GET /calendar/sync/status - Check if Google Calendar is configured
router.get('/sync/status', async (_req: Request, res: Response) => {
  sendSuccess(res, { enabled: isGoogleEnabled() });
});

// POST /calendar/sync - Sync with Google Calendar (pull from Google)
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    if (!isGoogleEnabled()) {
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Google Calendar integration is not configured', 400);
      return;
    }

    const stats = await pullFromGoogle(userId);
    sendSuccess(res, {
      message: 'Synkronisering fullført',
      ...stats,
    });
  } catch (error) {
    console.error('Calendar sync error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to sync with Google Calendar', 500);
  }
});

// GET /calendar - List events
router.get('/', validateQuery(listEventsSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate, eventType, apiaryId, hiveId, completed, page, perPage } = req.query as unknown as {
      startDate?: string;
      endDate?: string;
      eventType?: string;
      apiaryId?: string;
      hiveId?: string;
      completed?: string;
      page: number;
      perPage: number;
    };

    const where: Record<string, unknown> = { userId };

    if (eventType) where.eventType = eventType;
    if (apiaryId) where.apiaryId = apiaryId;
    if (hiveId) where.hiveId = hiveId;
    if (completed !== undefined) where.completed = completed === 'true';

    if (startDate || endDate) {
      where.eventDate = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    const total = await prisma.calendarEvent.count({ where });

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        apiary: { select: { id: true, name: true } },
        hive: {
          select: {
            id: true,
            hiveNumber: true,
            apiary: { select: { name: true } },
          },
        },
      },
      orderBy: { eventDate: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    const result = events.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      eventDate: e.eventDate,
      endDate: e.endDate,
      eventType: e.eventType,
      allDay: e.allDay,
      color: e.color,
      apiary: e.apiary ? { id: e.apiary.id, name: e.apiary.name } : null,
      hive: e.hive ? { id: e.hive.id, hiveNumber: e.hive.hiveNumber, apiaryName: e.hive.apiary.name } : null,
      notes: e.notes,
      completed: e.completed,
      createdAt: e.createdAt,
    }));

    sendSuccess(res, result, 200, calculatePagination(page, perPage, total));
  } catch (error) {
    console.error('List calendar events error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to list calendar events', 500);
  }
});

// POST /calendar - Create event
router.post('/', validateBody(createEventSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, description, eventDate, endDate, eventType, allDay, color, apiaryId, hiveId, notes } = req.body;

    // Validate access to apiary/hive if provided
    if (apiaryId) {
      const hasAccess = await checkApiaryAccess(userId, apiaryId);
      if (!hasAccess) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this apiary', 403);
        return;
      }
    }
    if (hiveId) {
      const hasAccess = await checkHiveAccess(userId, hiveId);
      if (!hasAccess) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
        return;
      }
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId,
        title,
        description,
        eventDate: new Date(eventDate),
        endDate: endDate ? new Date(endDate) : undefined,
        eventType,
        allDay,
        color,
        apiaryId,
        hiveId,
        notes,
      },
    });

    // Sync to Google Calendar (fire-and-forget)
    pushToGoogle(event.id).catch(err => console.error('Google sync error:', err));

    sendSuccess(res, {
      id: event.id,
      title: event.title,
      eventDate: event.eventDate,
      eventType: event.eventType,
      createdAt: event.createdAt,
    }, 201);
  } catch (error) {
    console.error('Create calendar event error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create calendar event', 500);
  }
});

// GET /calendar/:id - Get single event
router.get('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        apiary: { select: { id: true, name: true } },
        hive: {
          select: {
            id: true,
            hiveNumber: true,
            apiary: { select: { name: true } },
          },
        },
      },
    });

    if (!event) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Calendar event not found', 404);
      return;
    }

    if (event.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this event', 403);
      return;
    }

    sendSuccess(res, {
      id: event.id,
      title: event.title,
      description: event.description,
      eventDate: event.eventDate,
      endDate: event.endDate,
      eventType: event.eventType,
      allDay: event.allDay,
      color: event.color,
      apiary: event.apiary ? { id: event.apiary.id, name: event.apiary.name } : null,
      hive: event.hive ? { id: event.hive.id, hiveNumber: event.hive.hiveNumber, apiaryName: event.hive.apiary.name } : null,
      notes: event.notes,
      completed: event.completed,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    });
  } catch (error) {
    console.error('Get calendar event error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get calendar event', 500);
  }
});

// PUT /calendar/:id - Update event
router.put('/:id', validateParams(idParamSchema), validateBody(updateEventSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { title, description, eventDate, endDate, eventType, allDay, color, apiaryId, hiveId, notes, completed } = req.body;

    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Calendar event not found', 404);
      return;
    }

    if (existing.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this event', 403);
      return;
    }

    // Validate access to new apiary/hive if being changed
    if (apiaryId !== undefined && apiaryId !== null) {
      const hasAccess = await checkApiaryAccess(userId, apiaryId);
      if (!hasAccess) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this apiary', 403);
        return;
      }
    }
    if (hiveId !== undefined && hiveId !== null) {
      const hasAccess = await checkHiveAccess(userId, hiveId);
      if (!hasAccess) {
        sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this hive', 403);
        return;
      }
    }

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(eventType !== undefined && { eventType }),
        ...(allDay !== undefined && { allDay }),
        ...(color !== undefined && { color }),
        ...(apiaryId !== undefined && { apiaryId }),
        ...(hiveId !== undefined && { hiveId }),
        ...(notes !== undefined && { notes }),
        ...(completed !== undefined && { completed }),
      },
    });

    // Sync to Google Calendar (fire-and-forget)
    pushToGoogle(event.id).catch(err => console.error('Google sync error:', err));

    sendSuccess(res, { id: event.id, updatedAt: event.updatedAt });
  } catch (error) {
    console.error('Update calendar event error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update calendar event', 500);
  }
});

// PATCH /calendar/:id/complete - Toggle completed status
router.patch('/:id/complete', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Calendar event not found', 404);
      return;
    }

    if (existing.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this event', 403);
      return;
    }

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: { completed: !existing.completed },
    });

    // Sync to Google Calendar (fire-and-forget)
    pushToGoogle(event.id).catch(err => console.error('Google sync error:', err));

    sendSuccess(res, { id: event.id, completed: event.completed, updatedAt: event.updatedAt });
  } catch (error) {
    console.error('Toggle calendar event complete error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to toggle calendar event', 500);
  }
});

// DELETE /calendar/:id
router.delete('/:id', validateParams(idParamSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const event = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) {
      sendError(res, ErrorCodes.NOT_FOUND, 'Calendar event not found', 404);
      return;
    }

    if (event.userId !== userId) {
      sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this event', 403);
      return;
    }

    // Delete from Google Calendar
    if (event.googleEventId) {
      deleteFromGoogle(event.googleEventId).catch(err => console.error('Google delete error:', err));
    }

    await prisma.calendarEvent.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete calendar event error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete calendar event', 500);
  }
});

export default router;
