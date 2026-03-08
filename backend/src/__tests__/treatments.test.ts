import {
  testRequest,
  createTestUser,
  loginTestUser,
  createTestApiary,
  createTestHive,
  TestUser,
} from './helpers.js';

describe('Treatments API', () => {
  let user: TestUser;
  let apiary: { id: string };
  let hive: { id: string };

  beforeEach(async () => {
    const testUser = await createTestUser({
      email: 'treatment-test@example.com',
      password: 'TestPass123!',
    });
    user = await loginTestUser(testUser);
    apiary = await createTestApiary(user, { name: 'Test Apiary' });
    hive = await createTestHive(apiary, { hiveNumber: 'H-001' });
  });

  describe('POST /api/v1/treatments', () => {
    it('should create a new treatment', async () => {
      const response = await testRequest
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          treatmentDate: new Date().toISOString(),
          productName: 'Oxalsyre',
          productType: 'organic_acid',
          target: 'varroa',
          dosage: '5ml per ramme',
          startDate: new Date().toISOString(),
          withholdingPeriodDays: 30,
          notes: 'Varroabehandling',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.productName).toBe('Oxalsyre');
      expect(response.body.data.withholdingEndDate).toBeTruthy();
    });

    it('should create treatment without optional fields', async () => {
      const response = await testRequest
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          treatmentDate: new Date().toISOString(),
          productName: 'ApiLifeVar',
          startDate: new Date().toISOString(),
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject treatment without productName', async () => {
      const response = await testRequest
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          treatmentDate: new Date().toISOString(),
          startDate: new Date().toISOString(),
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject treatment for inaccessible hive', async () => {
      const otherUser = await createTestUser({ email: 'other-treat@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other' });
      const otherHive = await createTestHive(otherApiary, { hiveNumber: '1' });

      const response = await testRequest
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: otherHive.id,
          treatmentDate: new Date().toISOString(),
          productName: 'Test',
          startDate: new Date().toISOString(),
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/treatments', () => {
    beforeEach(async () => {
      await testRequest
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          treatmentDate: new Date().toISOString(),
          productName: 'Oxalsyre',
          startDate: new Date().toISOString(),
        });
    });

    it('should list treatments', async () => {
      const response = await testRequest
        .get('/api/v1/treatments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /api/v1/treatments/:id', () => {
    it('should delete treatment', async () => {
      const createRes = await testRequest
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          treatmentDate: new Date().toISOString(),
          productName: 'Test Delete',
          startDate: new Date().toISOString(),
        })
        .expect(201);

      await testRequest
        .delete(`/api/v1/treatments/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(204);
    });
  });
});
