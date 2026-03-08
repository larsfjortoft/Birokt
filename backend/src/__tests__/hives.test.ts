import {
  testRequest,
  createTestUser,
  loginTestUser,
  createTestApiary,
  createTestHive,
  TestUser,
} from './helpers.js';

const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('Hives API', () => {
  let user: TestUser;
  let apiary: { id: string };

  beforeEach(async () => {
    const testUser = await createTestUser({
      email: 'hive-test@example.com',
      password: 'TestPass123!',
    });
    user = await loginTestUser(testUser);
    apiary = await createTestApiary(user, { name: 'Test Apiary' });
  });

  describe('POST /api/v1/hives', () => {
    it('should create a new hive', async () => {
      const response = await testRequest
        .post('/api/v1/hives')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          apiaryId: apiary.id,
          hiveNumber: 'H-001',
          hiveType: 'langstroth',
          status: 'active',
          queen: {
            year: 2024,
            marked: true,
            color: 'blue',
            race: 'Carniolan',
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hiveNumber).toBe('H-001');
      expect(response.body.data.hiveType).toBe('langstroth');
      expect(response.body.data.status).toBe('active');
    });

    it('should create hive with minimal data', async () => {
      const response = await testRequest
        .post('/api/v1/hives')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          apiaryId: apiary.id,
          hiveNumber: '1',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hiveNumber).toBe('1');
    });

    it('should reject creation without apiaryId', async () => {
      const response = await testRequest
        .post('/api/v1/hives')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveNumber: 'H-001',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject creation for apiary user does not have access to', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other Apiary' });

      const response = await testRequest
        .post('/api/v1/hives')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          apiaryId: otherApiary.id,
          hiveNumber: 'H-001',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/hives', () => {
    beforeEach(async () => {
      await createTestHive(apiary, { hiveNumber: 'H-001' });
      await createTestHive(apiary, { hiveNumber: 'H-002' });
    });

    it('should list all hives for user', async () => {
      const response = await testRequest
        .get('/api/v1/hives')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should filter hives by apiaryId', async () => {
      const otherApiary = await createTestApiary(user, { name: 'Other Apiary' });
      await createTestHive(otherApiary, { hiveNumber: 'O-001' });

      const response = await testRequest
        .get('/api/v1/hives')
        .query({ apiaryId: apiary.id })
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      response.body.data.forEach((hive: { apiary: { id: string } }) => {
        expect(hive.apiary.id).toBe(apiary.id);
      });
    });
  });

  describe('GET /api/v1/hives/:id', () => {
    it('should get hive by id', async () => {
      const hive = await createTestHive(apiary, { hiveNumber: 'H-001' });

      const response = await testRequest
        .get(`/api/v1/hives/${hive.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(hive.id);
      expect(response.body.data.hiveNumber).toBe('H-001');
    });

    it('should return 404 for non-existent hive', async () => {
      const response = await testRequest
        .get(`/api/v1/hives/${NON_EXISTENT_UUID}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for hive user does not have access to', async () => {
      const otherUser = await createTestUser({ email: 'other2@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other Apiary' });
      const otherHive = await createTestHive(otherApiary, { hiveNumber: 'O-001' });

      const response = await testRequest
        .get(`/api/v1/hives/${otherHive.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/hives/:id', () => {
    it('should update hive', async () => {
      const hive = await createTestHive(apiary, { hiveNumber: 'H-001' });

      const response = await testRequest
        .put(`/api/v1/hives/${hive.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          hiveNumber: 'H-001-Updated',
          strength: 'strong',
          boxCount: 3,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hiveNumber).toBe('H-001-Updated');
      expect(response.body.data.strength).toBe('strong');
      expect(response.body.data.boxCount).toBe(3);
    });

    it('should update queen information', async () => {
      const hive = await createTestHive(apiary, { hiveNumber: 'H-001' });

      const response = await testRequest
        .put(`/api/v1/hives/${hive.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          queen: {
            year: 2024,
            marked: true,
            color: 'yellow',
            race: 'Buckfast',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.queen.year).toBe(2024);
      expect(response.body.data.queen.color).toBe('yellow');
    });
  });

  describe('DELETE /api/v1/hives/:id', () => {
    it('should soft-delete hive', async () => {
      const hive = await createTestHive(apiary, { hiveNumber: 'H-001' });

      await testRequest
        .delete(`/api/v1/hives/${hive.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(204);

      // Verify hive is soft-deleted
      const response = await testRequest
        .get(`/api/v1/hives/${hive.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('inactive');
    });
  });
});

