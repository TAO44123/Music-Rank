import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, rankingEntries, rankings, singingListEntries, songs, userTopListEntries } from '@music-rank/database';
import type { SingingStatus } from '@music-rank/contracts';
import { AppError } from './errors.js';

const songProjection = {
  id: songs.id,
  title: songs.title,
  artist: songs.artist,
  releaseYear: songs.releaseYear
};

export async function listRankings() {
  return db.select({
    id: rankings.id,
    title: rankings.title,
    era: rankings.era,
    sourceType: rankings.sourceType,
    description: rankings.description
  }).from(rankings).where(eq(rankings.isPublished, true));
}

export type RankingFilters = {
  query?: string;
  artist?: string;
  releaseYear?: number;
};

export async function getRanking(rankingId: string, filters: RankingFilters = {}) {
  const [ranking] = await db.select({
    id: rankings.id,
    title: rankings.title,
    era: rankings.era,
    sourceType: rankings.sourceType,
    sourceUrl: rankings.sourceUrl,
    description: rankings.description
  }).from(rankings).where(and(eq(rankings.id, rankingId), eq(rankings.isPublished, true))).limit(1);

  if (!ranking) {
    throw new AppError(404, 'RANKING_NOT_FOUND', 'Ranking not found');
  }

  const searchFilter = filters.query ? or(ilike(songs.title, `%${filters.query}%`), ilike(songs.artist, `%${filters.query}%`)) : undefined;
  const artistFilter = filters.artist ? eq(songs.artist, filters.artist) : undefined;
  const releaseYearFilter = filters.releaseYear ? eq(songs.releaseYear, filters.releaseYear) : undefined;
  const entries = await db.select({ rank: rankingEntries.rank, ...songProjection })
    .from(rankingEntries)
    .innerJoin(songs, eq(rankingEntries.songId, songs.id))
    .where(and(eq(rankingEntries.rankingId, rankingId), searchFilter, artistFilter, releaseYearFilter))
    .orderBy(asc(rankingEntries.rank));

  return { ...ranking, entries };
}

export async function listSongs(query?: string) {
  const filter = query ? or(ilike(songs.title, `%${query}%`), ilike(songs.artist, `%${query}%`)) : undefined;
  return db.select(songProjection).from(songs).where(filter).orderBy(asc(songs.title));
}

async function assertSongExists(songId: string): Promise<void> {
  const [song] = await db.select({ id: songs.id }).from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) {
    throw new AppError(404, 'SONG_NOT_FOUND', 'Song not found');
  }
}

export async function getTopList(userId: string) {
  return db.select({ position: userTopListEntries.position, ...songProjection })
    .from(userTopListEntries)
    .innerJoin(songs, eq(userTopListEntries.songId, songs.id))
    .where(eq(userTopListEntries.userId, userId))
    .orderBy(asc(userTopListEntries.position));
}

export async function addTopListItem(userId: string, songId: string) {
  await assertSongExists(songId);
  return db.transaction(async (transaction) => {
    const existing = await transaction.select({ songId: userTopListEntries.songId, position: userTopListEntries.position })
      .from(userTopListEntries).where(eq(userTopListEntries.userId, userId)).orderBy(asc(userTopListEntries.position));
    if (existing.some((entry) => entry.songId === songId)) {
      throw new AppError(409, 'TOP_LIST_DUPLICATE', 'This song is already in My Top 10');
    }
    if (existing.length >= 10) {
      throw new AppError(409, 'TOP_LIST_CAPACITY_REACHED', 'My Top 10 already contains 10 songs');
    }
    await transaction.insert(userTopListEntries).values({
      id: randomUUID(),
      userId,
      songId,
      position: existing.length + 1
    });
    return transaction.select({ position: userTopListEntries.position, ...songProjection })
      .from(userTopListEntries)
      .innerJoin(songs, eq(userTopListEntries.songId, songs.id))
      .where(eq(userTopListEntries.userId, userId))
      .orderBy(asc(userTopListEntries.position));
  });
}

