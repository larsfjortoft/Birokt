import { Request, Response, NextFunction } from 'express';
import { verifyToken, DecodedToken } from '../utils/jwt.js';
import { sendError, ErrorCodes } from '../utils/response.js';

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

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(
      res,
      ErrorCodes.AUTHENTICATION_REQUIRED,
      'Authentication token is required',
      401
    );
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
      sendError(
        res,
        ErrorCodes.AUTHENTICATION_REQUIRED,
        'Token has expired',
        401
      );
      return;
    }

    sendError(
      res,
      ErrorCodes.AUTHENTICATION_REQUIRED,
      'Invalid authentication token',
      401
    );
  }
}

// Optional authentication - doesn't fail if no token
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    // Ignore errors for optional auth
  }

  next();
}
