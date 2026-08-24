import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';

const SECRET_KEYS = /password|token|secret|authorization|cookie/i;

export function addCalendarYears(value: Date, years = env.COMPLIANCE_RETENTION_YEARS): Date {
  const result = new Date(value);
  const month = result.getUTCMonth();
  result.setUTCFullYear(result.getUTCFullYear() + years);
  if (result.getUTCMonth() !== month) result.setUTCDate(0);
  return result;
}

export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, child]) =>
      SECRET_KEYS.test(key) ? [] : [[key, sanitizeAuditValue(child)]]));
  }
  return value;
}

export function auditData(input: {
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  requestId?: string;
}): Prisma.AuditLogUncheckedCreateInput {
  return {
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    beforeJson: input.before === undefined ? null : JSON.stringify(sanitizeAuditValue(input.before)),
    afterJson: input.after === undefined ? null : JSON.stringify(sanitizeAuditValue(input.after)),
    reason: input.reason,
    requestId: input.requestId,
  };
}

export function stableRequestHash(body: unknown): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)]));
    }
    return value;
  };
  return createHash('sha256').update(JSON.stringify(normalize(body))).digest('hex');
}

export function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
