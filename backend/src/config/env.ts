import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_ACCESS_EXPIRY: z.string().default('1h'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),
  ALLOW_LOCAL_AGENT_AUTH: booleanFromEnv.default(false),
  CORS_ORIGINS: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  COMPLIANCE_RETENTION_YEARS: z.coerce.number().int().min(5).default(5),
  COMPLIANCE_DOCUMENT_DIR: z.string().default('uploads/compliance'),
  COMPLIANCE_MAX_FILE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

export const env = parsed.data;
