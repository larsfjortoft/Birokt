import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export function cacheGet<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function cacheSet<T>(key: string, value: T, ttl?: number): boolean {
  if (ttl !== undefined) {
    return cache.set(key, value, ttl);
  }
  return cache.set(key, value);
}

export function cacheDelete(key: string): number {
  return cache.del(key);
}

export function cacheDeletePattern(pattern: string): void {
  const keys = cache.keys().filter(k => k.includes(pattern));
  if (keys.length > 0) {
    cache.del(keys);
  }
}

export async function cacheWrap<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = await fetcher();
  cache.set(key, result, ttl);
  return result;
}

export default cache;
