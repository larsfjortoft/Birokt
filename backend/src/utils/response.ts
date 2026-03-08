import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Generate request ID
export function generateRequestId(): string {
  return uuidv4();
}

// Success response
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  pagination?: PaginationMeta
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || generateRequestId(),
      ...(pagination && { pagination }),
    },
  };

  res.status(statusCode).json(response);
}

// Error response
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: Array<{ field?: string; message: string }>
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || generateRequestId(),
    },
  };

  res.status(statusCode).json(response);
}

// Common error codes
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

// Calculate pagination meta
export function calculatePagination(
  page: number,
  perPage: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / perPage);

  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
