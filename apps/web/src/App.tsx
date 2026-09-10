import { Alert, AppBar, Box, Chip, CircularProgress, Container, CssBaseline, Snackbar, Stack, Toolbar, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ApiError, request, type Ranking, type RankingDetail, type SingingListEntry, type SingingStatus, type Song, type TopListEntry } from './api';
import { RankingPanel } from './components/RankingPanel';
import { SingingListPanel } from './components/SingingListPanel';
import { TopListPanel } from './components/TopListPanel';

const queryKeys = { rankings: ['rankings'], songs: ['songs'], ranking: (id: string, q: string, artist: string, releaseYear: number | 'ALL') => ['ranking', id, q, artist, releaseYear], topList: ['top-list'], singingList: (status: string) => ['singing-list', status] };

function getRankingPath(rankingId: string, query: string, artist: string, releaseYear: number | 'ALL') {
  const parameters = new URLSearchParams();
  if (query) parameters.set('q', query);
  if (artist !== 'ALL') parameters.set('artist', artist);
  if (releaseYear !== 'ALL') parameters.set('releaseYear', String(releaseYear));
  const queryString = parameters.toString();
  return `/api/rankings/${rankingId}${queryString ? `?${queryString}` : ''}`;
}

export default function App() {
  const client = useQueryClient();
  const [query, setQuery] = useState('');
  const [artistFilter, setArtistFilter] = useState('ALL');
  const [releaseYearFilter, setReleaseYearFilter] = useState<number | 'ALL'>('ALL');
  const [filter, setFilter] = useState<SingingStatus | 'ALL'>('ALL');
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const rankingsQuery = useQuery({ queryKey: queryKeys.rankings, queryFn: () => request<Ranking[]>('/api/rankings') });
  const songsQuery = useQuery({ queryKey: queryKeys.songs, queryFn: () => request<Song[]>('/api/songs') });
  const rankingId = rankingsQuery.data?.[0]?.id;
  const rankingQuery = useQuery({ queryKey: queryKeys.ranking(rankingId ?? 'pending', query, artistFilter, releaseYearFilter), queryFn: () => request<RankingDetail>(getRankingPath(rankingId!, query, artistFilter, releaseYearFilter)), enabled: Boolean(rankingId) });
  const topQuery = useQuery({ queryKey: queryKeys.topList, queryFn: () => request<TopListEntry[]>('/api/me/top-list') });
  const singingQuery = useQuery({ queryKey: queryKeys.singingList(filter), queryFn: () => request<SingingListEntry[]>(filter === 'ALL' ? '/api/me/singing-list' : `/api/me/singing-list?status=${filter}`) });
  const invalidatePersonalLists = () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.topList }), client.invalidateQueries({ queryKey: ['singing-list'] })]);
  const mutation = useMutation({
    mutationFn: ({ path, options }: { path: string; options?: RequestInit }) => request<unknown>(path, options),
    onSuccess: async () => { await invalidatePersonalLists(); setNotice({ severity: 'success', message: 'Saved successfully' }); },
    onError: (error) => setNotice({ severity: 'error', message: error instanceof ApiError ? error.message : 'Something went wrong. Please try again.' })
  });
  const topEntries = topQuery.data ?? [];
  const singingEntries = singingQuery.data ?? [];
  const artists = useMemo(() => Array.from(new Set((songsQuery.data ?? []).map((song) => song.artist))).sort((left, right) => left.localeCompare(right)), [songsQuery.data]);
  const releaseYears = useMemo(() => Array.from(new Set((songsQuery.data ?? []).flatMap((song) => song.releaseYear === null ? [] : [song.releaseYear]))).sort((left, right) => right - left), [songsQuery.data]);
  const topSongIds = useMemo(() => new Set(topEntries.map((entry) => entry.id)), [topEntries]);
  const singingSongIds = useMemo(() => new Set(singingEntries.map((entry) => entry.id)), [singingEntries]);
  const addTop = (songId: string) => mutation.mutate({ path: '/api/me/top-list/items', options: { method: 'POST', body: JSON.stringify({ songId }) } });
  const addSinging = (songId: string) => mutation.mutate({ path: `/api/me/singing-list/items/${songId}`, options: { method: 'PUT', body: JSON.stringify({ status: 'WANT_TO_LEARN' }) } });
  const reorderTop = (orderedSongIds: string[]) => mutation.mutate({ path: '/api/me/top-list/order', options: { method: 'PATCH', body: JSON.stringify({ orderedSongIds }) } });
  const saveSinging = (songId: string, status: SingingStatus, note: string) => mutation.mutate({ path: `/api/me/singing-list/items/${songId}`, options: { method: 'PUT', body: JSON.stringify({ status, note }) } });
  return <><CssBaseline /><AppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}><Container maxWidth="xl"><Toolbar disableGutters sx={{ minHeight: 66 }}><Stack direction="row" justifyContent="space-between" alignItems="center" width="100%"><Box><Typography variant="h1" fontSize="1.45rem">Music Rank</Typography><Typography variant="caption" color="text.secondary">Build a personal map of the songs you keep returning to.</Typography></Box><Chip label="Demo Data" color="secondary" size="small" /></Stack></Toolbar></Container></AppBar>
    <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl"><Stack spacing={2}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(360px, 0.85fr)' }, gap: 2.5, alignItems: 'start' }}><RankingPanel ranking={rankingQuery.data} isLoading={rankingsQuery.isLoading || rankingQuery.isLoading} query={query} onQueryChange={setQuery} artistFilter={artistFilter} onArtistFilterChange={setArtistFilter} releaseYearFilter={releaseYearFilter} onReleaseYearFilterChange={setReleaseYearFilter} artists={artists} releaseYears={releaseYears} topSongIds={topSongIds} singingSongIds={singingSongIds} topAtCapacity={topEntries.length >= 10} onAddTop={addTop} onAddSinging={addSinging} /><Stack spacing={2.5}><TopListPanel entries={topEntries} onReorder={reorderTop} onRemove={(songId) => mutation.mutate({ path: `/api/me/top-list/items/${songId}`, options: { method: 'DELETE' } })} /><SingingListPanel entries={singingEntries} filter={filter} onFilterChange={setFilter} onSave={saveSinging} onRemove={(songId) => mutation.mutate({ path: `/api/me/singing-list/items/${songId}`, options: { method: 'DELETE' } })} /></Stack></Box>{(topQuery.isLoading || singingQuery.isLoading) && <Stack direction="row" alignItems="center" gap={1} color="text.secondary"><CircularProgress size={16} /> Loading your lists</Stack>}</Stack></Container></Box>
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert severity={notice?.severity} onClose={() => setNotice(null)} variant="filled">{notice?.message}</Alert></Snackbar>
  </>;
}
