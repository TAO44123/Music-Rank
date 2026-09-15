import crypto from 'node:crypto';
import express from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@music-rank/database';
import {
  addTopListItemSchema,
  artistFilterSchema,
  listTypePathSchema,
  loginSchema,
  rankingSlugSchema,
  registerSchema,
  releaseYearFilterSchema,
  reorderTopListSchema,
  searchQuerySchema,
  singingStatusSchema,
  songIdSchema,
  updateListVisibilitySchema,
  usernameSchema,
  upsertSingingListItemSchema
} from '@music-rank/contracts';
import { authenticatePassword, createSession, registerUser, revokeSession, sessionDurationMs } from './auth.js';
import { createCurrentUserResolver, createOptionalCurrentUserResolver, readCookie } from './current-user.js';
import { asyncRoute, errorHandler } from './errors.js';
import { createAuthRateLimiter, createOriginGuard } from './security.js';
import {
  addTopListItem,
  getRanking,
  getListSettings,
  getPublicProfile,
  getPublicSingingList,
  getPublicTopList,
  getSingingList,
  getTopList,
  listRankings,
  listSongs,
  removeSingingListItem,
  removeTopListItem,
  reorderTopList,
  updateListVisibility,
  upsertSingingListItem
} from './services.js';

const parseQuery = (value: unknown) => searchQuerySchema.parse(typeof value === 'string' ? value : undefined);

type AppOptions = {
  currentUserId?: string;
  allowedOrigin?: string;
  authRateLimit?: { maxAttempts?: number; windowMs?: number };
  enforceOrigin?: boolean;
};

function getCookieConfiguration(allowedOrigin: string) {
  const secure = new URL(allowedOrigin).protocol === 'https:';
  return {
    name: secure ? '__Host-music_rank_session' : 'music_rank_session',
    options: { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' }
  };
}

export function createApp({ currentUserId, allowedOrigin = process.env.APP_ORIGIN ?? 'http://localhost:5173', authRateLimit, enforceOrigin = true }: AppOptions = {}) {
  const app = express();
  const normalizedOrigin = new URL(allowedOrigin).origin;
  const sessionCookie = getCookieConfiguration(normalizedOrigin);
  app.use(express.json({ limit: '32kb' }));
  app.use((request, response, next) => {
    const requestId = crypto.randomUUID();
    response.locals.requestId = requestId;
    const startedAt = Date.now();
    response.on('finish', () => console.log(JSON.stringify({ level: 'info', requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - startedAt })));
    next();
  });
  if (enforceOrigin) app.use(createOriginGuard(normalizedOrigin));

  app.get('/api/health', asyncRoute(async (_request, response) => {
    await db.execute(sql`SELECT 1`);
    response.json({ status: 'ok', database: 'ok' });
  }));

  app.get('/api/rankings', asyncRoute(async (_request, response) => response.json(await listRankings())));
  app.get('/api/rankings/:slug', asyncRoute(async (request, response) => {
    const slug = rankingSlugSchema.parse(request.params.slug);
    response.json(await getRanking(slug, {
      query: parseQuery(request.query.q),
      artist: artistFilterSchema.parse(request.query.artist),
      releaseYear: releaseYearFilterSchema.parse(request.query.releaseYear)
    }));
  }));
  app.get('/api/songs', asyncRoute(async (request, response) => response.json(await listSongs(parseQuery(request.query.q)))));

  const authLimiter = createAuthRateLimiter(authRateLimit);
  app.post('/api/auth/register', authLimiter, asyncRoute(async (request, response) => {
    const input = registerSchema.parse(request.body);
    const { user, session } = await registerUser(input);
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(sessionCookie.name, session.token, { ...sessionCookie.options, maxAge: sessionDurationMs });
    response.status(201).json({ user });
  }));
  app.post('/api/auth/login', authLimiter, asyncRoute(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const user = await authenticatePassword(input.username, input.password);
    const session = await createSession(user.id);
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(sessionCookie.name, session.token, { ...sessionCookie.options, maxAge: sessionDurationMs });
    response.json({ user });
  }));
  app.post('/api/auth/logout', asyncRoute(async (request, response) => {
    const token = readCookie(request.headers.cookie, sessionCookie.name);
    if (token) await revokeSession(token);
    response.setHeader('Cache-Control', 'no-store');
    response.clearCookie(sessionCookie.name, sessionCookie.options);
    response.status(204).send();
  }));
  app.get('/api/auth/session', createOptionalCurrentUserResolver(sessionCookie.name), (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json({ user: response.locals.authUser ?? null });
  });

  app.use('/api/users', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/users/:username', asyncRoute(async (request, response) => {
    const username = usernameSchema.parse(request.params.username);
    response.json(await getPublicProfile(username));
  }));
  app.get('/api/users/:username/top-list', asyncRoute(async (request, response) => {
    const username = usernameSchema.parse(request.params.username);
    response.json(await getPublicTopList(username));
  }));
  app.get('/api/users/:username/singing-list', asyncRoute(async (request, response) => {
    const username = usernameSchema.parse(request.params.username);
    response.json(await getPublicSingingList(username));
  }));

  app.use('/api/me', createCurrentUserResolver(sessionCookie.name, currentUserId));
  app.use('/api/me', (_request, response, next) => {
    response.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  app.get('/api/me/list-settings', asyncRoute(async (_request, response) => response.json(await getListSettings(response.locals.userId))));
  app.patch('/api/me/lists/:listType/visibility', asyncRoute(async (request, response) => {
    const listType = listTypePathSchema.parse(request.params.listType);
    const { visibility } = updateListVisibilitySchema.parse(request.body);
    response.json(await updateListVisibility(response.locals.userId, listType, visibility));
  }));
  app.get('/api/me/top-list', asyncRoute(async (_request, response) => response.json(await getTopList(response.locals.userId))));
  app.post('/api/me/top-list/items', asyncRoute(async (request, response) => {
    const { songId } = addTopListItemSchema.parse(request.body);
    response.status(201).json(await addTopListItem(response.locals.userId, songId));
  }));
  app.patch('/api/me/top-list/order', asyncRoute(async (request, response) => {
    const { orderedSongIds } = reorderTopListSchema.parse(request.body);
    response.json(await reorderTopList(response.locals.userId, orderedSongIds));
  }));
  app.delete('/api/me/top-list/items/:songId', asyncRoute(async (request, response) => {
    const songId = songIdSchema.parse(request.params.songId);
    response.json(await removeTopListItem(response.locals.userId, songId));
  }));

  app.get('/api/me/singing-list', asyncRoute(async (request, response) => {
    const status = request.query.status === undefined ? undefined : singingStatusSchema.parse(request.query.status);
    response.json(await getSingingList(response.locals.userId, status));
  }));
  app.put('/api/me/singing-list/items/:songId', asyncRoute(async (request, response) => {
    const songId = songIdSchema.parse(request.params.songId);
    const { status, note } = upsertSingingListItemSchema.parse(request.body);
    response.json(await upsertSingingListItem(response.locals.userId, songId, status, note));
  }));
  app.delete('/api/me/singing-list/items/:songId', asyncRoute(async (request, response) => {
    const songId = songIdSchema.parse(request.params.songId);
    await removeSingingListItem(response.locals.userId, songId);
    response.status(204).send();
  }));

  app.use(errorHandler);
  return app;
}
