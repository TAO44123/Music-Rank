import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from './client.js';
import { rankingEntries, rankings, singingListEntries, songs, userTopListEntries } from './schema.js';

const regions = ['HK_TW', 'MAINLAND'] as const;
const sourceTypes = ['OFFICIAL', 'MEDIA', 'COMMUNITY'] as const;

export type RankingManifestEntry = {
  rank: number;
  title: string;
  artist: string;
  releaseYear: number | null;
  sourceTimestampSeconds?: number;
};

export type RankingManifest = {
  version: 1;
  ranking: {
    title: string;
    slug: string;
    era: string;
    decadeStart: 1980 | 1990 | null;
    region: typeof regions[number] | null;
    displayOrder: number;
    sourceType: typeof sourceTypes[number];
    sourceUrl: string;
    description: string;
  };
  extraction: {
    sourcePlatform: string;
    sourceTitle: string;
    notes: string;
    canonicalizations?: Array<{
      rank: number;
      sourceTitle: string;
      sourceArtist: string;
      title: string;
      artist: string;
      reason: string;
    }>;
  };
  entries: RankingManifestEntry[];
};

export type RankingImportSummary = {
  rankingId: string | null;
  rankingSlug: string;
  dryRun: boolean;
  rankingCreated: boolean;
  songsCreated: number;
  songsReused: number;
  entriesCreated: number;
  entriesReused: number;
};

export type RankingPublishSummary = {
  rankingId: string;
  rankingSlug: string;
  demoRankingId: string;
  demoRankingSlug: string;
};

export type RankingReplacementSummary = RankingImportSummary & {
  rankingReplaced: true;
  previousRankingId: string;
  orphanedSongsDeleted: number;
  publicationRestored: boolean;
};

export class RankingManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RankingManifestValidationError';
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RankingManifestValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, name: string): string {
  assert(typeof value === 'string' && value.trim().length > 0, `${name} must be a non-empty string`);
  return value.trim();
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function parseRankingSlug(value: unknown, name: string): string {
  const slug = nonEmptyString(value, name);
  assert(slug.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), `${name} must be a lowercase URL-safe slug`);
  return slug;
}

function parseEntry(value: unknown, index: number): RankingManifestEntry {
  assert(isRecord(value), `entries[${index}] must be an object`);
  const rank = value.rank;
  assert(typeof rank === 'number' && Number.isInteger(rank) && rank > 0, `entries[${index}].rank must be a positive integer`);
  const releaseYear = value.releaseYear;
  assert(releaseYear === null || (typeof releaseYear === 'number' && Number.isInteger(releaseYear) && releaseYear >= 1800 && releaseYear <= 2100), `entries[${index}].releaseYear must be null or a year from 1800 through 2100`);
  const sourceTimestampSeconds = value.sourceTimestampSeconds;
  assert(sourceTimestampSeconds === undefined || (typeof sourceTimestampSeconds === 'number' && Number.isInteger(sourceTimestampSeconds) && sourceTimestampSeconds >= 0), `entries[${index}].sourceTimestampSeconds must be a non-negative integer when present`);
  return {
    rank,
    title: nonEmptyString(value.title, `entries[${index}].title`),
    artist: nonEmptyString(value.artist, `entries[${index}].artist`),
    releaseYear,
    ...(sourceTimestampSeconds === undefined ? {} : { sourceTimestampSeconds })
  };
}

