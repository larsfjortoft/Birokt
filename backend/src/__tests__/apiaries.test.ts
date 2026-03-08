import { testRequest, createTestUser, loginTestUser, createTestApiary, TestUser } from './helpers.js';

const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('Apiaries API', () => {
  let user: TestUser;

  beforeEach(async () => {
    const testUser = await createTestUser({
      email: 'apiary-test@example.com',
      password: 'TestPass123!',
    });
    user = await loginTestUser(testUser);
  });

  describe('POST /api/v1/apiaries', () => {
    it('should create a new apiary', async () => {
      const response = await testRequest
        .post('/api/v1/apiaries')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'My First Apiary',
          description: 'A beautiful apiary in the countryside',
          type: 'permanent',
          location: {
            name: 'Oslo, Norway',
            lat: 59.9139,
            lng: 10.7522,
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('My First Apiary');
      expect(response.body.data.description).toBe('A beautiful apiary in the countryside');
      expect(response.body.data.type).toBe('permanent');
    });

    it('should create apiary with minimal data', async () => {
      const response = await testRequest
        .post('/api/v1/apiaries')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Minimal Apiary',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Minimal Apiary');
    });

    it('should reject creation without name', async () => {
      const response = await testRequest
        .post('/api/v1/apiaries')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          description: 'No name provided',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject unauthenticated request', async () => {
      const response = await testRequest
        .post('/api/v1/apiaries')
        .send({
          name: 'Unauthorized Apiary',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/apiaries', () => {
    beforeEach(async () => {
      await createTestApiary(user, { name: 'Apiary 1' });
      await createTestApiary(user, { name: 'Apiary 2' });
    });

    it('should list all user apiaries', async () => {
      const response = await testRequest
        .get('/api/v1/apiaries')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should return empty array for user with no apiaries', async () => {
      const newUser = await createTestUser({ email: 'newuser@example.com' });
      const loggedInUser = await loginTestUser(newUser);

      const response = await testRequest
        .get('/api/v1/apiaries')
        .set('Authorization', `Bearer ${loggedInUser.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/apiaries/:id', () => {
    it('should get apiary by id', async () => {
      const apiary = await createTestApiary(user, { name: 'Test Apiary' });

      const response = await testRequest
        .get(`/api/v1/apiaries/${apiary.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(apiary.id);
      expect(response.body.data.name).toBe('Test Apiary');
    });

    it('should return 403 for non-existent apiary not owned by user', async () => {
      const response = await testRequest
        .get(`/api/v1/apiaries/${NON_EXISTENT_UUID}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for apiary user does not have access to', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other Apiary' });

      const response = await testRequest
        .get(`/api/v1/apiaries/${otherApiary.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/apiaries/:id', () => {
    it('should update apiary', async () => {
      const apiary = await createTestApiary(user, { name: 'Old Name' });

      const response = await testRequest
        .put(`/api/v1/apiaries/${apiary.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'New Name',
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Name');
      expect(response.body.data.description).toBe('Updated description');
    });

    it('should not update apiary user does not own', async () => {
      const otherUser = await createTestUser({ email: 'other2@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other Apiary' });

      const response = await testRequest
        .put(`/api/v1/apiaries/${otherApiary.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          name: 'Hacked Name',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/apiaries/:id', () => {
    it('should delete apiary', async () => {
      const apiary = await createTestApiary(user, { name: 'To Delete' });

      await testRequest
        .delete(`/api/v1/apiaries/${apiary.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(204);

      // Verify access is gone after deletion
      const response = await testRequest
        .get(`/api/v1/apiaries/${apiary.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should not delete apiary user does not own', async () => {
      const otherUser = await createTestUser({ email: 'other3@example.com' });
      const otherApiary = await createTestApiary(otherUser, { name: 'Other Apiary' });

      await testRequest
        .delete(`/api/v1/apiaries/${otherApiary.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);
    });
  });
});

