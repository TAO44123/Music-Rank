import type { RequestHandler } from 'express';
import { AppError } from './errors.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createOriginGuard(allowedOrigin: string): RequestHandler {
  return (request, _response, next) => {
    if (safeMethods.has(request.method)) {
      next();
      return;
    }
    const fetchSite = request.get('Sec-Fetch-Site');
    const origin = request.get('Origin');
    if (fetchSite === 'cross-site' || origin !== allowedOrigin) {
      next(new AppError(403, 'INVALID_ORIGIN', 'Request origin is not allowed'));
      return;
    }
    next();
  };
}

type RateLimitEntry = { count: number; resetAt: number };

export function createAuthRateLimiter({ maxAttempts = 10, windowMs = 10 * 60 * 1000 } = {}): RequestHandler {
  const attempts = new Map<string, RateLimitEntry>();
  return (request, response, next) => {
    const now = Date.now();
    const username = typeof request.body?.username === 'string' ? request.body.username.trim().toLowerCase() : '';
    const key = `${request.ip}|${username}`;
    const current = attempts.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    attempts.set(key, entry);
    response.setHeader('RateLimit-Limit', String(maxAttempts));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, maxAttempts - entry.count)));
    response.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > maxAttempts) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      next(new AppError(429, 'AUTH_RATE_LIMITED', 'Too many authentication attempts. Try again later.'));
      return;
    }
    next();
  };
}
