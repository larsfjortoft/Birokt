import { PrismaClient } from '@prisma/client';

import path from 'path';
// These suites delete data. Refuse all databases except the dedicated local fixture.
const databaseUrl = process.env.DATABASE_URL || '';
const testFile = databaseUrl.startsWith('file:') ? path.resolve(process.cwd(), 'prisma', databaseUrl.slice(5)) : '';
if (process.env.NODE_ENV !== 'test' || process.env.BIROKT_ISOLATED_TESTS !== '1' || testFile !== path.resolve(process.cwd(), '.cache/tests/visits.test.db')) {
  throw new Error('Destruktive tester krever BIROKT_ISOLATED_TESTS=1 og den isolerte .cache/tests/visits.test.db.');
}
const prisma = new PrismaClient();

async function cleanDatabase() {
  // Delete in correct order due to foreign key constraints
  await prisma.auditLog.deleteMany();
  await prisma.visitEntry.deleteMany();
  await prisma.fieldVisit.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.complianceDocument.deleteMany();
  await prisma.productionBatchSource.deleteMany();
  await prisma.productionBatch.deleteMany();
  await prisma.complianceEvent.deleteMany();
  await prisma.idempotencyRequest.deleteMany();
  await prisma.hivePlacement.deleteMany();
  await prisma.inspectionAction.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.medicineAcquisition.deleteMany();
  await prisma.feeding.deleteMany();
  await prisma.production.deleteMany();
  await prisma.queenHiveLog.deleteMany();
  await prisma.queen.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.notificationSettings.deleteMany();
  await prisma.hive.deleteMany();
  await prisma.userApiary.deleteMany();
  await prisma.apiary.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await prisma.$connect();
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  await cleanDatabase();
});

export { prisma };

