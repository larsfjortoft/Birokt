import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth';
import { initDatabase } from '../services/database';
import { registerForPushNotifications, setupNotificationListeners } from '../services/notifications';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { initSentry, logError, setUserContext } from '../lib/sentry';
import { fullSync } from '../services/syncManager';
import * as SplashScreen from 'expo-splash-screen';

initSentry();
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const { checkAuth, isLoading } = useAuthStore();
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize offline database
        await initDatabase();
        setDbInitialized(true);
        if (__DEV__) console.log('Offline database initialized');

        await checkAuth();
      } catch (e) {
        if (__DEV__) console.warn('Initialization failed:', e);
        setDbInitialized(true); // Continue anyway
      } finally {
        await SplashScreen.hideAsync();
      }
    };
    init();
  }, []);

  // Register push notifications after auth and sync Sentry user context
  const { isAuthenticated, user } = useAuthStore();
  useEffect(() => {
    if (isAuthenticated && user) {
      setUserContext(user);
      registerForPushNotifications();
      fullSync().catch((error) => {
        logError(error, { context: 'startupFullSync' });
      });
      const cleanup = setupNotificationListeners();
      return cleanup;
    } else {
      setUserContext(null);
    }
  }, [isAuthenticated, user]);

  if (isLoading || !dbInitialized) {
    return null;
  }

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <OfflineIndicator />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#f59e0b',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="apiary/[id]"
            options={{
              title: 'Bigård',
              headerBackTitle: 'Tilbake',
            }}
          />
          <Stack.Screen
            name="hive/[id]"
            options={{
              title: 'Kubedetaljer',
              headerBackTitle: 'Tilbake',
            }}
          />
          <Stack.Screen
            name="inspection/new"
            options={{
              title: 'Ny inspeksjon',
              presentation: 'modal',
              headerBackTitle: 'Avbryt',
            }}
          />
          <Stack.Screen
            name="treatment/new"
            options={{
              title: 'Ny behandling',
              presentation: 'modal',
              headerBackTitle: 'Avbryt',
            }}
          />
          <Stack.Screen
            name="feeding/new"
            options={{
              title: 'Ny foring',
              presentation: 'modal',
              headerBackTitle: 'Avbryt',
            }}
          />
          <Stack.Screen
            name="production/new"
            options={{
              title: 'Ny produksjon',
              presentation: 'modal',
              headerBackTitle: 'Avbryt',
            }}
          />
          <Stack.Screen
            name="inspection/batch"
            options={{
              title: 'Batch-inspeksjon',
              headerBackTitle: 'Avbryt',
            }}
          />
          <Stack.Screen
            name="settings/notifications"
            options={{
              title: 'Varslingsinnstillinger',
              headerBackTitle: 'Tilbake',
            }}
          />
        </Stack>
      </View>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
