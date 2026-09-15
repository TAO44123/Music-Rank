import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { closeDatabase, db } from './client.js';
import { rankingEntries, rankings, songs } from './schema.js';
import { dryRunRankingImport, importRankingManifest, publishRankingReplacingDemo, replaceRankingManifest, type RankingManifest, validateRankingManifest } from './ranking-importer.js';

const slugPrefix = 'ranking-importer-test-';
const createdRankingSlugs = new Set<string>();
const createdSongIds = new Set<string>();

function manifestFor(slug: string): RankingManifest {
  createdRankingSlugs.add(slug);
  return {
    version: 1,
    ranking: {
      title: `Importer Test ${slug}`,
      slug,
      era: '1990s',
      decadeStart: 1990,
      region: 'MAINLAND',
      displayOrder: 99,
      sourceType: 'COMMUNITY',
      sourceUrl: `https://example.com/${slug}`,
      description: 'Transactional importer test fixture.'
    },
    extraction: {
      sourcePlatform: 'Test',
      sourceTitle: 'Importer test fixture',
      notes: 'Synthetic test data.'
    },
    entries: Array.from({ length: 100 }, (_, index) => ({
      rank: index + 1,
      title: `${slug} song ${index + 1}`,
      artist: `${slug} artist ${index + 1}`,
      releaseYear: null
    }))
  };
}

afterEach(async () => {
  for (const slug of createdRankingSlugs) await db.delete(rankings).where(eq(rankings.slug, slug));
  createdRankingSlugs.clear();
  await db.delete(songs).where(like(songs.title, `${slugPrefix}%`));
  for (const songId of createdSongIds) await db.delete(songs).where(eq(songs.id, songId));
  createdSongIds.clear();
});

afterAll(async () => {
  await closeDatabase();
});

