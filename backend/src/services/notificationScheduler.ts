import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { sendToUser } from './pushNotificationService.js';
import { sendInspectionReminderEmail, sendTreatmentReminderEmail, sendWithholdingWarningEmail, sendWeeklySummaryEmail } from './emailService.js';

function isInQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const current = h * 60 + m;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  if (startMin <= endMin) {
    return current >= startMin && current < endMin;
  }
  // Crosses midnight
  return current >= startMin || current < endMin;
}

async function sendInspectionReminders(): Promise<void> {
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Get all users with their apiaries and hives
    const users = await prisma.user.findMany({
      include: {
        notificationSettings: true,
        userApiaries: {
          include: {
            apiary: {
              include: {
                hives: {
                  where: { status: 'active' },
                  include: {
                    inspections: {
                      orderBy: { inspectionDate: 'desc' },
                      take: 1,
                      select: { inspectionDate: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const user of users) {
      const settings = user.notificationSettings;
      if (settings && !settings.inspectionReminders) continue;
      if (settings && isInQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) continue;

      const hivesNeedingInspection: Array<{ hiveNumber: string; apiaryName: string; daysSinceInspection: number | string }> = [];

      for (const ua of user.userApiaries) {
        for (const hive of ua.apiary.hives) {
          const lastInspection = hive.inspections[0]?.inspectionDate;
          if (!lastInspection || lastInspection < fourteenDaysAgo) {
            const days = lastInspection
              ? Math.floor((Date.now() - lastInspection.getTime()) / 86400000)
              : 'mange';

            await sendToUser(
              user.id,
              'Inspeksjonspåminnelse',
              `Kube ${hive.hiveNumber} i ${ua.apiary.name} har ikke blitt inspisert på ${days} dager`,
              { type: 'inspection_reminder', hiveId: hive.id }
            );

            hivesNeedingInspection.push({
              hiveNumber: hive.hiveNumber,
              apiaryName: ua.apiary.name,
              daysSinceInspection: days,
            });
          }
        }
      }

      // Send email summary if user has email notifications enabled
      const emailEnabled = !settings || settings.emailNotifications !== false;
      if (emailEnabled && hivesNeedingInspection.length > 0) {
        sendInspectionReminderEmail(user.email, user.name, hivesNeedingInspection).catch(() => {});
      }
    }

    console.log('[Scheduler] Inspection reminders sent');
  } catch (error) {
    console.error('[Scheduler] Inspection reminder error:', error);
  }
}

async function sendTreatmentReminders(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const treatments = await prisma.treatment.findMany({
      where: {
        withholdingEndDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        hive: {
          include: {
            apiary: { select: { name: true } },
          },
        },
        user: {
          include: { notificationSettings: true },
        },
      },
    });

    // Group treatments by user for email
    const treatmentsByUser = new Map<string, {
      user: typeof treatments[0]['user'];
      items: Array<{ productName: string; hiveNumber: string; apiaryName: string }>;
    }>();

    for (const treatment of treatments) {
      const settings = treatment.user.notificationSettings;
      if (settings && !settings.treatmentReminders) continue;
      if (settings && isInQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) continue;

      await sendToUser(
        treatment.userId,
        'Tilbakeholdelse utløper',
        `Tilbakeholdelsesperiode for ${treatment.productName} i kube ${treatment.hive.hiveNumber} utløper i dag`,
        { type: 'treatment_withholding', hiveId: treatment.hiveId }
      );

      // Collect for email
      if (!treatmentsByUser.has(treatment.userId)) {
        treatmentsByUser.set(treatment.userId, { user: treatment.user, items: [] });
      }
      treatmentsByUser.get(treatment.userId)!.items.push({
        productName: treatment.productName,
        hiveNumber: treatment.hive.hiveNumber,
        apiaryName: treatment.hive.apiary.name,
      });
    }

    // Send email summaries
    for (const [, { user, items }] of treatmentsByUser) {
      const emailEnabled = !user.notificationSettings || user.notificationSettings.emailNotifications !== false;
      if (emailEnabled && items.length > 0) {
        sendTreatmentReminderEmail(user.email, user.name, items).catch(() => {});
      }
    }

    console.log('[Scheduler] Treatment reminders sent');
  } catch (error) {
    console.error('[Scheduler] Treatment reminder error:', error);
  }
}

async function sendWeatherAlerts(): Promise<void> {
  try {
    const apiaries = await prisma.apiary.findMany({
      where: {
        active: true,
        locationLat: { not: null },
        locationLng: { not: null },
      },
      include: {
        userApiaries: {
          include: {
            user: {
              include: { notificationSettings: true },
            },
          },
        },
      },
    });

    for (const apiary of apiaries) {
      if (!apiary.locationLat || !apiary.locationLng) continue;

      try {
        const response = await fetch(
          `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${apiary.locationLat}&lon=${apiary.locationLng}`,
          {
            headers: {
              'User-Agent': 'Birøkt/1.0 github.com/birokt',
            },
          }
        );

        if (!response.ok) continue;

        const data = await response.json() as { properties?: { timeseries?: Array<{ data?: { instant?: { details?: { air_temperature?: number; wind_speed?: number } } } }> } };
        const timeseries = data?.properties?.timeseries;
        if (!timeseries || timeseries.length === 0) continue;

        // Check next 24 hours
        const alerts: string[] = [];
        const next24h = timeseries.slice(0, 24);

        for (const entry of next24h) {
          const details = entry.data?.instant?.details;
          if (!details) continue;

          const temp = details.air_temperature;
          const wind = details.wind_speed;

          if (temp !== undefined && temp < 5) {
            alerts.push(`Lav temperatur: ${temp}°C`);
            break;
          }
          if (temp !== undefined && temp > 35) {
            alerts.push(`Høy temperatur: ${temp}°C`);
            break;
          }
          if (wind !== undefined && wind > 15) {
            alerts.push(`Sterk vind: ${wind} m/s`);
            break;
          }
        }

        if (alerts.length === 0) continue;

        for (const ua of apiary.userApiaries) {
          const settings = ua.user.notificationSettings;
          if (settings && !settings.weatherAlerts) continue;
          if (settings && isInQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) continue;

          await sendToUser(
            ua.userId,
            'Værvarsel',
            `Ekstremvær forventet i ${apiary.name}: ${alerts.join(', ')}`,
            { type: 'weather_alert', apiaryId: apiary.id }
          );
        }
      } catch (fetchError) {
        console.error(`[Scheduler] Weather fetch error for apiary ${apiary.id}:`, fetchError);
      }
    }

    console.log('[Scheduler] Weather alerts sent');
  } catch (error) {
    console.error('[Scheduler] Weather alert error:', error);
  }
}

async function send7DayWithholdingReminders(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    const in8Days = new Date(today);
    in8Days.setDate(in8Days.getDate() + 8);

    const treatments = await prisma.treatment.findMany({
      where: {
        withholdingEndDate: {
          gte: in7Days,
          lt: in8Days,
        },
      },
      include: {
        hive: {
          include: {
            apiary: { select: { name: true } },
          },
        },
        user: {
          include: { notificationSettings: true },
        },
      },
    });

    const treatmentsByUser = new Map<string, {
      user: typeof treatments[0]['user'];
      items: Array<{ productName: string; hiveNumber: string; apiaryName: string; daysRemaining: number }>;
    }>();

    for (const treatment of treatments) {
      const settings = treatment.user.notificationSettings;
      if (settings && !settings.treatmentReminders) continue;
      if (settings && isInQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) continue;

      await sendToUser(
        treatment.userId,
        'Tilbakeholdelse utløper snart',
        `Tilbakeholdelsesperiode for ${treatment.productName} i kube ${treatment.hive.hiveNumber} utløper om 7 dager`,
        { type: 'treatment_withholding_warning', hiveId: treatment.hiveId }
      );

      if (!treatmentsByUser.has(treatment.userId)) {
        treatmentsByUser.set(treatment.userId, { user: treatment.user, items: [] });
      }
      treatmentsByUser.get(treatment.userId)!.items.push({
        productName: treatment.productName,
        hiveNumber: treatment.hive.hiveNumber,
        apiaryName: treatment.hive.apiary.name,
        daysRemaining: 7,
      });
    }

    for (const [, { user, items }] of treatmentsByUser) {
      const emailEnabled = !user.notificationSettings || user.notificationSettings.emailNotifications !== false;
      if (emailEnabled && items.length > 0) {
        sendWithholdingWarningEmail(user.email, user.name, items).catch(() => {});
      }
    }

    console.log('[Scheduler] 7-day withholding reminders sent');
  } catch (error) {
    console.error('[Scheduler] 7-day withholding reminder error:', error);
  }
}

async function sendWeeklySummary(): Promise<void> {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
    const thisYear = now.getFullYear();
    const startOfYear = new Date(thisYear, 0, 1);

    const users = await prisma.user.findMany({
      include: {
        notificationSettings: true,
        userApiaries: {
          include: {
            apiary: {
              include: {
                hives: {
                  where: { status: 'active' },
                  include: {
                    inspections: {
                      orderBy: { inspectionDate: 'desc' },
                      take: 1,
                      select: { inspectionDate: true },
                    },
                    treatments: {
                      where: {
                        withholdingEndDate: { gt: now },
                      },
                      select: { id: true },
                    },
                  },
                },
                productions: {
                  where: {
                    harvestDate: { gte: startOfYear },
                    productType: 'honey',
                  },
                  select: { amountKg: true },
                },
              },
            },
          },
        },
      },
    });

    for (const user of users) {
      const settings = user.notificationSettings;
      const emailEnabled = !settings || settings.emailNotifications !== false;
      if (!emailEnabled) continue;

      // Check if user has had any inspections this past week
      let hasRecentActivity = false;
      for (const ua of user.userApiaries) {
        for (const hive of ua.apiary.hives) {
          if (hive.inspections[0]?.inspectionDate && hive.inspections[0].inspectionDate >= oneWeekAgo) {
            hasRecentActivity = true;
            break;
          }
        }
        if (hasRecentActivity) break;
      }
      if (!hasRecentActivity) continue;

      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
      const apiaries = user.userApiaries.map((ua) => {
        const activeHives = ua.apiary.hives.length;
        const hivesNeedingInspection = ua.apiary.hives.filter((h) => {
          const last = h.inspections[0]?.inspectionDate;
          return !last || last < fourteenDaysAgo;
        }).length;
        const activeWithholdings = ua.apiary.hives.reduce(
          (sum, h) => sum + h.treatments.length,
          0
        );
        const honeyKgThisYear = ua.apiary.productions.reduce(
          (sum, p) => sum + (p.amountKg || 0),
          0
        );
        return { name: ua.apiary.name, activeHives, hivesNeedingInspection, activeWithholdings, honeyKgThisYear };
      });

      if (apiaries.length > 0) {
        sendWeeklySummaryEmail(user.email, user.name, { apiaries }).catch(() => {});
      }
    }

    console.log('[Scheduler] Weekly summary sent');
  } catch (error) {
    console.error('[Scheduler] Weekly summary error:', error);
  }
}

async function cleanupExpiredRefreshTokens(): Promise<void> {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    console.log(`[Scheduler] Cleaned up ${result.count} expired refresh tokens`);
  } catch (error) {
    console.error('[Scheduler] Refresh token cleanup error:', error);
  }
}

async function cleanupInactivePushTokens(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000);
    const result = await prisma.pushToken.deleteMany({
      where: { active: false, updatedAt: { lt: cutoff } },
    });
    console.log(`[Scheduler] Cleaned up ${result.count} inactive push tokens`);
  } catch (error) {
    console.error('[Scheduler] Push token cleanup error:', error);
  }
}

export function startNotificationScheduler(): void {
  // Inspection reminders - daily at 09:00
  cron.schedule('0 9 * * *', sendInspectionReminders);

  // Treatment reminders - daily at 09:00
  cron.schedule('0 9 * * *', sendTreatmentReminders);

  // Weather alerts - daily at 07:00
  cron.schedule('0 7 * * *', sendWeatherAlerts);

  // 7-day withholding reminders - daily at 09:00
  cron.schedule('0 9 * * *', send7DayWithholdingReminders);

  // Weekly summary - Sunday at 08:00
  cron.schedule('0 8 * * 0', sendWeeklySummary);

  // Cleanup expired refresh tokens - weekly on Sunday at 02:00
  cron.schedule('0 2 * * 0', cleanupExpiredRefreshTokens);

  // Cleanup inactive push tokens (>90 days) - daily at 03:00
  cron.schedule('0 3 * * *', cleanupInactivePushTokens);

  console.log('[Scheduler] Notification scheduler started');
}
