import crypto from 'node:crypto';
import express from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@music-rank/database';
import {
  addTopListItemSchema,
  artistFilterSchema,
  rankingIdSchema,
  releaseYearFilterSchema,
  reorderTopListSchema,
  searchQuerySchema,
  singingStatusSchema,
  songIdSchema,
  upsertSingingListItemSchema
} from '@music-rank/contracts';
import { createCurrentUserResolver } from './current-user.js';
import { asyncRoute, errorHandler } from './errors.js';
import {
  addTopListItem,
  getRanking,
  getSingingList,
  getTopList,
  listRankings,
  listSongs,
  removeSingingListItem,
  removeTopListItem,
  reorderTopList,
  upsertSingingListItem
} from './services.js';

const parseQuery = (value: unknown) => searchQuerySchema.parse(typeof value === 'string' ? value : undefined);

export function createApp({ currentUserId }: { currentUserId?: string } = {}) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use((request, response, next) => {
    const requestId = crypto.randomUUID();
    response.locals.requestId = requestId;
    const startedAt = Date.now();
    response.on('finish', () => console.log(JSON.stringify({ level: 'info', requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - startedAt })));
    next();
  });

  app.get('/api/health', asyncRoute(async (_request, response) => {
    await db.execute(sql`SELECT 1`);
    response.json({ status: 'ok', database: 'ok' });
  }));

  app.get('/api/rankings', asyncRoute(async (_request, response) => response.json(await listRankings())));
  app.get('/api/rankings/:rankingId', asyncRoute(async (request, response) => {
    const rankingId = rankingIdSchema.parse(request.params.rankingId);
    response.json(await getRanking(rankingId, {
      query: parseQuery(request.query.q),
      artist: artistFilterSchema.parse(request.query.artist),
      releaseYear: releaseYearFilterSchema.parse(request.query.releaseYear)
    }));
  }));
  app.get('/api/songs', asyncRoute(async (request, response) => response.json(await listSongs(parseQuery(request.query.q)))));

  app.use('/api/me', createCurrentUserResolver(currentUserId));
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