describe('ranking importer', () => {
  it('rejects invalid rank continuity before any database write', async () => {
    const manifest = manifestFor(`${slugPrefix}invalid`);
    manifest.entries[99] = { ...manifest.entries[99], rank: 99 };
    await expect(dryRunRankingImport(manifest)).rejects.toThrow('contiguous');
    expect(await db.select().from(rankings).where(eq(rankings.slug, manifest.ranking.slug))).toHaveLength(0);
  });

  it('dry-runs without writes and imports idempotently as unpublished data', async () => {
    const manifest = manifestFor(`${slugPrefix}idempotent`);
    const dryRun = await dryRunRankingImport(manifest);
    expect(dryRun).toMatchObject({ dryRun: true, rankingCreated: true, songsCreated: 100, songsReused: 0, entriesCreated: 100, entriesReused: 0 });
    expect(await db.select().from(rankings).where(eq(rankings.slug, manifest.ranking.slug))).toHaveLength(0);

    const first = await importRankingManifest(manifest);
    expect(first).toMatchObject({ dryRun: false, rankingCreated: true, songsCreated: 100, songsReused: 0, entriesCreated: 100, entriesReused: 0 });
    const [ranking] = await db.select().from(rankings).where(eq(rankings.slug, manifest.ranking.slug));
    expect(ranking.isPublished).toBe(false);
    expect(await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, ranking.id))).toHaveLength(100);

    const second = await importRankingManifest(manifest);
    expect(second).toMatchObject({ dryRun: false, rankingCreated: false, songsCreated: 0, songsReused: 100, entriesCreated: 0, entriesReused: 100 });
  });

  it('accepts rankings without decade or region metadata', async () => {
    const manifest = manifestFor(`${slugPrefix}metadata-optional`);
    manifest.ranking.decadeStart = null;
    manifest.ranking.region = null;

    await importRankingManifest(manifest);
    const [ranking] = await db.select().from(rankings).where(eq(rankings.slug, manifest.ranking.slug));
    expect(ranking).toMatchObject({ decadeStart: null, region: null, isPublished: false });
  });

  it('rolls back earlier songs and entries when a later ranking entry conflicts', async () => {
    const manifest = manifestFor(`${slugPrefix}rollback`);
    const [ranking] = await db.insert(rankings).values({ id: randomUUID(), ...manifest.ranking, isPublished: false }).returning();
    const conflictSongId = randomUUID();
    createdSongIds.add(conflictSongId);
    await db.insert(songs).values({
      id: conflictSongId,
      title: 'Conflict song',
      artist: 'Conflict artist',
      normalizedTitle: 'conflict song',
      normalizedArtist: 'conflict artist',
      verificationStatus: 'VERIFIED'
    });
    await db.insert(rankingEntries).values({ id: randomUUID(), rankingId: ranking.id, songId: conflictSongId, rank: 100, verificationStatus: 'VERIFIED' });

    await expect(importRankingManifest(manifest)).rejects.toThrow('conflicts with manifest at rank 100');
    const entries = await db.select().from(rankingEntries).where(eq(rankingEntries.rankingId, ranking.id));
    expect(entries).toHaveLength(1);
    expect(entries[0].songId).toBe(conflictSongId);
    const generatedSongs = await db.select().from(songs).where(eq(songs.normalizedTitle, `${manifest.ranking.slug} song 1`));
    expect(generatedSongs).toHaveLength(0);
  });

  it('atomically replaces an existing ranking and removes only orphaned songs', async () => {
    const manifest = manifestFor(`${slugPrefix}replace`);
    const first = await importRankingManifest(manifest);
    const replacement = structuredClone(manifest);
    replacement.entries[0] = {
      ...replacement.entries[0],
      title: `${manifest.ranking.slug} replacement song 1`,
      releaseYear: 1998
    };

    const result = await replaceRankingManifest(replacement);
    expect(result).toMatchObject({
      rankingReplaced: true,
      previousRankingId: first.rankingId,
      publicationRestored: false,
      songsCreated: 1,
      songsReused: 99,
      entriesCreated: 100,
      entriesReused: 0,
      orphanedSongsDeleted: 1
    });
    expect(result.rankingId).not.toBe(first.rankingId);
    expect(await db.select().from(rankings).where(eq(rankings.slug, manifest.ranking.slug))).toHaveLength(1);
    expect(await db.select().from(songs).where(eq(songs.normalizedTitle, `${manifest.ranking.slug} song 1`))).toHaveLength(0);
    expect(await db.select().from(songs).where(eq(songs.normalizedTitle, `${manifest.ranking.slug} replacement song 1`))).toHaveLength(1);
    await expect(importRankingManifest(replacement)).resolves.toMatchObject({
      rankingCreated: false,
      songsCreated: 0,
      songsReused: 100,
      entriesCreated: 0,
      entriesReused: 100
    });
  });

  it('publishes a complete ranking and retains the Demo as unpublished data', async () => {
    const manifest = manifestFor(`${slugPrefix}publish`);
    const [demoBefore] = await db.select().from(rankings).where(eq(rankings.slug, '90s-demo-ranking'));
    expect(demoBefore).toBeDefined();

    try {
      await importRankingManifest(manifest);
      const result = await publishRankingReplacingDemo(manifest.ranking.slug);
      expect(result).toMatchObject({ rankingSlug: manifest.ranking.slug, demoRankingSlug: '90s-demo-ranking' });
      const [pilot] = await db.select().from(rankings).where(eq(rankings.slug, manifest.ranking.slug));
      const [demoDuring] = await db.select().from(rankings).where(eq(rankings.slug, '90s-demo-ranking'));
      expect(pilot.isPublished).toBe(true);
      expect(demoDuring.isPublished).toBe(false);
      await expect(publishRankingReplacingDemo(manifest.ranking.slug)).resolves.toMatchObject({ rankingSlug: manifest.ranking.slug });
    } finally {
      await db.transaction(async (transaction) => {
        await transaction.update(rankings).set({ isPublished: false }).where(eq(rankings.slug, manifest.ranking.slug));
        await transaction.update(rankings).set({ isPublished: demoBefore?.isPublished ?? true }).where(eq(rankings.slug, '90s-demo-ranking'));
      });
    }
  });

  it('rejects duplicate normalized song pairs', () => {
    const manifest = manifestFor(`${slugPrefix}duplicates`);
    manifest.entries[1] = { ...manifest.entries[1], title: manifest.entries[0].title, artist: manifest.entries[0].artist };
    expect(() => validateRankingManifest(manifest)).toThrow('duplicate normalized');
  });

  it('rejects an invalid public ranking slug', () => {
    const manifest = manifestFor(`${slugPrefix}slug`);
    manifest.ranking.slug = 'Bilibili Ranking';
    expect(() => validateRankingManifest(manifest)).toThrow('lowercase URL-safe slug');
  });
});
