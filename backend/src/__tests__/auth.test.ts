import { testRequest, createTestUser, TestUser } from './helpers.js';
import { prisma } from './setup.js';

describe('Auth API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await testRequest
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('newuser@example.com');
      expect(response.body.data.user.name).toBe('New User');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should reject registration with invalid email', async () => {
      const response = await testRequest
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with short password', async () => {
      const response = await testRequest
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with duplicate email', async () => {
      await createTestUser({ email: 'existing@example.com' });

      const response = await testRequest
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'SecurePass123!',
          name: 'Another User',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DUPLICATE_ENTRY');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser: TestUser;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'login@example.com',
        password: 'TestPass123!',
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should reject login with wrong password', async () => {
      const response = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should reject login with non-existent email', async () => {
      const response = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPass123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let testUser: TestUser;
    let accessToken: string;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'me@example.com',
        password: 'TestPass123!',
        name: 'Me User',
      });

      const loginResponse = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should return current user with valid token', async () => {
      const response = await testRequest
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.name).toBe(testUser.name);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should reject request without token', async () => {
      const response = await testRequest
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should reject request with invalid token', async () => {
      const response = await testRequest
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const testUser = await createTestUser({
        email: 'refresh@example.com',
        password: 'TestPass123!',
      });

      const loginResponse = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should return new access token with valid refresh token', async () => {
      const response = await testRequest
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const response = await testRequest
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const testUser = await createTestUser({
        email: 'logout@example.com',
        password: 'TestPass123!',
      });

      const loginResponse = await testRequest
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      accessToken = loginResponse.body.data.accessToken;
      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await testRequest
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify refresh token is invalidated
      const refreshResponse = await testRequest
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(refreshResponse.body.success).toBe(false);
    });
  });
});


