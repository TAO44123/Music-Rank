import { Alert, Box, Container, Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import { ApiError } from '../api';
import { RankingPanel } from '../components/RankingPanel';
import { rankingQueryOptions, rankingsQueryOptions, singingListQueryOptions, songsQueryOptions, topListQueryOptions } from '../queries';
import { useAppShell } from '../shell/AppShellContext';
import { Route as rootRoute } from './__root';

const rankingSearchSchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  artist: z.string().trim().min(1).optional().catch(undefined),
  year: z.coerce.number().int().min(1900).max(2100).optional().catch(undefined),
  signin: z.boolean().optional().catch(undefined)
});

export type RankingSearch = z.infer<typeof rankingSearchSchema>;

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): RankingSearch => rankingSearchSchema.parse(search)
});

function HomePage() {
  const { user, isSessionError, requireUser, openAuth, mutate, onUnauthorized } = useAppShell();
  const { q, artist, year, signin } = Route.useSearch();
  const navigate = Route.useNavigate();
  const query = q ?? '';
  const artistFilter = artist ?? 'ALL';
  const releaseYearFilter = year ?? 'ALL';
  const setSearch = (patch: Partial<RankingSearch>) => void navigate({ search: (current) => ({ ...current, ...patch }), replace: true });
  const setQuery = (value: string) => setSearch({ q: value || undefined });
  const setArtistFilter = (value: string) => setSearch({ artist: value === 'ALL' ? undefined : value });
  const setReleaseYearFilter = (value: number | 'ALL') => setSearch({ year: value === 'ALL' ? undefined : value });

  useEffect(() => {
    if (!signin) return;
    openAuth('login');
    void navigate({ search: (current) => ({ ...current, signin: undefined }), replace: true });
  }, [signin, openAuth, navigate]);

  const rankingsQuery = useQuery(rankingsQueryOptions());
  const songsQuery = useQuery(songsQueryOptions());
  const rankingId = rankingsQuery.data?.[0]?.id;
  const rankingQuery = useQuery(rankingQueryOptions(rankingId, query, artistFilter, releaseYearFilter));
  const topQuery = useQuery(topListQueryOptions(user));
  const singingQuery = useQuery(singingListQueryOptions(user, 'ALL'));

  useEffect(() => {
    const errors = [topQuery.error, singingQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.status === 401)) void onUnauthorized();
  }, [topQuery.error, singingQuery.error, onUnauthorized]);

  const topEntries = topQuery.data ?? [];
  const singingEntries = singingQuery.data ?? [];
  const artists = useMemo(() => Array.from(new Set((songsQuery.data ?? []).map((song) => song.artist))).sort((left, right) => left.localeCompare(right)), [songsQuery.data]);
  const releaseYears = useMemo(() => Array.from(new Set((songsQuery.data ?? []).flatMap((song) => song.releaseYear === null ? [] : [song.releaseYear]))).sort((left, right) => right - left), [songsQuery.data]);
  const topSongIds = useMemo(() => new Set(topEntries.map((entry) => entry.id)), [topEntries]);
  const singingSongIds = useMemo(() => new Set(singingEntries.map((entry) => entry.id)), [singingEntries]);
  const addTop = (songId: string) => requireUser(() => mutate('/api/me/top-list/items', { method: 'POST', body: JSON.stringify({ songId }) }));
  const addSinging = (songId: string) => requireUser(() => mutate(`/api/me/singing-list/items/${songId}`, { method: 'PUT', body: JSON.stringify({ status: 'WANT_TO_LEARN' }) }));

  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl"><Stack spacing={2}>
    {isSessionError && <Alert severity="warning">Account status could not be loaded. Public rankings are still available.</Alert>}
    <RankingPanel ranking={rankingQuery.data} isLoading={rankingsQuery.isLoading || rankingQuery.isLoading} query={query} onQueryChange={setQuery} artistFilter={artistFilter} onArtistFilterChange={setArtistFilter} releaseYearFilter={releaseYearFilter} onReleaseYearFilterChange={setReleaseYearFilter} artists={artists} releaseYears={releaseYears} topSongIds={topSongIds} singingSongIds={singingSongIds} topAtCapacity={topEntries.length >= 10} onAddTop={addTop} onAddSinging={addSinging} />
  </Stack></Container></Box>;
}
