import {
  testRequest,
  createTestUser,
  loginTestUser,
  createTestApiary,
  createTestHive,
  createTestQueen,
  TestUser,
} from './helpers.js';
import { prisma } from './setup.js';

describe('Queens API', () => {
  let user: TestUser;
  let apiary: { id: string };

  beforeEach(async () => {
    const testUser = await createTestUser({
      email: 'queens-test@example.com',
      password: 'TestPass123!',
    });
    user = await loginTestUser(testUser);
    apiary = await createTestApiary(user, { name: 'Queen Apiary' });
  });

  it('requires colony selection for double-queen hives', async () => {
    const hive = await createTestHive(apiary, { hiveNumber: 'DQ-1', hiveType: 'double_queen' });

    const response = await testRequest
      .post('/api/v1/queens')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        queenCode: 'DQ-NEW-1',
        year: 2026,
        currentHiveId: hive.id,
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects placing a queen into an occupied slot without replacement', async () => {
    const hive = await createTestHive(apiary, { hiveNumber: 'DQ-2', hiveType: 'double_queen' });
    await createTestQueen(user, {
      queenCode: 'DQ-EXISTING',
      currentHiveId: hive.id,
      currentColonyNumber: 2,
    });

    const response = await testRequest
      .post('/api/v1/queens')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        queenCode: 'DQ-NEW-2',
        year: 2026,
        currentHiveId: hive.id,
        currentColonyNumber: 2,
      })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('DUPLICATE_ENTRY');
  });

  it('can replace an existing queen and take her out during create', async () => {
    const hive = await createTestHive(apiary, { hiveNumber: 'SQ-1', hiveType: 'single_queen' });
    const existingQueen = await createTestQueen(user, {
      queenCode: 'SQ-EXISTING',
      currentHiveId: hive.id,
      currentColonyNumber: 1,
      status: 'laying',
    });

    const response = await testRequest
      .post('/api/v1/queens')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        queenCode: 'SQ-NEW',
        year: 2026,
        currentHiveId: hive.id,
        replaceExisting: true,
        replacementAction: 'remove',
      })
      .expect(201);

    const removedQueen = await prisma.queen.findUniqueOrThrow({ where: { id: existingQueen.id } });
    const newQueen = await prisma.queen.findUniqueOrThrow({ where: { id: response.body.data.id } });

    expect(removedQueen.currentHiveId).toBeNull();
    expect(removedQueen.currentColonyNumber).toBeNull();
    expect(removedQueen.status).toBe('laying');
    expect(newQueen.currentHiveId).toBe(hive.id);
    expect(newQueen.currentColonyNumber).toBe(1);
  });

  it('can move a queen into a selected double-queen colony and mark the replaced queen dead', async () => {
    const targetHive = await createTestHive(apiary, { hiveNumber: 'DQ-3', hiveType: 'double_queen' });
    const sourceHive = await createTestHive(apiary, { hiveNumber: 'SQ-2', hiveType: 'single_queen' });
    const movingQueen = await createTestQueen(user, {
      queenCode: 'MOVE-ME',
      currentHiveId: sourceHive.id,
      currentColonyNumber: 1,
    });
    const replacedQueen = await createTestQueen(user, {
      queenCode: 'MOVE-OUT',
      currentHiveId: targetHive.id,
      currentColonyNumber: 1,
      status: 'laying',
    });

    await testRequest
      .post(`/api/v1/queens/${movingQueen.id}/move`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        hiveId: targetHive.id,
        currentColonyNumber: 1,
        replaceExisting: true,
        replacementAction: 'dead',
        date: '2026-06-27T12:00:00.000Z',
        reason: 'Dronningbytte',
      })
      .expect(200);

    const updatedMovingQueen = await prisma.queen.findUniqueOrThrow({ where: { id: movingQueen.id } });
    const updatedReplacedQueen = await prisma.queen.findUniqueOrThrow({ where: { id: replacedQueen.id } });
    const replacementLog = await prisma.queenHiveLog.findFirst({
      where: { queenId: replacedQueen.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(updatedMovingQueen.currentHiveId).toBe(targetHive.id);
    expect(updatedMovingQueen.currentColonyNumber).toBe(1);
    expect(updatedReplacedQueen.currentHiveId).toBeNull();
    expect(updatedReplacedQueen.currentColonyNumber).toBeNull();
    expect(updatedReplacedQueen.status).toBe('dead');
    expect(replacementLog?.colonyNumber).toBe(1);
  });
});
