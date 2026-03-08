import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  getAccessTokenExpiresIn,
  getTokenExpiration,
} from '../utils/jwt.js';
import prisma from '../utils/prisma.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { sendWelcomeEmail } from '../services/emailService.js';

const router = Router();

// Rate limiting is applied per-route below (login, register) instead of globally

// Validation schemas
const registerSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1, 'Name is required').max(255),
  phone: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// POST /auth/register
router.post('/register', authRateLimit, validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      sendError(
        res,
        ErrorCodes.VALIDATION_ERROR,
        'Password does not meet requirements',
        400,
        passwordValidation.errors.map(e => ({ message: e }))
      );
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      sendError(res, ErrorCodes.DUPLICATE_ENTRY, 'User with this email already exists', 409);
      return;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        phone,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getTokenExpiration(refreshToken),
      },
    });

    // Send welcome email (fire-and-forget)
    sendWelcomeEmail(name, email.toLowerCase()).catch(() => {});

    sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
        expiresIn: getAccessTokenExpiresIn(),
      },
      201
    );
  } catch (error) {
    console.error('Register error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to register user', 500);
  }
});

// POST /auth/login
router.post('/login', authRateLimit, validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      sendError(res, ErrorCodes.AUTHENTICATION_REQUIRED, 'Invalid email or password', 401);
      return;
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      sendError(res, ErrorCodes.AUTHENTICATION_REQUIRED, 'Invalid email or password', 401);
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getTokenExpiration(refreshToken),
      },
    });

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken,
      expiresIn: getAccessTokenExpiresIn(),
    });
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to log in', 500);
  }
});

// POST /auth/refresh
router.post('/refresh', validateBody(refreshSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch {
      sendError(res, ErrorCodes.AUTHENTICATION_REQUIRED, 'Invalid refresh token', 401);
      return;
    }

    if (decoded.type !== 'refresh') {
      sendError(res, ErrorCodes.AUTHENTICATION_REQUIRED, 'Invalid token type', 401);
      return;
    }

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      sendError(res, ErrorCodes.AUTHENTICATION_REQUIRED, 'Refresh token not found', 401);
      return;
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      sendError(res, ErrorCodes.AUTHENTICATION_REQUIRED, 'Refresh token has expired', 401);
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken(storedToken.user.id, storedToken.user.email);

    sendSuccess(res, {
      accessToken,
      expiresIn: getAccessTokenExpiresIn(),
    });
  } catch (error) {
    console.error('Refresh error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to refresh token', 500);
  }
});

// POST /auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Delete all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    sendSuccess(res, { message: 'Successfully logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to log out', 500);
  }
});

// GET /auth/me - Get current user
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
      return;
    }

    sendSuccess(res, {
      ...user,
      settings: JSON.parse(user.settings),
    });
  } catch (error) {
    console.error('Get me error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get user', 500);
  }
});

// PUT /auth/me - Update current user profile
const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
});

router.put('/me', authenticate, validateBody(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    sendSuccess(res, user);
  } catch (error) {
    console.error('Update profile error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update profile', 500);
  }
});

// PUT /auth/me/password - Change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.put('/me/password', authenticate, validateBody(changePasswordSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
      return;
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      sendError(res, ErrorCodes.AUTHENTICATION_REQUIRED, 'Current password is incorrect', 401);
      return;
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      sendError(
        res,
        ErrorCodes.VALIDATION_ERROR,
        'New password does not meet requirements',
        400,
        passwordValidation.errors.map(e => ({ message: e }))
      );
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate all refresh tokens (force re-login)
    await prisma.refreshToken.deleteMany({ where: { userId } });

    sendSuccess(res, { message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to change password', 500);
  }
});

// DELETE /auth/me - Delete account
router.delete('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Delete user (cascade will handle related data)
    await prisma.user.delete({ where: { id: userId } });

    res.status(204).send();
  } catch (error) {
    console.error('Delete account error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete account', 500);
  }
});

export default router;