export function validateRankingManifest(value: unknown): RankingManifest {
  assert(isRecord(value), 'manifest must be an object');
  assert(value.version === 1, 'manifest.version must be 1');
  assert(isRecord(value.ranking), 'manifest.ranking must be an object');
  assert(isRecord(value.extraction), 'manifest.extraction must be an object');
  assert(Array.isArray(value.entries), 'manifest.entries must be an array');

  const rankingValue = value.ranking;
  const decadeStart = rankingValue.decadeStart ?? null;
  assert(decadeStart === null || decadeStart === 1980 || decadeStart === 1990, 'ranking.decadeStart must be null, 1980, or 1990');
  const region = rankingValue.region ?? null;
  assert(region === null || typeof region === 'string' && regions.includes(region as typeof regions[number]), 'ranking.region is unsupported');
  const sourceType = rankingValue.sourceType;
  assert(typeof sourceType === 'string' && sourceTypes.includes(sourceType as typeof sourceTypes[number]), 'ranking.sourceType is unsupported');
  const displayOrder = rankingValue.displayOrder;
  assert(typeof displayOrder === 'number' && Number.isInteger(displayOrder) && displayOrder > 0, 'ranking.displayOrder must be a positive integer');
  const sourceUrl = nonEmptyString(rankingValue.sourceUrl, 'ranking.sourceUrl');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new RankingManifestValidationError('ranking.sourceUrl must be an absolute HTTP(S) URL');
  }
  assert(parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:', 'ranking.sourceUrl must use HTTP(S)');

  const entries = value.entries.map(parseEntry);
  assert(entries.length > 0, 'manifest must contain at least one entry');
  const sortedRanks = entries.map((entry) => entry.rank).sort((left, right) => left - right);
  assert(sortedRanks.every((rank, index) => rank === index + 1), `manifest ranks must be unique and contiguous from 1 through ${entries.length}`);
  const songKeys = entries.map((entry) => `${normalize(entry.title)}\u0000${normalize(entry.artist)}`);
  assert(new Set(songKeys).size === songKeys.length, 'manifest must not contain duplicate normalized title-and-artist pairs');

  const canonicalizations = value.extraction.canonicalizations;
  assert(canonicalizations === undefined || Array.isArray(canonicalizations), 'extraction.canonicalizations must be an array when present');
  const parsedCanonicalizations = canonicalizations?.map((item, index) => {
    assert(isRecord(item), `extraction.canonicalizations[${index}] must be an object`);
    const rank = item.rank;
    assert(typeof rank === 'number' && Number.isInteger(rank) && rank >= 1 && rank <= 100, `extraction.canonicalizations[${index}].rank is invalid`);
    return {
      rank,
      sourceTitle: nonEmptyString(item.sourceTitle, `extraction.canonicalizations[${index}].sourceTitle`),
      sourceArtist: nonEmptyString(item.sourceArtist, `extraction.canonicalizations[${index}].sourceArtist`),
      title: nonEmptyString(item.title, `extraction.canonicalizations[${index}].title`),
      artist: nonEmptyString(item.artist, `extraction.canonicalizations[${index}].artist`),
      reason: nonEmptyString(item.reason, `extraction.canonicalizations[${index}].reason`)
    };
  });

  return {
    version: 1,
    ranking: {
      title: nonEmptyString(rankingValue.title, 'ranking.title'),
      slug: parseRankingSlug(rankingValue.slug, 'ranking.slug'),
      era: nonEmptyString(rankingValue.era, 'ranking.era'),
      decadeStart,
      region: region as typeof regions[number] | null,
      displayOrder,
      sourceType: sourceType as typeof sourceTypes[number],
      sourceUrl,
      description: nonEmptyString(rankingValue.description, 'ranking.description')
    },
    extraction: {
      sourcePlatform: nonEmptyString(value.extraction.sourcePlatform, 'extraction.sourcePlatform'),
      sourceTitle: nonEmptyString(value.extraction.sourceTitle, 'extraction.sourceTitle'),
      notes: nonEmptyString(value.extraction.notes, 'extraction.notes'),
      ...(parsedCanonicalizations === undefined ? {} : { canonicalizations: parsedCanonicalizations })
    },
    entries
  };
}

function assertRankingMetadata(manifest: RankingManifest, ranking: typeof rankings.$inferSelect): void {
  const expected = manifest.ranking;
  const actual = {
    title: ranking.title,
    slug: ranking.slug,
    era: ranking.era,
    decadeStart: ranking.decadeStart,
    region: ranking.region,
    displayOrder: ranking.displayOrder,
    sourceType: ranking.sourceType,
    sourceUrl: ranking.sourceUrl,
    description: ranking.description
  };
  const wanted = {
    title: expected.title,
    slug: expected.slug,
    era: expected.era,
    decadeStart: expected.decadeStart,
    region: expected.region,
    displayOrder: expected.displayOrder,
    sourceType: expected.sourceType,
    sourceUrl: expected.sourceUrl,
    description: expected.description
  };
  assert(JSON.stringify(actual) === JSON.stringify(wanted), `existing ranking metadata does not match manifest for ${expected.slug}`);
}

