import { google, calendar_v3 } from 'googleapis';
import prisma from '../utils/prisma.js';
import path from 'path';
import fs from 'fs';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '';
const CREDENTIALS_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || '';

// Event type colors in Google Calendar (colorId 1-11)
const eventTypeColorMap: Record<string, string> = {
  visit: '9',       // blueberry (blue)
  feeding: '10',    // basil (green)
  queen_breeding: '3', // grape (purple)
  treatment: '11',  // tomato (red)
  harvest: '5',     // banana (yellow)
  meeting: '7',     // lavender (indigo)
  other: '8',       // graphite (gray)
};

let calendarClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar | null {
  if (calendarClient) return calendarClient;

  if (!CALENDAR_ID || !CREDENTIALS_PATH) {
    return null;
  }

  try {
    const credPath = path.resolve(CREDENTIALS_PATH);
    if (!fs.existsSync(credPath)) {
      console.warn('Google Calendar credentials file not found:', credPath);
      return null;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    calendarClient = google.calendar({ version: 'v3', auth });
    return calendarClient;
  } catch (error) {
    console.error('Failed to initialize Google Calendar client:', error);
    return null;
  }
}

function isEnabled(): boolean {
  return !!getCalendarClient();
}

// Build event description with Birøkt metadata
function buildDescription(event: {
  eventType: string;
  description?: string | null;
  notes?: string | null;
  apiaryName?: string | null;
  hiveName?: string | null;
}): string {
  const parts: string[] = [];

  if (event.description) parts.push(event.description);

  const meta: string[] = [];
  if (event.apiaryName) meta.push(`Bigård: ${event.apiaryName}`);
  if (event.hiveName) meta.push(`Kube: ${event.hiveName}`);
  if (meta.length > 0) parts.push(meta.join('\n'));

  if (event.notes) parts.push(`Notater: ${event.notes}`);

  parts.push(`[Birøkt: ${event.eventType}]`);

  return parts.join('\n\n');
}

// Parse event type from Google Calendar description
function parseEventType(description: string | null | undefined): string {
  if (!description) return 'other';
  const match = description.match(/\[Birøkt: (\w+)\]/);
  return match ? match[1] : 'other';
}

// Push a Birøkt event to Google Calendar
export async function pushToGoogle(eventId: string): Promise<string | null> {
  const client = getCalendarClient();
  if (!client) return null;

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      apiary: { select: { name: true } },
      hive: {
        select: {
          hiveNumber: true,
          apiary: { select: { name: true } },
        },
      },
    },
  });

  if (!event) return null;

  const googleEvent: calendar_v3.Schema$Event = {
    summary: event.title,
    description: buildDescription({
      eventType: event.eventType,
      description: event.description,
      notes: event.notes,
      apiaryName: event.apiary?.name || null,
      hiveName: event.hive ? `${event.hive.hiveNumber} (${event.hive.apiary.name})` : null,
    }),
    colorId: eventTypeColorMap[event.eventType] || '8',
    start: event.allDay
      ? { date: event.eventDate.toISOString().slice(0, 10) }
      : { dateTime: event.eventDate.toISOString(), timeZone: 'Europe/Oslo' },
    end: event.endDate
      ? event.allDay
        ? { date: event.endDate.toISOString().slice(0, 10) }
        : { dateTime: event.endDate.toISOString(), timeZone: 'Europe/Oslo' }
      : event.allDay
        ? { date: event.eventDate.toISOString().slice(0, 10) }
        : { dateTime: event.eventDate.toISOString(), timeZone: 'Europe/Oslo' },
    status: event.completed ? 'cancelled' : 'confirmed',
  };

  try {
    if (event.googleEventId) {
      // Update existing
      const res = await client.events.update({
        calendarId: CALENDAR_ID,
        eventId: event.googleEventId,
        requestBody: googleEvent,
      });
      return res.data.id || null;
    } else {
      // Create new
      const res = await client.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: googleEvent,
      });
      const googleId = res.data.id;
      if (googleId) {
        await prisma.calendarEvent.update({
          where: { id: eventId },
          data: { googleEventId: googleId },
        });
      }
      return googleId || null;
    }
  } catch (error) {
    console.error('Failed to push event to Google Calendar:', error);
    return null;
  }
}

// Delete a Birøkt event from Google Calendar
export async function deleteFromGoogle(googleEventId: string): Promise<boolean> {
  const client = getCalendarClient();
  if (!client || !googleEventId) return false;

  try {
    await client.events.delete({
      calendarId: CALENDAR_ID,
      eventId: googleEventId,
    });
    return true;
  } catch (error) {
    console.error('Failed to delete event from Google Calendar:', error);
    return false;
  }
}

// Pull events from Google Calendar into Birøkt
export async function pullFromGoogle(userId: string): Promise<{
  created: number;
  updated: number;
  deleted: number;
}> {
  const client = getCalendarClient();
  if (!client) return { created: 0, updated: 0, deleted: 0 };

  const stats = { created: 0, updated: 0, deleted: 0 };

  try {
    // Fetch events from the last 30 days to 90 days ahead
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    const res = await client.events.list({
      calendarId: CALENDAR_ID,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const googleEvents = res.data.items || [];
    const googleEventIds = new Set<string>();

    for (const gEvent of googleEvents) {
      if (!gEvent.id || !gEvent.summary) continue;
      googleEventIds.add(gEvent.id);

      const isAllDay = !!gEvent.start?.date;
      const eventDate = isAllDay
        ? new Date(gEvent.start!.date!)
        : new Date(gEvent.start!.dateTime!);
      const endDate = gEvent.end
        ? isAllDay
          ? new Date(gEvent.end.date!)
          : new Date(gEvent.end.dateTime!)
        : null;

      const eventType = parseEventType(gEvent.description);

      // Check if we already have this event
      const existing = await prisma.calendarEvent.findUnique({
        where: { googleEventId: gEvent.id },
      });

      if (existing) {
        // Update if Google event was modified after our record
        const googleUpdated = gEvent.updated ? new Date(gEvent.updated) : new Date();
        if (googleUpdated > existing.updatedAt) {
          await prisma.calendarEvent.update({
            where: { id: existing.id },
            data: {
              title: gEvent.summary,
              eventDate,
              endDate,
              allDay: isAllDay,
              completed: gEvent.status === 'cancelled',
            },
          });
          stats.updated++;
        }
      } else {
        // Create new local event from Google
        await prisma.calendarEvent.create({
          data: {
            userId,
            title: gEvent.summary,
            description: gEvent.description?.replace(/\n\n\[Birøkt: \w+\]$/, '') || null,
            eventDate,
            endDate,
            eventType,
            allDay: isAllDay,
            googleEventId: gEvent.id,
            completed: gEvent.status === 'cancelled',
          },
        });
        stats.created++;
      }
    }

    // Mark events deleted from Google as completed (soft delete)
    const localEventsWithGoogleId = await prisma.calendarEvent.findMany({
      where: {
        userId,
        googleEventId: { not: null },
        completed: false,
        eventDate: { gte: timeMin, lte: timeMax },
      },
    });

    for (const local of localEventsWithGoogleId) {
      if (local.googleEventId && !googleEventIds.has(local.googleEventId)) {
        await prisma.calendarEvent.update({
          where: { id: local.id },
          data: { completed: true },
        });
        stats.deleted++;
      }
    }

    return stats;
  } catch (error) {
    console.error('Failed to pull events from Google Calendar:', error);
    return stats;
  }
}

export { isEnabled };
