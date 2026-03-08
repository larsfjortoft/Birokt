import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  // Delete in correct order due to foreign key constraints
  await prisma.inspectionAction.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.treatment.deleteMany();
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

