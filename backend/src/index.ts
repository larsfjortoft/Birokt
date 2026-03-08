import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';

import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalRateLimit } from './middleware/rateLimit.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { apiVersion } from './middleware/apiVersion.js';
import { startNotificationScheduler } from './services/notificationScheduler.js';
import prisma from './utils/prisma.js';
import { env } from './config/env.js';

const app = express();
const PORT = env.PORT;

// Parse and trim CORS origins from environment
const corsOrigins = env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [
  'http://localhost:3001',
  'http://localhost:19006',
];

if (env.NODE_ENV === 'production') {
  // Respect x-forwarded-* headers when running behind a reverse proxy
  app.set('trust proxy', 1);
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization (XSS protection)
app.use(sanitizeInput);

// Rate limiting
app.use(globalRateLimit);

// Add request ID to all requests
app.use((req, res, next) => {
  res.locals.requestId = uuidv4();
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness endpoint
app.get('/readyz', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

// API versioning
app.use(apiVersion);

// API routes
app.use('/api/v1', routes);

// Future: app.use('/api/v2', v2Routes);

// Serve uploaded files (for local development)
// crossOriginResourcePolicy: false allows cross-origin image loading from the frontend
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('uploads'));

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;

// Start server outside tests
if (env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Birokt API server running on http://localhost:${PORT}`);
    console.log(`API base URL: http://localhost:${PORT}/api/v1`);

    // Start notification scheduler
    startNotificationScheduler();
  });
}

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close();
  }
  await prisma.$disconnect();
  process.exit(0);
}

if (env.NODE_ENV !== 'test') {
  process.on('SIGINT', () => {
    shutdown('SIGINT').catch(() => process.exit(1));
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch(() => process.exit(1));
  });
}

export default app;