export async function reorderTopList(userId: string, orderedSongIds: string[]) {
  return db.transaction(async (transaction) => {
    const existing = await transaction.select({ songId: userTopListEntries.songId })
      .from(userTopListEntries).where(eq(userTopListEntries.userId, userId));
    if (existing.length !== orderedSongIds.length || existing.some(({ songId }) => !orderedSongIds.includes(songId))) {
      throw new AppError(400, 'TOP_LIST_ORDER_MISMATCH', 'orderedSongIds must contain every current Top 10 song exactly once');
    }
    await transaction.execute(sql`SET CONSTRAINTS ALL DEFERRED`);
    for (const [index, songId] of orderedSongIds.entries()) {
      await transaction.update(userTopListEntries)
        .set({ position: index + 1, updatedAt: new Date() })
        .where(and(eq(userTopListEntries.userId, userId), eq(userTopListEntries.songId, songId)));
    }
    return transaction.select({ position: userTopListEntries.position, ...songProjection })
      .from(userTopListEntries)
      .innerJoin(songs, eq(userTopListEntries.songId, songs.id))
      .where(eq(userTopListEntries.userId, userId))
      .orderBy(asc(userTopListEntries.position));
  });
}

export async function removeTopListItem(userId: string, songId: string) {
  return db.transaction(async (transaction) => {
    const deleted = await transaction.delete(userTopListEntries)
      .where(and(eq(userTopListEntries.userId, userId), eq(userTopListEntries.songId, songId)))
      .returning({ songId: userTopListEntries.songId });
    if (deleted.length === 0) {
      throw new AppError(404, 'TOP_LIST_ITEM_NOT_FOUND', 'Song is not in My Top 10');
    }
    const remaining = await transaction.select({ songId: userTopListEntries.songId })
      .from(userTopListEntries).where(eq(userTopListEntries.userId, userId)).orderBy(asc(userTopListEntries.position));
    await transaction.execute(sql`SET CONSTRAINTS ALL DEFERRED`);
    for (const [index, entry] of remaining.entries()) {
      await transaction.update(userTopListEntries).set({ position: index + 1, updatedAt: new Date() })
        .where(and(eq(userTopListEntries.userId, userId), eq(userTopListEntries.songId, entry.songId)));
    }
    return transaction.select({ position: userTopListEntries.position, ...songProjection })
      .from(userTopListEntries).innerJoin(songs, eq(userTopListEntries.songId, songs.id))
      .where(eq(userTopListEntries.userId, userId)).orderBy(asc(userTopListEntries.position));
  });
}

export async function getSingingList(userId: string, status?: SingingStatus) {
  return db.select({ status: singingListEntries.status, note: singingListEntries.note, ...songProjection })
    .from(singingListEntries)
    .innerJoin(songs, eq(singingListEntries.songId, songs.id))
    .where(and(eq(singingListEntries.userId, userId), status ? eq(singingListEntries.status, status) : undefined))
    .orderBy(desc(singingListEntries.updatedAt));
}

export async function upsertSingingListItem(userId: string, songId: string, status: SingingStatus, note?: string | null) {
  await assertSongExists(songId);
  await db.insert(singingListEntries).values({ id: randomUUID(), userId, songId, status, note: note ?? null })
    .onConflictDoUpdate({
      target: [singingListEntries.userId, singingListEntries.songId],
      set: { status, note: note ?? null, updatedAt: new Date() }
    });
  return getSingingList(userId);
}

export async function removeSingingListItem(userId: string, songId: string) {
  const deleted = await db.delete(singingListEntries)
    .where(and(eq(singingListEntries.userId, userId), eq(singingListEntries.songId, songId)))
    .returning({ songId: singingListEntries.songId });
  if (deleted.length === 0) {
    throw new AppError(404, 'SINGING_LIST_ITEM_NOT_FOUND', 'Song is not in My Singing List');
  }
}
