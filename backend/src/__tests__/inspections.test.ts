import {
  testRequest,
  createTestUser,
  loginTestUser,
  createTestApiary,
  createTestHive,
  TestUser,
} from './helpers.js';

describe('Inspections API', () => {
  let user: TestUser;
  let apiary: { id: string };
  let hive: { id: string };

  beforeEach(async () => {
    const testUser = await createTestUser({
      email: 'inspection-test@example.com',
      password: 'TestPass123!',
    });
    user = await loginTestUser(testUser);
    apiary = await createTestApiary(user, { name: 'Test Apiary' });
    hive = await createTestHive(apiary, { hiveNumber: 'H-001' });
  });

  describe('POST /api/v1/inspections', () => {
    it('should create a new inspection', async () => {
      const response = await testRequest
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          inspectionDate: new Date().toISOString(),
          weather: { temperature: 20, windSpeed: 3, condition: 'sunny' },
          assessment: { strength: 'strong', temperament: 'calm', queenSeen: true, queenLaying: true },
          frames: { brood: 6, honey: 4, pollen: 2, empty: 1 },
          health: { status: 'healthy', varroaLevel: 'low' },
          notes: 'Test inspection',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });

    it('should create inspection with minimal data', async () => {
      const response = await testRequest
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          inspectionDate: new Date().toISOString(),
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject inspection without hiveId', async () => {
      const response = await testRequest
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          inspectionDate: new Date().toISOString(),
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject inspection for inaccessible hive', async () => {
      const otherUser = await createTestUser({ email: 'other-insp@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other' });
      const otherHive = await createTestHive(otherApiary, { hiveNumber: '1' });

      const response = await testRequest
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: otherHive.id,
          inspectionDate: new Date().toISOString(),
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/inspections', () => {
    beforeEach(async () => {
      await testRequest
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveId: hive.id,
          inspectionDate: new Date().toISOString(),
          health: { status: 'healthy' },
        });
    });

    it('should list inspections', async () => {
      const response = await testRequest
        .get('/api/v1/inspections')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter inspections by hiveId', async () => {
      const response = await testRequest
        .get('/api/v1/inspections')
        .query({ hiveId: hive.id })
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
