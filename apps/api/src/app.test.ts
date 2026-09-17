import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq, inArray } from 'drizzle-orm';
import { authSessions, closeDatabase, db, demoUserId, rankingEntries, rankings, singingListEntries, songs, users, userTopListEntries } from '@music-rank/database';
import { createApp } from './app.js';
import { hashSessionToken } from './auth.js';

const testUserId = '0ec26a67-6b68-4c23-b164-53f02bb49961';
const otherTestUserId = 'eea26a67-6b68-4c23-b164-53f02bb49961';
const app = createApp({ currentUserId: testUserId, enforceOrigin: false });
const otherApp = createApp({ currentUserId: otherTestUserId, enforceOrigin: false });
const allowedOrigin = 'http://localhost:5173';
const authApp = createApp({ allowedOrigin, authRateLimit: { maxAttempts: 100 } });
const authUsernames = ['auth_alice', 'auth_bob', 'auth_case_user'];
const songIds = [
  '1c2a849c-0aef-4cac-a307-45674508f01c', '22cbfd77-7dda-4f3f-a8f3-d001a13c826c', '47d0ae76-7a88-4f7d-ab28-2652d9daebbe', '8e918b13-2c48-4caf-af88-2b92f9bece44',
  'a80d386d-4a0e-4ca6-9d0a-6f8ce4f5106b', 'fd94f558-a2d2-49e2-9a9c-1f2e86d6d7bb', '13ba6493-c42f-4fd8-b805-02a12771ca8b', '82ce9a2f-2a0c-4e6e-b585-afcc7e545a10',
  '3b184b44-e0ef-4985-bf99-d7a61a0d1d25', '1fd5bb6c-718e-46be-a7a5-fb3f694ffb1f', 'f7dcedc9-1f9c-4d68-b288-f2c7947d9ba1'
];
const fixtureRankingIds = [
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000004'
] as const;
const conflictingRankingId = 'a0000000-0000-4000-8000-000000000005';
const submittedSongTitles = [
  'API submitted Top song',
  'API submitted Practice song',
  'API submitted duplicate song',
  'API submitted capacity song',
  'API submitted public song'
];

beforeAll(async () => {
  await db.insert(users).values({ id: testUserId, displayName: 'API Test Listener' })
    .onConflictDoUpdate({ target: users.id, set: { displayName: 'API Test Listener', updatedAt: new Date() } });
  await db.insert(users).values({ id: otherTestUserId, displayName: 'Another API Test Listener' })
    .onConflictDoUpdate({ target: users.id, set: { displayName: 'Another API Test Listener', updatedAt: new Date() } });
  await db.delete(rankings).where(inArray(rankings.id, fixtureRankingIds));
  await db.insert(rankings).values([
    { id: fixtureRankingIds[0], title: '80s Hong Kong/Taiwan Test Ranking', slug: 'test-80s-hk-tw', era: '1980s', decadeStart: 1980, region: 'HK_TW', displayOrder: 1, sourceType: 'MEDIA', sourceUrl: 'https://www.youtube.com/watch?v=80s-hk-tw', isPublished: true },
    { id: fixtureRankingIds[1], title: '80s Mainland Test Ranking', slug: 'test-80s-mainland', era: '1980s', decadeStart: 1980, region: 'MAINLAND', displayOrder: 2, sourceType: 'MEDIA', sourceUrl: 'https://www.youtube.com/watch?v=80s-mainland', isPublished: true },
    { id: fixtureRankingIds[2], title: '90s Hong Kong/Taiwan Test Ranking', slug: 'test-90s-hk-tw', era: '1990s', decadeStart: 1990, region: 'HK_TW', displayOrder: 3, sourceType: 'MEDIA', sourceUrl: 'https://www.youtube.com/watch?v=90s-hk-tw', isPublished: true },
    { id: fixtureRankingIds[3], title: 'General Test Ranking', slug: 'test-general', era: null, decadeStart: null, region: null, displayOrder: 4, sourceType: 'MEDIA', sourceUrl: 'https://www.youtube.com/watch?v=general', isPublished: true }
  ]);
  await db.insert(rankingEntries).values([
    { id: 'b0000000-0000-4000-8000-000000000001', rankingId: fixtureRankingIds[0], songId: songIds[1], rank: 1, verificationStatus: 'DEMO' },
    { id: 'b0000000-0000-4000-8000-000000000002', rankingId: fixtureRankingIds[0], songId: songIds[0], rank: 2, verificationStatus: 'DEMO' },
    { id: 'b0000000-0000-4000-8000-000000000003', rankingId: fixtureRankingIds[1], songId: songIds[0], rank: 1, verificationStatus: 'DEMO' },
    { id: 'b0000000-0000-4000-8000-000000000004', rankingId: fixtureRankingIds[2], songId: songIds[2], rank: 1, verificationStatus: 'DEMO' },
    { id: 'b0000000-0000-4000-8000-000000000005', rankingId: fixtureRankingIds[3], songId: songIds[0], rank: 1, verificationStatus: 'DEMO' },
    { id: 'b0000000-0000-4000-8000-000000000006', rankingId: fixtureRankingIds[3], songId: songIds[1], rank: 2, verificationStatus: 'DEMO' }
  ]);
});