async function getDryRunSummary(manifest: RankingManifest): Promise<RankingImportSummary> {
  const [existingRanking] = await db.select().from(rankings).where(eq(rankings.slug, manifest.ranking.slug)).limit(1);
  if (existingRanking) assertRankingMetadata(manifest, existingRanking);
  const existingEntries = existingRanking
    ? await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, existingRanking.id))
    : [];
  const entriesByRank = new Map(existingEntries.map((entry) => [entry.rank, entry]));
  const entriesBySong = new Map(existingEntries.map((entry) => [entry.songId, entry]));
  let songsCreated = 0;
  let songsReused = 0;
  let entriesCreated = 0;
  let entriesReused = 0;

  for (const entry of manifest.entries) {
    const [song] = await db.select().from(songs).where(and(
      eq(songs.normalizedTitle, normalize(entry.title)),
      eq(songs.normalizedArtist, normalize(entry.artist))
    )).limit(1);
    if (song) songsReused += 1;
    else songsCreated += 1;
    const existingEntry = entriesByRank.get(entry.rank);
    if (!existingEntry) {
      entriesCreated += 1;
      continue;
    }
    assert(song && existingEntry.songId === song.id, `existing entry at rank ${entry.rank} does not match manifest song`);
    assert(entriesBySong.get(song.id)?.rank === entry.rank, `existing song is assigned to a different rank than ${entry.rank}`);
    entriesReused += 1;
  }
  assert(existingEntries.length === entriesReused, `existing ranking ${manifest.ranking.slug} contains entries not present in its manifest`);
  return { rankingId: existingRanking?.id ?? null, rankingSlug: manifest.ranking.slug, dryRun: true, rankingCreated: !existingRanking, songsCreated, songsReused, entriesCreated, entriesReused };
}

export async function dryRunRankingImport(value: unknown): Promise<RankingImportSummary> {
  return getDryRunSummary(validateRankingManifest(value));
}

async function writeRankingManifest(manifest: RankingManifest, replaceExisting: boolean) {
  return db.transaction(async (transaction) => {
    const [existingRanking] = await transaction.select().from(rankings).where(eq(rankings.slug, manifest.ranking.slug)).limit(1);
    let foundRanking: typeof rankings.$inferSelect | undefined = existingRanking;
    let previousRankingId: string | null = null;
    let publicationRestored = false;
    let previousSongIds: string[] = [];

    if (replaceExisting) {
      assert(foundRanking, `ranking ${manifest.ranking.slug} does not exist and cannot be replaced`);
      previousRankingId = foundRanking.id;
      publicationRestored = foundRanking.isPublished;
      previousSongIds = (await transaction.select({ songId: rankingEntries.songId }).from(rankingEntries)
        .where(eq(rankingEntries.rankingId, foundRanking.id))).map((entry) => entry.songId);
      await transaction.delete(rankings).where(eq(rankings.id, foundRanking.id));
      foundRanking = undefined;
    }

    let ranking = foundRanking;
    let rankingCreated = false;
    if (!ranking) {
      const [createdRanking] = await transaction.insert(rankings).values({
        id: randomUUID(),
        ...manifest.ranking,
        isPublished: false,
        verifiedAt: new Date()
      }).returning();
      ranking = createdRanking;
      rankingCreated = true;
    } else {
      assertRankingMetadata(manifest, ranking);
    }

    const existingEntries = await transaction.select().from(rankingEntries).where(eq(rankingEntries.rankingId, ranking.id));
    const entriesByRank = new Map(existingEntries.map((entry) => [entry.rank, entry]));
    const entriesBySong = new Map(existingEntries.map((entry) => [entry.songId, entry]));
    let songsCreated = 0;
    let songsReused = 0;
    let entriesCreated = 0;
    let entriesReused = 0;

    for (const entry of manifest.entries) {
      const normalizedTitle = normalize(entry.title);
      const normalizedArtist = normalize(entry.artist);
      let [song] = await transaction.select().from(songs).where(and(
        eq(songs.normalizedTitle, normalizedTitle),
        eq(songs.normalizedArtist, normalizedArtist)
      )).limit(1);

      if (!song) {
        [song] = await transaction.insert(songs).values({
          id: randomUUID(),
          title: entry.title,
          artist: entry.artist,
          releaseYear: entry.releaseYear,
          verificationStatus: 'VERIFIED',
          normalizedTitle,
          normalizedArtist
        }).returning();
        songsCreated += 1;
      } else {
        assert(replaceExisting || entry.releaseYear === null || song.releaseYear === null || song.releaseYear === entry.releaseYear, `release year conflict for ${entry.title} — ${entry.artist}`);
        await transaction.update(songs).set({
          title: replaceExisting ? entry.title : song.title,
          artist: replaceExisting ? entry.artist : song.artist,
          releaseYear: replaceExisting ? entry.releaseYear : song.releaseYear ?? entry.releaseYear,
          verificationStatus: 'VERIFIED',
          updatedAt: new Date()
        }).where(eq(songs.id, song.id));
        songsReused += 1;
      }

      const existingAtRank = entriesByRank.get(entry.rank);
      const existingForSong = entriesBySong.get(song.id);
      if (existingAtRank || existingForSong) {
        assert(existingAtRank?.songId === song.id && existingForSong?.rank === entry.rank, `existing ranking entry conflicts with manifest at rank ${entry.rank}`);
        entriesReused += 1;
        continue;
      }

      const [createdEntry] = await transaction.insert(rankingEntries).values({
        id: randomUUID(),
        rankingId: ranking.id,
        songId: song.id,
        rank: entry.rank,
        sourceTimestampSeconds: entry.sourceTimestampSeconds,
        verificationStatus: 'VERIFIED'
      }).returning();
      entriesByRank.set(createdEntry.rank, createdEntry);
      entriesBySong.set(createdEntry.songId, createdEntry);
      entriesCreated += 1;
    }

    const finalEntries = await transaction.select({ rank: rankingEntries.rank }).from(rankingEntries)
      .where(eq(rankingEntries.rankingId, ranking.id));
    assert(finalEntries.length === manifest.entries.length, `imported ranking ${manifest.ranking.slug} must contain ${manifest.entries.length} entries`);
    assert(finalEntries.map((entry) => entry.rank).sort((left, right) => left - right).every((rank, index) => rank === index + 1), `imported ranking ${manifest.ranking.slug} ranks must remain contiguous from 1 through ${manifest.entries.length}`);

    let orphanedSongsDeleted = 0;
    for (const songId of previousSongIds) {
      const [rankingReference] = await transaction.select({ id: rankingEntries.id }).from(rankingEntries).where(eq(rankingEntries.songId, songId)).limit(1);
      const [topListReference] = await transaction.select({ id: userTopListEntries.id }).from(userTopListEntries).where(eq(userTopListEntries.songId, songId)).limit(1);
      const [singingListReference] = await transaction.select({ id: singingListEntries.id }).from(singingListEntries).where(eq(singingListEntries.songId, songId)).limit(1);
      if (!rankingReference && !topListReference && !singingListReference) {
        await transaction.delete(songs).where(eq(songs.id, songId));
        orphanedSongsDeleted += 1;
      }
    }

    if (publicationRestored) {
      await transaction.update(rankings).set({ isPublished: true, updatedAt: new Date() }).where(eq(rankings.id, ranking.id));
    }

    return {
      rankingId: ranking.id,
      rankingSlug: manifest.ranking.slug,
      dryRun: false,
      rankingCreated,
      songsCreated,
      songsReused,
      entriesCreated,
      entriesReused,
      ...(previousRankingId === null ? {} : {
        rankingReplaced: true as const,
        previousRankingId,
        orphanedSongsDeleted,
        publicationRestored
      })
    };
  });
}

