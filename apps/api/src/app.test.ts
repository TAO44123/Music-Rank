import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { closeDatabase, db, singingListEntries, users, userTopListEntries } from '@music-rank/database';
import { createApp } from './app.js';

const testUserId = '0ec26a67-6b68-4c23-b164-53f02bb49961';
const app = createApp({ currentUserId: testUserId });
const songIds = [
  '1c2a849c-0aef-4cac-a307-45674508f01c', '22cbfd77-7dda-4f3f-a8f3-d001a13c826c', '47d0ae76-7a88-4f7d-ab28-2652d9daebbe', '8e918b13-2c48-4caf-af88-2b92f9bece44',
  'a80d386d-4a0e-4ca6-9d0a-6f8ce4f5106b', 'fd94f558-a2d2-49e2-9a9c-1f2e86d6d7bb', '13ba6493-c42f-4fd8-b805-02a12771ca8b', '82ce9a2f-2a0c-4e6e-b585-afcc7e545a10',
  '3b184b44-e0ef-4985-bf99-d7a61a0d1d25', '1fd5bb6c-718e-46be-a7a5-fb3f694ffb1f', 'f7dcedc9-1f9c-4d68-b288-f2c7947d9ba1'
];

beforeAll(async () => {
  await db.insert(users).values({ id: testUserId, displayName: 'API Test Listener' })
    .onConflictDoUpdate({ target: users.id, set: { displayName: 'API Test Listener', updatedAt: new Date() } });
});

beforeEach(async () => {
  await db.delete(userTopListEntries).where(eq(userTopListEntries.userId, testUserId));
  await db.delete(singingListEntries).where(eq(singingListEntries.userId, testUserId));
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
  await closeDatabase();
});

describe('Music Rank API', () => {
  it('searches a ranking by song title and artist', async () => {
    const rankings = await request(app).get('/api/rankings').expect(200);
    const rankingId = rankings.body[0].id;
    await request(app).get(`/api/rankings/${rankingId}?q=%E6%B6%9B%E5%A3%B0`).expect(200).expect(({ body }) => expect(body.entries).toHaveLength(1));
    await request(app).get(`/api/rankings/${rankingId}?q=%E6%AF%9B%E5%AE%81`).expect(200).expect(({ body }) => expect(body.entries[0].artist).toBe('毛宁'));
    await request(app).get(`/api/rankings/${rankingId}`).query({ artist: '毛宁', releaseYear: 1993 }).expect(200).expect(({ body }) => expect(body.entries).toMatchObject([{ title: '涛声依旧', artist: '毛宁', releaseYear: 1993 }]));
  });

  it('prevents duplicate and eleventh Top 10 entries', async () => {
    await request(app).post('/api/me/top-list/items').send({ songId: songIds[0] }).expect(201);
    await request(app).post('/api/me/top-list/items').send({ songId: songIds[0] }).expect(409).expect(({ body }) => expect(body.code).toBe('TOP_LIST_DUPLICATE'));
    for (const songId of songIds.slice(1, 10)) await request(app).post('/api/me/top-list/items').send({ songId }).expect(201);
    await request(app).post('/api/me/top-list/items').send({ songId: songIds[10] }).expect(409).expect(({ body }) => expect(body.code).toBe('TOP_LIST_CAPACITY_REACHED'));
  });

  it('reorders atomically and closes Top 10 position gaps on removal', async () => {
    for (const songId of songIds.slice(0, 3)) await request(app).post('/api/me/top-list/items').send({ songId }).expect(201);
    const reordered = [songIds[2], songIds[0], songIds[1]];
    await request(app).patch('/api/me/top-list/order').send({ orderedSongIds: reordered }).expect(200).expect(({ body }) => expect(body.map((entry: { id: string }) => entry.id)).toEqual(reordered));
    await request(app).delete(`/api/me/top-list/items/${songIds[0]}`).expect(200).expect(({ body }) => expect(body.map((entry: { position: number }) => entry.position)).toEqual([1, 2]));
  });

  it('updates and filters a singing-list entry independently of My Top 10', async () => {
    await request(app).post('/api/me/top-list/items').send({ songId: songIds[0] }).expect(201);
    await request(app).put(`/api/me/singing-list/items/${songIds[0]}`).send({ status: 'WANT_TO_LEARN', note: 'Start with the chorus.' }).expect(200);
    await request(app).put(`/api/me/singing-list/items/${songIds[0]}`).send({ status: 'PRACTICING', note: 'Work on the bridge.' }).expect(200);
    await request(app).get('/api/me/singing-list?status=PRACTICING').expect(200).expect(({ body }) => expect(body).toMatchObject([{ id: songIds[0], status: 'PRACTICING', note: 'Work on the bridge.' }]));
    await request(app).delete(`/api/me/top-list/items/${songIds[0]}`).expect(200);
    await request(app).get('/api/me/singing-list?status=PRACTICING').expect(200).expect(({ body }) => expect(body).toHaveLength(1));
  });
});
