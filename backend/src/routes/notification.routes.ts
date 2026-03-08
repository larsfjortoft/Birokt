import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const router = Router();

router.use(authenticate);

// Validation schemas
const registerTokenSchema = z.object({
  token: z.string().trim().min(1),
  platform: z.string().trim().min(1),
});

const updateSettingsSchema = z.object({
  inspectionReminders: z.boolean().optional(),
  treatmentReminders: z.boolean().optional(),
  weatherAlerts: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  quietHoursStart: z.string().trim().nullable().optional(),
  quietHoursEnd: z.string().trim().nullable().optional(),
});

// POST /notifications/register-token
router.post('/register-token', validateBody(registerTokenSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token, platform } = req.body;

    await prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform, active: true },
      update: { userId, platform, active: true },
    });

    sendSuccess(res, { registered: true }, 200);
  } catch (error) {
    console.error('Register push token error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to register push token', 500);
  }
});

// DELETE /notifications/token
router.delete('/token', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.pushToken.updateMany({
      where: { userId },
      data: { active: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Remove push token error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to remove push token', 500);
  }
});

// GET /notifications/settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    let settings = await prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { userId },
      });
    }

    sendSuccess(res, {
      inspectionReminders: settings.inspectionReminders,
      treatmentReminders: settings.treatmentReminders,
      weatherAlerts: settings.weatherAlerts,
      emailNotifications: settings.emailNotifications,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get notification settings', 500);
  }
});

// PUT /notifications/settings
router.put('/settings', validateBody(updateSettingsSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = req.body;

    const settings = await prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    sendSuccess(res, {
      inspectionReminders: settings.inspectionReminders,
      treatmentReminders: settings.treatmentReminders,
      weatherAlerts: settings.weatherAlerts,
      emailNotifications: settings.emailNotifications,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update notification settings', 500);
  }
});

export default router;
