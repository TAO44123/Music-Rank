import type { RequestHandler } from 'express';
import { demoUserId } from '@music-rank/database';

export const createCurrentUserResolver = (userId = demoUserId): RequestHandler =>
  (_request, response, next) => {
    response.locals.userId = userId;
    next();
  };