beforeEach(async () => {
  await db.delete(userTopListEntries).where(eq(userTopListEntries.userId, testUserId));
  await db.delete(singingListEntries).where(eq(singingListEntries.userId, testUserId));
  await db.delete(userTopListEntries).where(eq(userTopListEntries.userId, otherTestUserId));
  await db.delete(singingListEntries).where(eq(singingListEntries.userId, otherTestUserId));
  await db.delete(users).where(inArray(users.username, authUsernames));
  await db.delete(songs).where(inArray(songs.title, submittedSongTitles));
});

afterAll(async () => {
  await db.delete(rankings).where(eq(rankings.id, conflictingRankingId));
  await db.delete(rankings).where(inArray(rankings.id, fixtureRankingIds));
  await db.delete(users).where(inArray(users.username, authUsernames));
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, otherTestUserId));
  await db.delete(songs).where(inArray(songs.title, submittedSongTitles));
  await closeDatabase();
});

describe('Authentication and public lists', () => {
  const register = (agent: ReturnType<typeof request.agent>, username: string, displayName: string) =>
    agent.post('/api/auth/register').set('Origin', allowedOrigin).send({ username, displayName, password: 'correct horse battery staple' });

  it('registers, restores, and revokes an opaque cookie session', async () => {
    const agent = request.agent(authApp);
    const registration = await register(agent, 'auth_alice', 'Alice Listener').expect(201);
    expect(registration.body).toEqual({ user: expect.objectContaining({ username: 'auth_alice', displayName: 'Alice Listener' }) });
    expect(registration.headers['set-cookie']?.[0]).toMatch(/music_rank_session=.*HttpOnly.*SameSite=Lax/);
    await agent.get('/api/auth/session').expect(200).expect(({ body }) => expect(body.user.username).toBe('auth_alice'));
    await agent.get('/api/me/top-list').expect(200).expect('Cache-Control', 'private, no-store');
    await agent.post('/api/auth/logout').set('Origin', allowedOrigin).expect(204);
    await agent.get('/api/me/top-list').expect(401).expect(({ body }) => expect(body.code).toBe('AUTH_REQUIRED'));
  });

  it('rejects and removes expired sessions', async () => {
    const agent = request.agent(authApp);
    const registration = await register(agent, 'auth_alice', 'Alice Listener').expect(201);
    const cookie = registration.headers['set-cookie']?.[0] as unknown as string;
    const token = /music_rank_session=([^;]+)/.exec(cookie)?.[1];
    expect(token).toBeTruthy();
    await db.update(authSessions).set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(authSessions.tokenHash, hashSessionToken(token!)));
    await agent.get('/api/me/top-list').expect(401);
    const remaining = await db.select({ id: authSessions.id }).from(authSessions)
      .where(eq(authSessions.tokenHash, hashSessionToken(token!)));
    expect(remaining).toHaveLength(0);
  });

  it('normalizes usernames and does not enumerate accounts on login', async () => {
    const agent = request.agent(authApp);
    await register(agent, 'Auth_Case_User', 'Case Listener').expect(201);
    await request(authApp).post('/api/auth/register').set('Origin', allowedOrigin)
      .send({ username: 'auth_case_user', displayName: 'Duplicate', password: 'another secure passphrase' })
      .expect(409).expect(({ body }) => expect(body.code).toBe('USERNAME_TAKEN'));
    const wrongPassword = await request(authApp).post('/api/auth/login').set('Origin', allowedOrigin)
      .send({ username: 'auth_case_user', password: 'definitely incorrect' }).expect(401);
    const missingUser = await request(authApp).post('/api/auth/login').set('Origin', allowedOrigin)
      .send({ username: 'auth_bob', password: 'definitely incorrect' }).expect(401);
    expect(wrongPassword.body).toEqual(missingUser.body);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects unsafe requests from an unapproved origin', async () => {
    await request(authApp).post('/api/auth/register')
      .send({ username: 'auth_alice', displayName: 'Alice', password: 'correct horse battery staple' })
      .expect(403).expect(({ body }) => expect(body.code).toBe('INVALID_ORIGIN'));
  });

  it('rejects anonymous user-submitted songs', async () => {
    await request(authApp).post('/api/me/top-list/items').set('Origin', allowedOrigin)
      .send({ song: { title: 'API submitted Top song', artist: 'API Artist' } })
      .expect(401).expect(({ body }) => expect(body.code).toBe('AUTH_REQUIRED'));
  });

  it('isolates users and publishes only approved list fields', async () => {
    const alice = request.agent(authApp);
    const bob = request.agent(authApp);
    await register(alice, 'auth_alice', 'Alice Listener').expect(201);
    await register(bob, 'auth_bob', 'Bob Listener').expect(201);

    await alice.post('/api/me/top-list/items').set('Origin', allowedOrigin).send({ songId: songIds[0] }).expect(201);
    await alice.put(`/api/me/singing-list/items/${songIds[0]}`).set('Origin', allowedOrigin)
      .send({ status: 'PRACTICING', note: 'This note is private.' }).expect(200);
    await bob.get('/api/me/top-list').expect(200).expect([]);
    await bob.delete(`/api/me/top-list/items/${songIds[0]}`).set('Origin', allowedOrigin).expect(404);
    await alice.get('/api/me/top-list').expect(200).expect(({ body }) => expect(body).toHaveLength(1));
    await request(authApp).get('/api/users/auth_alice').expect(404);

    await alice.patch('/api/me/lists/top-list/visibility').set('Origin', allowedOrigin).send({ visibility: 'PUBLIC' }).expect(200);
    await alice.patch('/api/me/lists/singing-list/visibility').set('Origin', allowedOrigin).send({ visibility: 'PUBLIC' }).expect(200);
    await request(authApp).get('/api/users/auth_alice').expect(200)
      .expect(({ body }) => expect(body.lists).toEqual({ topList: 'PUBLIC', singingList: 'PUBLIC' }));
    await request(authApp).get('/api/users/auth_alice/top-list').expect(200).expect('Cache-Control', 'no-store')
      .expect(({ body }) => expect(body).toMatchObject([{ id: songIds[0], position: 1 }]));
    await request(authApp).get('/api/users/auth_alice/singing-list').expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject([{ id: songIds[0], status: 'PRACTICING' }]);
        expect(body[0]).not.toHaveProperty('note');
      });

    await alice.patch('/api/me/lists/singing-list/visibility').set('Origin', allowedOrigin).send({ visibility: 'PRIVATE' }).expect(200);
    await request(authApp).get('/api/users/auth_alice/singing-list').expect(404);
  });

  it('rate limits repeated authentication attempts', async () => {
    const limitedApp = createApp({ allowedOrigin, authRateLimit: { maxAttempts: 1, windowMs: 60_000 } });
    const attempt = () => request(limitedApp).post('/api/auth/login').set('Origin', allowedOrigin)
      .send({ username: 'auth_bob', password: 'definitely incorrect' });
    await attempt().expect(401);
    await attempt().expect(429).expect(({ body }) => expect(body.code).toBe('AUTH_RATE_LIMITED'));
  });

  it('keeps the existing demo account credential-free and private by default', async () => {
    const [demoUser] = await db.select({ username: users.username }).from(users).where(eq(users.id, demoUserId));
    expect(demoUser).toEqual({ username: null });
    await request(authApp).get(`/api/users/${demoUserId}`).expect(400);
  });
});

