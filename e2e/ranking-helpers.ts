import type { Page } from '@playwright/test';

type RankingCatalogItem = {
  slug: string;
};

type RankingDetail = {
  entries: unknown[];
};

export async function findPublishedRankingPathContaining(page: Page, query: string): Promise<string> {
  const catalogResponse = await page.request.get('/api/rankings');
  if (!catalogResponse.ok()) throw new Error(`Ranking catalog request failed with ${catalogResponse.status()}`);

  const catalog = await catalogResponse.json() as RankingCatalogItem[];
  for (const ranking of catalog) {
    const detailResponse = await page.request.get(`/api/rankings/${ranking.slug}`, { params: { q: query } });
    if (!detailResponse.ok()) throw new Error(`Ranking ${ranking.slug} request failed with ${detailResponse.status()}`);
    const detail = await detailResponse.json() as RankingDetail;
    if (detail.entries.length > 0) return `/rankings/${ranking.slug}`;
  }

  throw new Error(`No published ranking contains ${JSON.stringify(query)}`);
}
