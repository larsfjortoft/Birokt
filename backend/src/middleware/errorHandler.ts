import { Request, Response, NextFunction } from 'express';
import { sendError, ErrorCodes } from '../utils/response.js';

// Custom error class
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Array<{ field?: string; message: string }>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Not found handler
export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    ErrorCodes.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    404
  );
}

// Global error handler
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  // Handle custom AppError
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as { code: string; meta?: { target?: string[] } };

    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target?.join(', ') || 'field';
      sendError(
        res,
        ErrorCodes.DUPLICATE_ENTRY,
        `A record with this ${target} already exists`,
        409
      );
      return;
    }

    if (prismaError.code === 'P2025') {
      sendError(res, ErrorCodes.NOT_FOUND, 'Record not found', 404);
      return;
    }
  }

  // Handle validation errors from Zod
  if (err.name === 'ZodError') {
    const zodError = err as unknown as { errors: Array<{ path: (string | number)[]; message: string }> };
    const details = zodError.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    sendError(res, ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400, details);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    sendError(
      res,
      ErrorCodes.AUTHENTICATION_REQUIRED,
      'Invalid or expired token',
      401
    );
    return;
  }

  // Default internal error
  sendError(
    res,
    ErrorCodes.INTERNAL_ERROR,
    process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    500
  );
}
