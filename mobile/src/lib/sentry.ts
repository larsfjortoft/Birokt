import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(): void {
  if (!SENTRY_DSN) {
    if (__DEV__) console.log('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
  });
}

export function logError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    console.error('Error:', error, context);
  }

  if (SENTRY_DSN) {
    if (context) {
      Sentry.withScope((scope) => {
        scope.setExtras(context);
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  }
}

export function setUserContext(user: { id: string; email: string; name: string } | null): void {
  if (!SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, username: user.name });
  } else {
    Sentry.setUser(null);
  }
}
