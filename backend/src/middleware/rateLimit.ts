import rateLimit from 'express-rate-limit';

// Global rate limit: 100 requests per minute
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'For mange foresporsler. Prov igjen om litt.',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'rate-limited',
    },
  },
});

// Auth rate limit: 30 requests per minute (login, register)
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'For mange innloggingsforsok. Prov igjen om litt.',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'rate-limited',
    },
  },
});
