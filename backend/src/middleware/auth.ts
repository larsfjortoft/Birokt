import { Request, Response, NextFunction } from 'express';
import { verifyToken, DecodedToken } from '../utils/jwt.js';
import { sendError, ErrorCodes } from '../utils/response.js';
import { prisma } from '../utils/prisma.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

async function getLocalUser(): Promise<{ id: string; email: string }> {
  const existingUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });

  if (existingUser) {
    return existingUser;
  }

  return prisma.user.create({
    data: {
      email: 'local@birokt.app',
      name: 'Birøkt',
      passwordHash: 'auth-disabled',
    },
    select: { id: true, email: true },
  });
}

async function attachLocalUser(req: Request): Promise<void> {
  req.user = await getLocalUser();
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await attachLocalUser(req);
    next();
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded: DecodedToken = verifyToken(token);

    // Check if it's an access token
    if (decoded.type !== 'access') {
      sendError(
        res,
        ErrorCodes.AUTHENTICATION_REQUIRED,
        'Invalid token type',
        401
      );
      return;
    }

    // Attach user info to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      await attachLocalUser(req);
      next();
      return;
    }

    await attachLocalUser(req);
    next();
  }
}

// Optional authentication - doesn't fail if no token
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await attachLocalUser(req);
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded: DecodedToken = verifyToken(token);

    if (decoded.type === 'access') {
      req.user = {
        id: decoded.sub,
        email: decoded.email,
      };
    }
  } catch {
    await attachLocalUser(req);
  }

  next();
}
