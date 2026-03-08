import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError, ErrorCodes } from '../utils/response.js';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[part];
      const parsed = schema.parse(data);

      // Replace with parsed data (includes defaults and transformations)
      req[part] = parsed;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        sendError(
          res,
          ErrorCodes.VALIDATION_ERROR,
          'Invalid input data',
          400,
          details
        );
        return;
      }

      next(error);
    }
  };
}

// Convenience functions for different parts
export const validateBody = (schema: ZodSchema) => validate(schema, 'body');
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');
