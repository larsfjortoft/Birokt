import { Request, Response, NextFunction } from 'express';
import { cacheGet, cacheSet } from '../utils/cache.js';

/**
 * Express middleware for route-level response caching.
 * Caches GET responses based on URL + userId.
 * Sets X-Cache: HIT/MISS header.
 */
export function cacheResponse(ttlSeconds: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const userId = req.user?.id || 'anonymous';
    const cacheKey = `response:${userId}:${req.originalUrl}`;

    const cached = cacheGet<{ status: number; body: unknown }>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.status(cached.status).json(cached.body);
      return;
    }

    // Override res.json to intercept the response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(cacheKey, { status: res.statusCode, body }, ttlSeconds);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}
