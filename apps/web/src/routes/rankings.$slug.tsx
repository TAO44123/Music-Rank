import { rankingSlugSchema } from '@music-rank/contracts';
import { Alert, Box, Container, Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { ApiError } from '../api';
import { RankingCatalogNav } from '../components/RankingCatalogNav';
import { RankingPanel } from '../components/RankingPanel';
import { rankingQueryOptions, rankingsQueryOptions, singingListQueryOptions, topListQueryOptions } from '../queries';
import { useAppShell } from '../shell/AppShellContext';
import { Route as rootRoute } from './__root';
import { rankingSearchSchema, type RankingSearch } from './rankingSearch';

const rankingParamsSchema = z.object({
  slug: rankingSlugSchema
});

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rankings/$slug',
  component: RankingPage,
  parseParams: (params) => rankingParamsSchema.parse(params),
  stringifyParams: (params) => params,
  validateSearch: rankingSearchSchema
});

function RankingPage() {
  const { user, isSessionError, requireUser, openAuth, mutate, onUnauthorized } = useAppShell();
  const { slug } = Route.useParams();
  const { q, artist, year, page: requestedPage, signin } = Route.useSearch();
  const navigate = Route.useNavigate();
  const query = q ?? '';
  const artistFilter = artist ?? 'ALL';
  const releaseYearFilter = year ?? 'ALL';
  const page = requestedPage ?? 1;
  const setSearch = (patch: Partial<RankingSearch>) => void navigate({ search: (current) => ({ ...current, ...patch }), replace: true });
  const setQuery = (value: string) => setSearch({ q: value || undefined, page: undefined });
  const setArtistFilter = (value: string) => setSearch({ artist: value === 'ALL' ? undefined : value, page: undefined });
  const setReleaseYearFilter = (value: number | 'ALL') => setSearch({ year: value === 'ALL' ? undefined : value, page: undefined });
  const setPage = (value: number) => setSearch({ page: value === 1 ? undefined : value });

  useEffect(() => {
    if (!signin) return;
    openAuth('login');
    void navigate({ search: (current) => ({ ...current, signin: undefined }), replace: true });
  }, [signin, openAuth, navigate]);

  const rankingsQuery = useQuery(rankingsQueryOptions());
  const rankingQuery = useQuery(rankingQueryOptions(slug, query, artistFilter, releaseYearFilter));
  const topQuery = useQuery(topListQueryOptions(user));
  const singingQuery = useQuery(singingListQueryOptions(user, 'ALL'));

  useEffect(() => {
    const errors = [topQuery.error, singingQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.status === 401)) void onUnauthorized();
  }, [topQuery.error, singingQuery.error, onUnauthorized]);

  const entryCount = rankingQuery.data?.entries.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(entryCount / 25));
  useEffect(() => {
    if (!rankingQuery.data || page <= pageCount) return;
    setPage(pageCount);
  }, [rankingQuery.data, page, pageCount]);

  const topEntries = topQuery.data ?? [];
  const singingEntries = singingQuery.data ?? [];
  const topSongIds = useMemo(() => new Set(topEntries.map((entry) => entry.id)), [topEntries]);
  const singingSongIds = useMemo(() => new Set(singingEntries.map((entry) => entry.id)), [singingEntries]);
  const addTop = (songId: string) => requireUser(() => mutate('/api/me/top-list/items', { method: 'POST', body: JSON.stringify({ songId }) }));
  const addSinging = (songId: string) => requireUser(() => mutate(`/api/me/singing-list/items/${songId}`, { method: 'PUT', body: JSON.stringify({ status: 'WANT_TO_LEARN' }) }));
  const selectRanking = (nextSlug: string) => void navigate({
    to: '/rankings/$slug',
    params: { slug: nextSlug },
    search: (current) => ({ ...current, artist: undefined, year: undefined, page: undefined })
  });

  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl"><Stack spacing={2}>
    {isSessionError && <Alert severity="warning">Account status could not be loaded. Public rankings are still available.</Alert>}
    <RankingCatalogNav rankings={rankingsQuery.data ?? []} slug={slug} onSelect={selectRanking} />
    {rankingQuery.isError ? <Alert severity="info">
      <strong>Ranking not available.</strong> This ranking is not published or does not exist.
    </Alert> : <RankingPanel
      ranking={rankingQuery.data}
      isLoading={rankingQuery.isLoading}
      query={query}
      onQueryChange={setQuery}
      artistFilter={artistFilter}
      onArtistFilterChange={setArtistFilter}
      releaseYearFilter={releaseYearFilter}
      onReleaseYearFilterChange={setReleaseYearFilter}
      artists={rankingQuery.data?.facets.artists ?? []}
      releaseYears={rankingQuery.data?.facets.releaseYears ?? []}
      page={Math.min(page, pageCount)}
      onPageChange={setPage}
      topSongIds={topSongIds}
      singingSongIds={singingSongIds}
      topAtCapacity={topEntries.length >= 10}
      onAddTop={addTop}
      onAddSinging={addSinging}
    />}
  </Stack></Container></Box>;
}
