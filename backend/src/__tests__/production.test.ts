import {
  testRequest,
  createTestUser,
  loginTestUser,
  createTestApiary,
  createTestHive,
  TestUser,
} from './helpers.js';

describe('Production API', () => {
  let user: TestUser;
  let apiary: { id: string };
  let hive: { id: string };

  beforeEach(async () => {
    const testUser = await createTestUser({
      email: 'production-test@example.com',
      password: 'TestPass123!',
    });
    user = await loginTestUser(testUser);
    apiary = await createTestApiary(user, { name: 'Test Apiary' });
    hive = await createTestHive(apiary, { hiveNumber: 'H-001' });
  });

  describe('POST /api/v1/production', () => {
    it('should create a production record for a hive', async () => {
      const response = await testRequest
        .post('/api/v1/production')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          harvestDate: new Date().toISOString(),
          productType: 'honey',
          honeyType: 'wildflower',
          amountKg: 15.5,
          qualityGrade: 'premium',
          moistureContent: 17.5,
          pricePerKg: 180,
          notes: 'Forste slynging',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });

    it('should create a production record for an apiary', async () => {
      const response = await testRequest
        .post('/api/v1/production')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          apiaryId: apiary.id,
          harvestDate: new Date().toISOString(),
          productType: 'wax',
          amountKg: 2.0,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject production without amountKg', async () => {
      const response = await testRequest
        .post('/api/v1/production')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          harvestDate: new Date().toISOString(),
          productType: 'honey',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject production for inaccessible hive', async () => {
      const otherUser = await createTestUser({ email: 'other-prod@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other' });
      const otherHive = await createTestHive(otherApiary, { hiveNumber: '1' });

      const response = await testRequest
        .post('/api/v1/production')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: otherHive.id,
          harvestDate: new Date().toISOString(),
          productType: 'honey',
          amountKg: 10,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/production', () => {
    beforeEach(async () => {
      await testRequest
        .post('/api/v1/production')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          harvestDate: new Date().toISOString(),
          productType: 'honey',
          amountKg: 10,
        });
    });

    it('should list production records', async () => {
      const response = await testRequest
        .get('/api/v1/production')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /api/v1/production/:id', () => {
    it('should delete production record', async () => {
      const createRes = await testRequest
        .post('/api/v1/production')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          harvestDate: new Date().toISOString(),
          productType: 'honey',
          amountKg: 5,
        })
        .expect(201);

      await testRequest
        .delete(`/api/v1/production/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(204);
    });
  });
});
