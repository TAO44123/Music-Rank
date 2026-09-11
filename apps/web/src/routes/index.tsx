import LockOutlineIcon from '@mui/icons-material/LockOutline';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { ApiError, type SingingStatus } from '../api';
import { RankingPanel } from '../components/RankingPanel';
import { SingingListPanel } from '../components/SingingListPanel';
import { TopListPanel } from '../components/TopListPanel';
import { VisibilityControl, VisibilityStatus } from '../components/VisibilityControl';
import { listSettingsQueryOptions, rankingQueryOptions, rankingsQueryOptions, singingListQueryOptions, songsQueryOptions, topListQueryOptions } from '../queries';
import { useAppShell } from '../shell/AppShellContext';
import { Route as rootRoute } from './__root';

const rankingSearchSchema = z.object({
  signin: z.boolean().optional().catch(undefined)
});

export type RankingSearch = z.infer<typeof rankingSearchSchema>;

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): RankingSearch => rankingSearchSchema.parse(search)
});

function SignedOutPanel({ onSignIn, onRegister }: { onSignIn: () => void; onRegister: () => void }) {
  return <Paper component="aside" sx={{ p: 3, textAlign: 'center' }}>
    <LockOutlineIcon color="secondary" sx={{ fontSize: 38 }} />
    <Typography variant="h2" fontSize="1.45rem" mt={1}>Your lists are private to you</Typography>
    <Typography color="text.secondary" my={1.5}>Sign in to build a Top 10, track songs you sing, and choose which lists to share.</Typography>
    <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} spacing={1} justifyContent="center"><Button variant="contained" onClick={onSignIn}>Sign in</Button><Button variant="outlined" onClick={onRegister}>Create account</Button></Stack>
  </Paper>;
}

function AccountLoadingPanel() {
  return <Paper component="aside" sx={{ p: 4 }}><Stack direction="row" alignItems="center" justifyContent="center" gap={1.25} color="text.secondary"><CircularProgress size={20} /> Loading your account</Stack></Paper>;
}

function HomePage() {
  const { user, isSessionLoading, isSessionError, requireUser, openAuth, notify, mutate, setVisibility, isVisibilityPending, onUnauthorized } = useAppShell();
  const [query, setQuery] = useState('');
  const [artistFilter, setArtistFilter] = useState('ALL');
  const [releaseYearFilter, setReleaseYearFilter] = useState<number | 'ALL'>('ALL');
  const [filter, setFilter] = useState<SingingStatus | 'ALL'>('ALL');
  const { signin } = Route.useSearch();
  const navigate = Route.useNavigate();

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
  const singingQuery = useQuery(singingListQueryOptions(user, filter));
  const settingsQuery = useQuery(listSettingsQueryOptions(user));

  useEffect(() => {
    const errors = [topQuery.error, singingQuery.error, settingsQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.status === 401)) void onUnauthorized();
  }, [topQuery.error, singingQuery.error, settingsQuery.error, onUnauthorized]);

  const topEntries = topQuery.data ?? [];
  const singingEntries = singingQuery.data ?? [];
  const settings = settingsQuery.data ?? { topList: 'PRIVATE' as const, singingList: 'PRIVATE' as const };
  const artists = useMemo(() => Array.from(new Set((songsQuery.data ?? []).map((song) => song.artist))).sort((left, right) => left.localeCompare(right)), [songsQuery.data]);
  const releaseYears = useMemo(() => Array.from(new Set((songsQuery.data ?? []).flatMap((song) => song.releaseYear === null ? [] : [song.releaseYear]))).sort((left, right) => right - left), [songsQuery.data]);
  const topSongIds = useMemo(() => new Set(topEntries.map((entry) => entry.id)), [topEntries]);
  const singingSongIds = useMemo(() => new Set(singingEntries.map((entry) => entry.id)), [singingEntries]);
  const addTop = (songId: string) => requireUser(() => mutate('/api/me/top-list/items', { method: 'POST', body: JSON.stringify({ songId }) }));
  const addSinging = (songId: string) => requireUser(() => mutate(`/api/me/singing-list/items/${songId}`, { method: 'PUT', body: JSON.stringify({ status: 'WANT_TO_LEARN' }) }));
  const reorderTop = (orderedSongIds: string[]) => mutate('/api/me/top-list/order', { method: 'PATCH', body: JSON.stringify({ orderedSongIds }) });
  const saveSinging = (songId: string, status: SingingStatus, note: string) => mutate(`/api/me/singing-list/items/${songId}`, { method: 'PUT', body: JSON.stringify({ status, note }) });
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';
  const shareNotice = (method: 'shared' | 'copied') => notify('success', method === 'shared' ? 'Public profile shared' : 'Public profile link copied');

  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl"><Stack spacing={2}>
    {isSessionError && <Alert severity="warning">Account status could not be loaded. Public rankings are still available.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(360px, 0.85fr)' }, gap: 2.5, alignItems: 'start' }}>
      <Box sx={{ order: { xs: 2, lg: 1 } }}><RankingPanel ranking={rankingQuery.data} isLoading={rankingsQuery.isLoading || rankingQuery.isLoading} query={query} onQueryChange={setQuery} artistFilter={artistFilter} onArtistFilterChange={setArtistFilter} releaseYearFilter={releaseYearFilter} onReleaseYearFilterChange={setReleaseYearFilter} artists={artists} releaseYears={releaseYears} topSongIds={topSongIds} singingSongIds={singingSongIds} topAtCapacity={topEntries.length >= 10} onAddTop={addTop} onAddSinging={addSinging} /></Box>
      <Box sx={{ order: { xs: 1, lg: 2 } }}>{isSessionLoading ? <AccountLoadingPanel /> : user ? <Stack spacing={2.5}>
        <TopListPanel entries={topEntries} onReorder={reorderTop} onRemove={(songId) => mutate(`/api/me/top-list/items/${songId}`, { method: 'DELETE' })} statusLabel={<VisibilityStatus label="Top 10" visibility={settings.topList} />} headerAction={<VisibilityControl label="Top 10" visibility={settings.topList} publicUrl={publicUrl} disabled={isVisibilityPending} onChange={(visibility) => setVisibility('top-list', visibility)} onShareComplete={shareNotice} />} />
        <SingingListPanel entries={singingEntries} filter={filter} onFilterChange={setFilter} onSave={saveSinging} onRemove={(songId) => mutate(`/api/me/singing-list/items/${songId}`, { method: 'DELETE' })} statusLabel={<VisibilityStatus label="Singing List" visibility={settings.singingList} />} headerAction={<VisibilityControl label="Singing List" visibility={settings.singingList} publicUrl={publicUrl} privateNotes disabled={isVisibilityPending} onChange={(visibility) => setVisibility('singing-list', visibility)} onShareComplete={shareNotice} />} />
        {(topQuery.isLoading || singingQuery.isLoading || settingsQuery.isLoading) && <Stack direction="row" alignItems="center" gap={1} color="text.secondary"><CircularProgress size={16} /> Loading your lists</Stack>}
      </Stack> : <SignedOutPanel onSignIn={() => openAuth('login')} onRegister={() => openAuth('register')} />}</Box>
    </Box>
  </Stack></Container></Box>;
}
