import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../utils/prisma.js';

type Db = PrismaClient | Prisma.TransactionClient;

export async function apiaryAccess(userId: string, apiaryId: string, db: Db = prisma) {
  return db.userApiary.findUnique({ where: { userId_apiaryId: { userId, apiaryId } } });
}

export async function canEditApiary(userId: string, apiaryId: string, db: Db = prisma) {
  const access = await apiaryAccess(userId, apiaryId, db);
  return access && access.role !== 'viewer' ? access : null;
}

export async function hiveAccess(userId: string, hiveId: string, db: Db = prisma) {
  const hive = await db.hive.findUnique({ where: { id: hiveId }, include: { apiary: true } });
  if (!hive) return null;
  const access = await apiaryAccess(userId, hive.apiaryId, db);
  return access ? { hive, access } : null;
}
