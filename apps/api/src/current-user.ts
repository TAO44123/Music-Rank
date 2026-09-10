import type { RequestHandler } from 'express';
import { AppError } from './errors.js';
import { resolveSession, type AuthenticatedUser } from './auth.js';

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

export const createOptionalCurrentUserResolver = (cookieName: string): RequestHandler =>
  async (request, response, next) => {
    try {
      const token = readCookie(request.headers.cookie, cookieName);
      const session = token ? await resolveSession(token) : null;
      response.locals.authUser = session?.user ?? null;
      response.locals.sessionId = session?.sessionId;
      next();
    } catch (error) {
      next(error);
    }
  };

export const createCurrentUserResolver = (cookieName: string, injectedUserId?: string): RequestHandler =>
  async (request, response, next) => {
    if (injectedUserId) {
      response.locals.userId = injectedUserId;
      next();
      return;
    }
    try {
      const token = readCookie(request.headers.cookie, cookieName);
      const session = token ? await resolveSession(token) : null;
      if (!session) {
        next(new AppError(401, 'AUTH_REQUIRED', 'Sign in to access this resource'));
        return;
      }
      response.locals.userId = session.user.id;
      response.locals.authUser = session.user satisfies AuthenticatedUser;
      response.locals.sessionId = session.sessionId;
      next();
    } catch (error) {
      next(error);
    }
  };
