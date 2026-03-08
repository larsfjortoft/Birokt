import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { notificationsApi } from '../lib/api';
import { logError } from '../lib/sentry';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    if (__DEV__) console.log('Push notifications require a physical device');
    return;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) console.log('Push notification permission not granted');
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      if (__DEV__) console.log('No EAS projectId configured — push notifications disabled in development');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    await notificationsApi.registerToken({
      token: tokenData.data,
      platform: Platform.OS,
    });

    if (__DEV__) console.log('Push token registered:', tokenData.data);
  } catch (error) {
    logError(error, { context: 'registerForPushNotifications' });
  }
}

export function setupNotificationListeners(): () => void {
  // Handle notification tap (when app is in background/closed)
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;

      if (!data?.type) return;

      switch (data.type) {
        case 'inspection_reminder':
        case 'treatment_withholding':
          if (data.hiveId) {
            router.push(`/hive/${data.hiveId}`);
          }
          break;
        case 'weather_alert':
          if (data.apiaryId) {
            router.push(`/apiary/${data.apiaryId}`);
          }
          break;
      }
    }
  );

  return () => {
    responseSubscription.remove();
  };
}
