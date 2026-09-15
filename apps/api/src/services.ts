import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, rankingEntries, rankings, singingListEntries, songs, userListSettings, users, userTopListEntries } from '@music-rank/database';
import type { ListType, ListVisibility, RankingDecade, RankingRegionPath, SingingStatus } from '@music-rank/contracts';
import { AppError } from './errors.js';

const songProjection = {
  id: songs.id,
  title: songs.title,
  artist: songs.artist,
  releaseYear: songs.releaseYear
};

const decadePaths = new Map<number, RankingDecade>([[1980, '80s'], [1990, '90s']]);
const regionPaths: Record<'HK_TW' | 'MAINLAND', RankingRegionPath> = { HK_TW: 'hk-tw', MAINLAND: 'mainland' };

function rankingCatalogProjection() {
  return {
    id: rankings.id,
    title: rankings.title,
    slug: rankings.slug,
    era: rankings.era,
    decadeStart: rankings.decadeStart,
    region: rankings.region,
    displayOrder: rankings.displayOrder,
    sourceType: rankings.sourceType,
    sourceUrl: rankings.sourceUrl,
    description: rankings.description
  };
}

function toRankingCatalogItem(ranking: Awaited<ReturnType<typeof selectPublishedRankings>>[number]) {
  const decade = ranking.decadeStart === null ? null : decadePaths.get(ranking.decadeStart);
  if (ranking.decadeStart !== null && !decade) throw new Error(`Unsupported published ranking decade: ${ranking.decadeStart}`);
  return {
    ...ranking,
    decade: decade ?? null,
    region: ranking.region === null ? null : regionPaths[ranking.region],
    hasSource: ranking.sourceUrl !== null
  };
}

function selectPublishedRankings() {
  return db.select(rankingCatalogProjection())
    .from(rankings)
    .where(eq(rankings.isPublished, true))
    .orderBy(asc(rankings.displayOrder), asc(rankings.title));
}

export async function listRankings() {
  return (await selectPublishedRankings()).map((ranking) => {
    const { sourceUrl: _sourceUrl, ...catalogItem } = toRankingCatalogItem(ranking);
    return catalogItem;
  });
}

export type RankingFilters = {
  query?: string;
  artist?: string;
  releaseYear?: number;
};

export async function getRanking(slug: string, filters: RankingFilters = {}) {
  const [ranking] = await db.select(rankingCatalogProjection())
    .from(rankings)
    .where(and(
      eq(rankings.slug, slug),
      eq(rankings.isPublished, true)
    ))
    .limit(1);

  if (!ranking) {
    throw new AppError(404, 'RANKING_NOT_FOUND', 'Ranking not found');
  }

  const searchFilter = filters.query ? or(ilike(songs.title, `%${filters.query}%`), ilike(songs.artist, `%${filters.query}%`)) : undefined;
  const artistFilter = filters.artist ? eq(songs.artist, filters.artist) : undefined;
  const releaseYearFilter = filters.releaseYear ? eq(songs.releaseYear, filters.releaseYear) : undefined;
  const [entries, catalogSongs] = await Promise.all([
    db.select({ rank: rankingEntries.rank, ...songProjection })
      .from(rankingEntries)
      .innerJoin(songs, eq(rankingEntries.songId, songs.id))
      .where(and(eq(rankingEntries.rankingId, ranking.id), searchFilter, artistFilter, releaseYearFilter))
      .orderBy(asc(rankingEntries.rank)),
    db.select(songProjection)
      .from(rankingEntries)
      .innerJoin(songs, eq(rankingEntries.songId, songs.id))
      .where(eq(rankingEntries.rankingId, ranking.id))
  ]);

  const facets = {
    artists: Array.from(new Set(catalogSongs.map((song) => song.artist))).sort((left, right) => left.localeCompare(right)),
    releaseYears: Array.from(new Set(catalogSongs.flatMap((song) => song.releaseYear === null ? [] : [song.releaseYear]))).sort((left, right) => right - left)
  };

  return { ...toRankingCatalogItem(ranking), songCount: catalogSongs.length, facets, entries };
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
    throw new AppError(404, 'SINGING_LIST_ITEM_NOT_FOUND', 'Song is not in My Practice Library');
  }
}

export type EffectiveListSettings = {
  topList: ListVisibility;
  singingList: ListVisibility;
};

export async function getListSettings(userId: string): Promise<EffectiveListSettings> {
  const settings = await db.select({ listType: userListSettings.listType, visibility: userListSettings.visibility })
    .from(userListSettings)
    .where(eq(userListSettings.userId, userId));
  return {
    topList: settings.find(({ listType }) => listType === 'TOP_LIST')?.visibility ?? 'PRIVATE',
    singingList: settings.find(({ listType }) => listType === 'SINGING_LIST')?.visibility ?? 'PRIVATE'
  };
}

export async function updateListVisibility(userId: string, listType: ListType, visibility: ListVisibility): Promise<EffectiveListSettings> {
  await db.insert(userListSettings).values({ userId, listType, visibility })
    .onConflictDoUpdate({
      target: [userListSettings.userId, userListSettings.listType],
      set: { visibility, updatedAt: new Date() }
    });
  return getListSettings(userId);
}

async function getUserByUsername(username: string) {
  const [user] = await db.select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return user?.username ? { id: user.id, username: user.username, displayName: user.displayName } : null;
}

async function requirePublicList(username: string, listType: ListType) {
  const user = await getUserByUsername(username);
  if (!user) throw new AppError(404, 'PUBLIC_LIST_NOT_FOUND', 'Public list not found');
  const [setting] = await db.select({ visibility: userListSettings.visibility })
    .from(userListSettings)
    .where(and(eq(userListSettings.userId, user.id), eq(userListSettings.listType, listType)))
    .limit(1);
  if (setting?.visibility !== 'PUBLIC') {
    throw new AppError(404, 'PUBLIC_LIST_NOT_FOUND', 'Public list not found');
  }
  return user;
}

export async function getPublicProfile(username: string) {
  const user = await getUserByUsername(username);
  if (!user) throw new AppError(404, 'PUBLIC_PROFILE_NOT_FOUND', 'Public profile not found');
  const settings = await getListSettings(user.id);
  if (settings.topList !== 'PUBLIC' && settings.singingList !== 'PUBLIC') {
    throw new AppError(404, 'PUBLIC_PROFILE_NOT_FOUND', 'Public profile not found');
  }
  return { username: user.username, displayName: user.displayName, lists: settings };
}

export async function getPublicTopList(username: string) {
  const user = await requirePublicList(username, 'TOP_LIST');
  return getTopList(user.id);
}

export async function getPublicSingingList(username: string) {
  const user = await requirePublicList(username, 'SINGING_LIST');
  return db.select({ status: singingListEntries.status, ...songProjection })
    .from(singingListEntries)
    .innerJoin(songs, eq(singingListEntries.songId, songs.id))
    .where(eq(singingListEntries.userId, user.id))
    .orderBy(desc(singingListEntries.updatedAt));
}
