import { Request, Response, NextFunction } from 'express';

/**
 * API versioning middleware.
 * Reads version from Accept-Version or X-API-Version header.
 * Sets X-API-Version response header on all responses.
 */
export function apiVersion(req: Request, res: Response, next: NextFunction): void {
  const requestedVersion = req.headers['accept-version'] || req.headers['x-api-version'] || '1';
  res.locals.apiVersion = String(requestedVersion);

  res.setHeader('X-API-Version', '1');

  next();
}
