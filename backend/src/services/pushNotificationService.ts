import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import prisma from '../utils/prisma.js';

const expo = new Expo();

export async function sendToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId, active: true },
  });

  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = [];

  for (const t of tokens) {
    if (!Expo.isExpoPushToken(t.token)) {
      console.warn(`Invalid Expo push token: ${t.token}`);
      await prisma.pushToken.update({
        where: { id: t.id },
        data: { active: false },
      });
      continue;
    }

    messages.push({
      to: t.token,
      sound: 'default',
      title,
      body,
      data,
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'error') {
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const failedToken = (chunk[i].to as string);
            await prisma.pushToken.updateMany({
              where: { token: failedToken },
              data: { active: false },
            });
          }
          console.error('Push notification error:', ticket.message);
        }
      }
    } catch (error) {
      console.error('Failed to send push notifications:', error);
    }
  }
}
