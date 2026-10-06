import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { auditData } from './complianceService.js';

export const createFeedingSchema = z.object({
  hiveId: z.string().uuid(), feedingDate: z.string().datetime(),
  feedType: z.enum(['sugar_syrup', 'sugar_dough', 'fondant', 'ready_feed', 'pollen_patty', 'pollen_substitute', 'honey', 'other']),
  amountKg: z.number().positive().max(100), sugarConcentration: z.number().min(0).max(100).optional(),
  reason: z.enum(['spring_buildup', 'spring_stimulation', 'winter_prep', 'emergency', 'nuc_support', 'stimulation', 'other']).optional(),
  notes: z.string().trim().optional(),
});

export async function createFeeding(tx: Prisma.TransactionClient, userId: string, input: unknown) {
  const data = createFeedingSchema.parse(input);
  const hive = await tx.hive.findUnique({ where: { id: data.hiveId } });
  const access = hive && await tx.userApiary.findUnique({ where: { userId_apiaryId: { userId, apiaryId: hive.apiaryId } } });
  if (!access || access.role === 'viewer') throw new Error('Ingen skrivetilgang til kuben.');
  const result = await tx.feeding.create({ data: { ...data, userId, feedingDate: new Date(data.feedingDate) } });
  await tx.auditLog.create({ data: auditData({ userId, entityType: 'Feeding', entityId: result.id, action: 'create', after: result }) });
  return result;
}