export async function importRankingManifest(value: unknown): Promise<RankingImportSummary> {
  return writeRankingManifest(validateRankingManifest(value), false);
}

export async function replaceRankingManifest(value: unknown): Promise<RankingReplacementSummary> {
  return writeRankingManifest(validateRankingManifest(value), true) as Promise<RankingReplacementSummary>;
}

/**
 * Publishes a complete ranking while retaining the seeded Demo and all of its
 * entries. Publication and Demo unpublication occur in one transaction.
 */
export async function publishRankingReplacingDemo(rankingSlug: string): Promise<RankingPublishSummary> {
  const slug = parseRankingSlug(rankingSlug, 'rankingSlug');
  return db.transaction(async (transaction) => {
    const [targetRanking] = await transaction.select().from(rankings).where(eq(rankings.slug, slug)).limit(1);
    assert(targetRanking, `ranking ${slug} does not exist`);
    const targetEntries = await transaction.select({ rank: rankingEntries.rank }).from(rankingEntries)
      .where(eq(rankingEntries.rankingId, targetRanking.id));
    assert(targetEntries.length > 0, `ranking ${slug} must contain at least one entry before publishing`);
    assert(targetEntries.map((entry) => entry.rank).sort((left, right) => left - right).every((rank, index) => rank === index + 1), `ranking ${slug} ranks must be contiguous before publishing`);

    const [demo] = await transaction.select().from(rankings).where(eq(rankings.slug, '90s-demo-ranking')).limit(1);
    assert(demo, '90s Demo ranking is required before publishing a ranking');
    assert(demo.sourceType === 'DEMO', '90s Demo ranking metadata is invalid');

    if (targetRanking.isPublished) {
      assert(!demo.isPublished, 'Demo must be unpublished when a ranking is already published');
    } else {
      await transaction.update(rankings).set({ isPublished: false, updatedAt: new Date() }).where(eq(rankings.id, demo.id));
      await transaction.update(rankings).set({ isPublished: true, verifiedAt: new Date(), updatedAt: new Date() }).where(eq(rankings.id, targetRanking.id));
    }

    return {
      rankingId: targetRanking.id,
      rankingSlug: targetRanking.slug,
      demoRankingId: demo.id,
      demoRankingSlug: demo.slug
    };
  });
}
