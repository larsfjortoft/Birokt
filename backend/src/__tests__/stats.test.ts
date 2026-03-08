import {
  testRequest,
  createTestUser,
  loginTestUser,
  createTestApiary,
  createTestHive,
  TestUser,
} from './helpers.js';

describe('Stats API', () => {
  let user: TestUser;
  let apiary: { id: string };
  let hive: { id: string };

  beforeEach(async () => {
    const testUser = await createTestUser({
      email: 'stats-test@example.com',
      password: 'TestPass123!',
    });
    user = await loginTestUser(testUser);
    apiary = await createTestApiary(user, { name: 'Test Apiary' });
    hive = await createTestHive(apiary, { hiveNumber: 'H-001' });
  });

  describe('GET /api/v1/stats/overview', () => {
    it('should return overview statistics', async () => {
      const response = await testRequest
        .get('/api/v1/stats/overview')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('apiaries');
      expect(response.body.data).toHaveProperty('hives');
      expect(response.body.data).toHaveProperty('inspections');
      expect(response.body.data).toHaveProperty('production');
      expect(response.body.data).toHaveProperty('treatments');
      expect(response.body.data.apiaries.total).toBe(1);
      expect(response.body.data.hives.total).toBe(1);
    });

    it('should filter by year', async () => {
      const response = await testRequest
        .get('/api/v1/stats/overview')
        .query({ year: '2025' })
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.year).toBe(2025);
    });

    it('should require authentication', async () => {
      const response = await testRequest
        .get('/api/v1/stats/overview')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/stats/hive/:id', () => {
    it('should return hive statistics', async () => {
      const response = await testRequest
        .get(`/api/v1/stats/hive/${hive.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('inspections');
      expect(response.body.data).toHaveProperty('production');
      expect(response.body.data).toHaveProperty('treatments');
      expect(response.body.data).toHaveProperty('feedings');
      expect(response.body.data).toHaveProperty('timeline');
    });

    it('should return 403 for inaccessible hive', async () => {
      const otherUser = await createTestUser({ email: 'other-stats@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other' });
      const otherHive = await createTestHive(otherApiary, { hiveNumber: '1' });

      const response = await testRequest
        .get(`/api/v1/stats/hive/${otherHive.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/stats/charts', () => {
    it('should return chart data', async () => {
      const response = await testRequest
        .get('/api/v1/stats/charts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('monthlyProduction');
      expect(response.body.data).toHaveProperty('monthlyHealth');
      expect(response.body.data).toHaveProperty('treatmentTimeline');
      expect(response.body.data.monthlyProduction).toHaveLength(12);
      expect(response.body.data.monthlyHealth).toHaveLength(12);
    });
  });

  describe('GET /api/v1/stats/export/csv', () => {
    it('should export inspections as CSV', async () => {
      const response = await testRequest
        .get('/api/v1/stats/export/csv')
        .query({ type: 'inspections' })
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('Dato');
    });

    it('should export treatments as CSV', async () => {
      const response = await testRequest
        .get('/api/v1/stats/export/csv')
        .query({ type: 'treatments' })
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should reject invalid export type', async () => {
      await testRequest
        .get('/api/v1/stats/export/csv')
        .query({ type: 'invalid' })
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(400);
    });
  });
});
