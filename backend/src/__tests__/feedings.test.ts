import {
  testRequest,
  createTestUser,
  loginTestUser,
  createTestApiary,
  createTestHive,
  TestUser,
} from './helpers.js';

describe('Feedings API', () => {
  let user: TestUser;
  let apiary: { id: string };
  let hive: { id: string };

  beforeEach(async () => {
    const testUser = await createTestUser({
      email: 'feeding-test@example.com',
      password: 'TestPass123!',
    });
    user = await loginTestUser(testUser);
    apiary = await createTestApiary(user, { name: 'Test Apiary' });
    hive = await createTestHive(apiary, { hiveNumber: 'H-001' });
  });

  describe('POST /api/v1/feedings', () => {
    it('should create a new feeding', async () => {
      const response = await testRequest
        .post('/api/v1/feedings')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          feedingDate: new Date().toISOString(),
          feedType: 'sugar_syrup',
          amountKg: 5.0,
          sugarConcentration: 60,
          reason: 'winter_prep',
          notes: 'Hostforing',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });

    it('should create feeding with minimal data', async () => {
      const response = await testRequest
        .post('/api/v1/feedings')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          feedingDate: new Date().toISOString(),
          feedType: 'sugar_dough',
          amountKg: 2.0,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject feeding without amountKg', async () => {
      const response = await testRequest
        .post('/api/v1/feedings')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          feedingDate: new Date().toISOString(),
          feedType: 'sugar_syrup',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject feeding for inaccessible hive', async () => {
      const otherUser = await createTestUser({ email: 'other-feed@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other' });
      const otherHive = await createTestHive(otherApiary, { hiveNumber: '1' });

      const response = await testRequest
        .post('/api/v1/feedings')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: otherHive.id,
          feedingDate: new Date().toISOString(),
          feedType: 'sugar_syrup',
          amountKg: 1.0,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/feedings', () => {
    beforeEach(async () => {
      await testRequest
        .post('/api/v1/feedings')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          feedingDate: new Date().toISOString(),
          feedType: 'sugar_syrup',
          amountKg: 5.0,
        });
    });

    it('should list feedings', async () => {
      const response = await testRequest
        .get('/api/v1/feedings')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /api/v1/feedings/:id', () => {
    it('should delete feeding', async () => {
      const createRes = await testRequest
        .post('/api/v1/feedings')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          feedingDate: new Date().toISOString(),
          feedType: 'sugar_syrup',
          amountKg: 3.0,
        })
        .expect(201);

      await testRequest
        .delete(`/api/v1/feedings/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(204);
    });
  });
});


