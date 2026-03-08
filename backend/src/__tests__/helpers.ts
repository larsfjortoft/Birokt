import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../index.js';
import { prisma } from './setup.js';
import { hashPassword } from '../utils/password.js';

export const testRequest = request(app);

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  accessToken?: string;
  refreshToken?: string;
}

export async function createTestUser(data?: Partial<TestUser>): Promise<TestUser> {
  const email = data?.email || `test-${Date.now()}-${randomUUID()}@example.com`;
  const password = data?.password || 'TestPass123!';
  const name = data?.name || 'Test User';

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashedPassword,
      name,
    },
  });

  return {
    id: user.id,
    email,
    password,
    name,
  };
}

export async function loginTestUser(user: TestUser): Promise<TestUser> {
  const response = await testRequest
    .post('/api/v1/auth/login')
    .send({
      email: user.email,
      password: user.password,
    })
    .expect(200);

  return {
    ...user,
    accessToken: response.body.data.accessToken,
    refreshToken: response.body.data.refreshToken,
  };
}

export async function createTestApiary(user: TestUser, data?: { name?: string }) {
  const apiary = await prisma.apiary.create({
    data: {
      name: data?.name || 'Test Apiary',
      type: 'hobby',
    },
  });

  await prisma.userApiary.create({
    data: {
      userId: user.id,
      apiaryId: apiary.id,
      role: 'owner',
    },
  });

  return apiary;
}

export async function createTestHive(
  apiary: { id: string },
  data?: { hiveNumber?: string }
) {
  return prisma.hive.create({
    data: {
      apiaryId: apiary.id,
      hiveNumber: data?.hiveNumber || '1',
      status: 'active',
    },
  });
}