describe('Music Rank API', () => {
  it('lists only published rankings in deterministic catalog order', async () => {
    await request(app).get('/api/rankings').expect(200).expect(({ body }) => {
      const fixtureIds = new Set<string>([...fixtureRankingIds]);
      const fixtures = body.filter((ranking: { id: string }) => fixtureIds.has(ranking.id));
      expect(fixtures.map((ranking: { id: string }) => ranking.id)).toEqual(fixtureRankingIds);
      expect(fixtures.map((ranking: { decade: string | null; region: string | null }) => [ranking.decade, ranking.region])).toEqual([
        ['80s', 'hk-tw'], ['80s', 'mainland'], ['90s', 'hk-tw'], [null, null]
      ]);
      expect(fixtures.every((ranking: { hasSource: boolean }) => ranking.hasSource)).toBe(true);
      expect(fixtures.every((ranking: Record<string, unknown>) => !('sourceUrl' in ranking))).toBe(true);
    });
  });

  it('allows multiple published rankings to share optional catalog metadata', async () => {
    await db.insert(rankings).values({
      id: conflictingRankingId,
      title: 'Another 80s Hong Kong/Taiwan Ranking',
      slug: 'test-another-80s-hk-tw-ranking',
      era: '1980s',
      decadeStart: 1980,
      region: 'HK_TW',
      displayOrder: 98,
      sourceType: 'MEDIA',
      isPublished: true
    });
    expect(await db.select().from(rankings).where(eq(rankings.id, conflictingRankingId))).toHaveLength(1);
    await db.delete(rankings).where(eq(rankings.id, conflictingRankingId));
  });

  it('searches a ranking by song title and artist', async () => {
    const path = '/api/rankings/test-general';
    await request(app).get(`${path}?q=%E6%B6%9B%E5%A3%B0`).expect(200).expect(({ body }) => {
      expect(body.entries).toHaveLength(1);
      expect(body.songCount).toBe(2);
    });
    await request(app).get(`${path}?q=%E6%AF%9B%E5%AE%81`).expect(200).expect(({ body }) => expect(body.entries[0].artist).toBe('毛宁'));
    await request(app).get(path).query({ artist: '毛宁', releaseYear: 1993 }).expect(200).expect(({ body }) => expect(body.entries).toMatchObject([{ title: '涛声依旧', artist: '毛宁', releaseYear: 1993 }]));
  });

  it('scopes filter facets and ranks to the selected ranking', async () => {
    await request(app).get('/api/rankings/test-80s-hk-tw').expect(200).expect(({ body }) => {
      expect(body.sourceUrl).toBe('https://www.youtube.com/watch?v=80s-hk-tw');
      expect(body.entries.map((entry: { rank: number }) => entry.rank)).toEqual([1, 2]);
      expect(body.facets.artists).toEqual(expect.arrayContaining(['杨钰莹', '毛宁']));
      expect(body.facets.artists).not.toContain('那英');
      expect(body.facets.releaseYears).toEqual([1993, 1992]);
    });
    await request(app).get('/api/rankings/test-general').expect(200)
      .expect(({ body }) => expect(body.entries.find((entry: { id: string }) => entry.id === songIds[0]).rank).toBe(1));
    await request(app).get('/api/rankings/test-80s-hk-tw').expect(200)
      .expect(({ body }) => expect(body.entries.find((entry: { id: string }) => entry.id === songIds[0]).rank).toBe(2));
  });

  it('returns 404 for an unpublished slug and rejects an invalid slug', async () => {
    await db.update(rankings).set({ isPublished: false }).where(eq(rankings.id, fixtureRankingIds[2]));
    try {
      await request(app).get('/api/rankings/test-90s-hk-tw').expect(404)
        .expect(({ body }) => expect(body.code).toBe('RANKING_NOT_FOUND'));
    } finally {
      await db.update(rankings).set({ isPublished: true }).where(eq(rankings.id, fixtureRankingIds[2]));
    }
    await request(app).get('/api/rankings/INVALID').expect(400)
      .expect(({ body }) => expect(body.code).toBe('INVALID_REQUEST'));
  });

  it('prevents duplicate and eleventh Top 10 entries', async () => {
    await request(app).post('/api/me/top-list/items').send({ songId: songIds[0] }).expect(201);
    await request(app).post('/api/me/top-list/items').send({ songId: songIds[0] }).expect(409).expect(({ body }) => expect(body.code).toBe('TOP_LIST_DUPLICATE'));
    for (const songId of songIds.slice(1, 10)) await request(app).post('/api/me/top-list/items').send({ songId }).expect(201);
    await request(app).post('/api/me/top-list/items').send({ songId: songIds[10] }).expect(409).expect(({ body }) => expect(body.code).toBe('TOP_LIST_CAPACITY_REACHED'));
  });

  it('creates an attributed unverified song and atomically adds it to My Top 10 without ranking entries', async () => {
    const response = await request(app).post('/api/me/top-list/items')
      .send({ song: { title: ' API submitted Top song ', artist: ' API Artist ' } })
      .expect(201);
    const submittedSong = response.body[0];
    expect(submittedSong).toMatchObject({ title: 'API submitted Top song', artist: 'API Artist', position: 1 });
    const [storedSong] = await db.select({ id: songs.id, verificationStatus: songs.verificationStatus, submittedByUserId: songs.submittedByUserId })
      .from(songs).where(eq(songs.id, submittedSong.id));
    expect(storedSong).toEqual({ id: submittedSong.id, verificationStatus: 'UNVERIFIED', submittedByUserId: testUserId });
    expect(await db.select({ id: rankingEntries.id }).from(rankingEntries).where(eq(rankingEntries.songId, submittedSong.id))).toHaveLength(0);
  });

  it('returns a safe confirmation response for an exact normalized duplicate and reuses it after confirmation', async () => {
    const first = await request(app).post('/api/me/singing-list/items')
      .send({ song: { title: 'API submitted Practice song', artist: 'API Artist' } }).expect(201);
    const submittedSongId = first.body[0].id as string;
    await request(app).post('/api/me/top-list/items')
      .send({ song: { title: ' api submitted practice song ', artist: 'api artist' } })
      .expect(409).expect(({ body }) => {
        expect(body).toEqual({
          code: 'SONG_ALREADY_EXISTS',
          message: 'This song already exists. Confirm that you want to use it.',
          existingSong: { id: submittedSongId, title: 'API submitted Practice song', artist: 'API Artist' }
        });
      });
    await request(app).post('/api/me/top-list/items').send({ songId: submittedSongId }).expect(201);
    expect(await db.select({ id: songs.id }).from(songs).where(eq(songs.id, submittedSongId))).toHaveLength(1);
  });

  it('creates only one shared song when matching submissions race', async () => {
    await db.delete(userTopListEntries).where(eq(userTopListEntries.userId, testUserId));
    await db.delete(songs).where(eq(songs.normalizedTitle, 'api submitted duplicate song'));
    const responses = await Promise.all([
      request(app).post('/api/me/top-list/items').send({ song: { title: 'API submitted duplicate song', artist: 'API Artist' } }),
      request(app).post('/api/me/top-list/items').send({ song: { title: ' api submitted duplicate song ', artist: 'api artist' } })
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const duplicate = responses.find((response) => response.status === 409)?.body;
    expect(duplicate).toMatchObject({ code: 'SONG_ALREADY_EXISTS', existingSong: { id: expect.any(String) } });
    expect(duplicate.existingSong.title.toLowerCase()).toBe('api submitted duplicate song');
    expect(duplicate.existingSong.artist.toLowerCase()).toBe('api artist');
    expect(await db.select({ id: songs.id }).from(songs).where(and(
      eq(songs.normalizedTitle, 'api submitted duplicate song'),
      eq(songs.normalizedArtist, 'api artist')
    ))).toHaveLength(1);
  });

  it('lets another user discover and reuse a submitted shared song', async () => {
    const created = await request(app).post('/api/me/top-list/items')
      .send({ song: { title: 'API submitted public song', artist: 'API Artist' } }).expect(201);
    const songId = created.body[0].id as string;
    await request(otherApp).get('/api/songs').query({ q: 'submitted public' }).expect(200)
      .expect(({ body }) => expect(body).toMatchObject([{ id: songId, title: 'API submitted public song', artist: 'API Artist' }]));
    await request(otherApp).post('/api/me/singing-list/items').send({ songId }).expect(201)
      .expect(({ body }) => expect(body).toMatchObject([{ id: songId, status: 'WANT_TO_LEARN', note: null }]));
  });

  it('does not leave a submitted song behind when My Top 10 is full', async () => {
    for (const songId of songIds.slice(0, 10)) await request(app).post('/api/me/top-list/items').send({ songId }).expect(201);
    await request(app).post('/api/me/top-list/items')
      .send({ song: { title: 'API submitted capacity song', artist: 'API Artist' } })
      .expect(409).expect(({ body }) => expect(body.code).toBe('TOP_LIST_CAPACITY_REACHED'));
    expect(await db.select({ id: songs.id }).from(songs).where(eq(songs.title, 'API submitted capacity song'))).toHaveLength(0);
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

  it('adds a submitted song to Practice Library with the default status and no note', async () => {
    await request(app).post('/api/me/singing-list/items')
      .send({ song: { title: 'API submitted Practice song', artist: 'API Artist' } })
      .expect(201).expect(({ body }) => expect(body).toMatchObject([{
        title: 'API submitted Practice song', artist: 'API Artist', status: 'WANT_TO_LEARN', note: null
      }]));
  });
});
