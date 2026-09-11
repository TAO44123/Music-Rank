import LockOutlineIcon from '@mui/icons-material/LockOutline';
import { Alert, Box, Button, Chip, CircularProgress, Container, CssBaseline, List, ListItem, ListItemText, Paper, Snackbar, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, request, type AuthSession, type AuthUser, type ListSettings, type ListVisibility, type PublicProfile, type PublicSingingListEntry, type Ranking, type RankingDetail, type SingingListEntry, type SingingStatus, type Song, type TopListEntry } from './api';
import { AccountActions } from './components/AccountActions';
import { AuthDialog, type AuthMode } from './components/AuthDialog';
import { Brand } from './components/Brand';
import { RankingPanel } from './components/RankingPanel';
import { SingingListPanel } from './components/SingingListPanel';
import { TopListPanel } from './components/TopListPanel';
import { VisibilityControl, VisibilityStatus } from './components/VisibilityControl';
import { statusLabels } from './status';

const queryKeys = {
  session: ['auth-session'] as const,
  rankings: ['rankings'] as const,
  songs: ['songs'] as const,
  ranking: (id: string, q: string, artist: string, releaseYear: number | 'ALL') => ['ranking', id, q, artist, releaseYear] as const,
  personal: ['personal'] as const,
  signedOut: (resource: string, detail?: string) => ['signed-out', resource, detail ?? 'all'] as const,
  topList: (userId: string) => ['personal', userId, 'top-list'] as const,
  singingList: (userId: string, status: string) => ['personal', userId, 'singing-list', status] as const,
  listSettings: (userId: string) => ['personal', userId, 'list-settings'] as const,
  publicProfile: (username: string) => ['public-profile', username] as const,
  publicTopList: (username: string) => ['public-profile', username, 'top-list'] as const,
  publicSingingList: (username: string) => ['public-profile', username, 'singing-list'] as const
};

function getRankingPath(rankingId: string, query: string, artist: string, releaseYear: number | 'ALL') {
  const parameters = new URLSearchParams();
  if (query) parameters.set('q', query);
  if (artist !== 'ALL') parameters.set('artist', artist);
  if (releaseYear !== 'ALL') parameters.set('releaseYear', String(releaseYear));
  const queryString = parameters.toString();
  return `/api/rankings/${rankingId}${queryString ? `?${queryString}` : ''}`;
}

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
  const client = useQueryClient();
  const [query, setQuery] = useState('');
  const [artistFilter, setArtistFilter] = useState('ALL');
  const [releaseYearFilter, setReleaseYearFilter] = useState<number | 'ALL'>('ALL');
  const [filter, setFilter] = useState<SingingStatus | 'ALL'>('ALL');
  const [authDialog, setAuthDialog] = useState<{ open: boolean; mode: AuthMode }>({ open: false, mode: 'login' });
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const sessionQuery = useQuery({ queryKey: queryKeys.session, queryFn: () => request<AuthSession>('/api/auth/session'), retry: false });
  const user = sessionQuery.data?.user ?? null;
  const rankingsQuery = useQuery({ queryKey: queryKeys.rankings, queryFn: () => request<Ranking[]>('/api/rankings') });
  const songsQuery = useQuery({ queryKey: queryKeys.songs, queryFn: () => request<Song[]>('/api/songs') });
  const rankingId = rankingsQuery.data?.[0]?.id;
  const rankingQuery = useQuery({ queryKey: queryKeys.ranking(rankingId ?? 'pending', query, artistFilter, releaseYearFilter), queryFn: () => request<RankingDetail>(getRankingPath(rankingId!, query, artistFilter, releaseYearFilter)), enabled: Boolean(rankingId) });
  const topQuery = useQuery({ queryKey: user ? queryKeys.topList(user.id) : queryKeys.signedOut('top-list'), queryFn: () => request<TopListEntry[]>('/api/me/top-list'), enabled: Boolean(user), retry: false });
  const singingQuery = useQuery({ queryKey: user ? queryKeys.singingList(user.id, filter) : queryKeys.signedOut('singing-list', filter), queryFn: () => request<SingingListEntry[]>(filter === 'ALL' ? '/api/me/singing-list' : `/api/me/singing-list?status=${filter}`), enabled: Boolean(user), retry: false });
  const settingsQuery = useQuery({ queryKey: user ? queryKeys.listSettings(user.id) : queryKeys.signedOut('list-settings'), queryFn: () => request<ListSettings>('/api/me/list-settings'), enabled: Boolean(user), retry: false });

  const clearPersonalData = async () => {
    await client.cancelQueries({ queryKey: queryKeys.personal });
    client.removeQueries({ queryKey: queryKeys.personal });
  };
  const loseAuthentication = async () => {
    await client.cancelQueries({ queryKey: queryKeys.personal });
    client.setQueriesData({ queryKey: queryKeys.personal }, undefined);
    client.setQueryData<AuthSession>(queryKeys.session, { user: null });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    client.removeQueries({ queryKey: queryKeys.personal });
  };

  useEffect(() => {
    const errors = [topQuery.error, singingQuery.error, settingsQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.status === 401)) void loseAuthentication();
  }, [topQuery.error, singingQuery.error, settingsQuery.error]);

  const authMutation = useMutation({
    mutationFn: ({ mode, ...input }: { mode: AuthMode; username: string; displayName?: string; password: string }) => request<{ user: AuthUser }>(mode === 'register' ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async ({ user: authenticatedUser }) => {
      await clearPersonalData();
      client.setQueryData<AuthSession>(queryKeys.session, { user: authenticatedUser });
      setAuthDialog((current) => ({ ...current, open: false }));
      setNotice({ severity: 'success', message: `Welcome, ${authenticatedUser.displayName}` });
    }
  });
  const openAuth = (mode: AuthMode) => {
    authMutation.reset();
    setAuthDialog({ open: true, mode });
  };
  const logoutMutation = useMutation({
    mutationFn: () => request<void>('/api/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      await loseAuthentication();
      setNotice({ severity: 'success', message: 'Signed out' });
    },
    onError: (error) => setNotice({ severity: 'error', message: error instanceof ApiError ? error.message : 'Could not sign out. Please try again.' })
  });

  const invalidatePersonalLists = () => Promise.all([
    client.invalidateQueries({ queryKey: user ? queryKeys.topList(user.id) : queryKeys.personal }),
    client.invalidateQueries({ queryKey: user ? ['personal', user.id, 'singing-list'] : queryKeys.personal })
  ]);
  const mutation = useMutation({
    mutationFn: ({ path, options }: { path: string; options?: RequestInit }) => request<unknown>(path, options),
    onSuccess: async () => { await invalidatePersonalLists(); setNotice({ severity: 'success', message: 'Saved successfully' }); },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) void loseAuthentication();
      setNotice({ severity: 'error', message: error instanceof ApiError ? error.message : 'Something went wrong. Please try again.' });
    }
  });
  const visibilityMutation = useMutation({
    mutationFn: ({ listType, visibility }: { listType: 'top-list' | 'singing-list'; visibility: ListVisibility }) => request<ListSettings>(`/api/me/lists/${listType}/visibility`, { method: 'PATCH', body: JSON.stringify({ visibility }) }),
    onSuccess: (settings) => {
      if (user) client.setQueryData(queryKeys.listSettings(user.id), settings);
      setNotice({ severity: 'success', message: 'List visibility updated' });
    },
    onError: (error) => setNotice({ severity: 'error', message: error instanceof ApiError ? error.message : 'Could not update visibility' })
  });

  const topEntries = topQuery.data ?? [];
  const singingEntries = singingQuery.data ?? [];
  const settings = settingsQuery.data ?? { topList: 'PRIVATE' as const, singingList: 'PRIVATE' as const };
  const artists = useMemo(() => Array.from(new Set((songsQuery.data ?? []).map((song) => song.artist))).sort((left, right) => left.localeCompare(right)), [songsQuery.data]);
  const releaseYears = useMemo(() => Array.from(new Set((songsQuery.data ?? []).flatMap((song) => song.releaseYear === null ? [] : [song.releaseYear]))).sort((left, right) => right - left), [songsQuery.data]);
  const topSongIds = useMemo(() => new Set(topEntries.map((entry) => entry.id)), [topEntries]);
  const singingSongIds = useMemo(() => new Set(singingEntries.map((entry) => entry.id)), [singingEntries]);
  const requireUser = (action: () => void) => user ? action() : openAuth('login');
  const addTop = (songId: string) => requireUser(() => mutation.mutate({ path: '/api/me/top-list/items', options: { method: 'POST', body: JSON.stringify({ songId }) } }));
  const addSinging = (songId: string) => requireUser(() => mutation.mutate({ path: `/api/me/singing-list/items/${songId}`, options: { method: 'PUT', body: JSON.stringify({ status: 'WANT_TO_LEARN' }) } }));
  const reorderTop = (orderedSongIds: string[]) => mutation.mutate({ path: '/api/me/top-list/order', options: { method: 'PATCH', body: JSON.stringify({ orderedSongIds }) } });
  const saveSinging = (songId: string, status: SingingStatus, note: string) => mutation.mutate({ path: `/api/me/singing-list/items/${songId}`, options: { method: 'PUT', body: JSON.stringify({ status, note }) } });
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';

  const accountAction = sessionQuery.isLoading ? <CircularProgress size={22} aria-label="Loading account" /> : user
    ? <AccountActions user={user} onLogout={() => logoutMutation.mutate()} />
    : <Stack direction="row" spacing={1}><Button onClick={() => openAuth('login')}>Sign in</Button><Button variant="contained" onClick={() => openAuth('register')}>Register</Button></Stack>;

  return <><CssBaseline /><Brand action={accountAction} />
    <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl"><Stack spacing={2}>
      {sessionQuery.isError && <Alert severity="warning">Account status could not be loaded. Public rankings are still available.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(360px, 0.85fr)' }, gap: 2.5, alignItems: 'start' }}>
        <Box sx={{ order: { xs: 2, lg: 1 } }}><RankingPanel ranking={rankingQuery.data} isLoading={rankingsQuery.isLoading || rankingQuery.isLoading} query={query} onQueryChange={setQuery} artistFilter={artistFilter} onArtistFilterChange={setArtistFilter} releaseYearFilter={releaseYearFilter} onReleaseYearFilterChange={setReleaseYearFilter} artists={artists} releaseYears={releaseYears} topSongIds={topSongIds} singingSongIds={singingSongIds} topAtCapacity={topEntries.length >= 10} onAddTop={addTop} onAddSinging={addSinging} /></Box>
        <Box sx={{ order: { xs: 1, lg: 2 } }}>{sessionQuery.isLoading ? <AccountLoadingPanel /> : user ? <Stack spacing={2.5}>
          <TopListPanel entries={topEntries} onReorder={reorderTop} onRemove={(songId) => mutation.mutate({ path: `/api/me/top-list/items/${songId}`, options: { method: 'DELETE' } })} statusLabel={<VisibilityStatus label="Top 10" visibility={settings.topList} />} headerAction={<VisibilityControl label="Top 10" visibility={settings.topList} publicUrl={publicUrl} disabled={visibilityMutation.isPending} onChange={(visibility) => visibilityMutation.mutate({ listType: 'top-list', visibility })} onShareComplete={(method) => setNotice({ severity: 'success', message: method === 'shared' ? 'Public profile shared' : 'Public profile link copied' })} />} />
          <SingingListPanel entries={singingEntries} filter={filter} onFilterChange={setFilter} onSave={saveSinging} onRemove={(songId) => mutation.mutate({ path: `/api/me/singing-list/items/${songId}`, options: { method: 'DELETE' } })} statusLabel={<VisibilityStatus label="Singing List" visibility={settings.singingList} />} headerAction={<VisibilityControl label="Singing List" visibility={settings.singingList} publicUrl={publicUrl} privateNotes disabled={visibilityMutation.isPending} onChange={(visibility) => visibilityMutation.mutate({ listType: 'singing-list', visibility })} onShareComplete={(method) => setNotice({ severity: 'success', message: method === 'shared' ? 'Public profile shared' : 'Public profile link copied' })} />} />
          {(topQuery.isLoading || singingQuery.isLoading || settingsQuery.isLoading) && <Stack direction="row" alignItems="center" gap={1} color="text.secondary"><CircularProgress size={16} /> Loading your lists</Stack>}
        </Stack> : <SignedOutPanel onSignIn={() => openAuth('login')} onRegister={() => openAuth('register')} />}</Box>
      </Box>
    </Stack></Container></Box>
    <AuthDialog open={authDialog.open} initialMode={authDialog.mode} isPending={authMutation.isPending} error={authMutation.error instanceof ApiError ? authMutation.error.message : authMutation.isError ? 'Something went wrong. Please try again.' : null} onClose={() => setAuthDialog((current) => ({ ...current, open: false }))} onSubmit={(input) => authMutation.mutate(input)} />
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert severity={notice?.severity} onClose={() => setNotice(null)} variant="filled">{notice?.message}</Alert></Snackbar>
  </>;
}

function PublicProfilePage({ username }: { username: string }) {
  const profileQuery = useQuery({ queryKey: queryKeys.publicProfile(username), queryFn: () => request<PublicProfile>(`/api/users/${encodeURIComponent(username)}`), retry: false });
  const profile = profileQuery.data;
  const topQuery = useQuery({ queryKey: queryKeys.publicTopList(username), queryFn: () => request<TopListEntry[]>(`/api/users/${encodeURIComponent(username)}/top-list`), enabled: profile?.lists.topList === 'PUBLIC', retry: false });
  const singingQuery = useQuery({ queryKey: queryKeys.publicSingingList(username), queryFn: () => request<PublicSingingListEntry[]>(`/api/users/${encodeURIComponent(username)}/singing-list`), enabled: profile?.lists.singingList === 'PUBLIC', retry: false });

  return <><CssBaseline /><Brand action={<Button href="/" variant="outlined">Back to ranking</Button>} />
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}><Container maxWidth="md">
      {profileQuery.isLoading ? <Stack alignItems="center" py={10}><CircularProgress aria-label="Loading public profile" /></Stack>
        : profileQuery.isError || !profile ? <Alert severity="info"><Typography fontWeight={800}>Public profile not found</Typography>This user has no public lists, or the address is incorrect.</Alert>
          : <Stack spacing={3}>
            <Box><Typography variant="overline" color="secondary.main" fontWeight={800}>Public profile</Typography><Typography variant="h1" fontSize={{ xs: '2rem', md: '2.65rem' }}>{profile.displayName}</Typography><Typography color="text.secondary">@{profile.username}</Typography></Box>
            {profile.lists.topList === 'PUBLIC' && <Paper component="section" sx={{ p: 3 }} aria-labelledby="public-top-heading"><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography id="public-top-heading" variant="h2" fontSize="1.55rem">Top 10</Typography><Chip label="Public" color="success" size="small" /></Stack>{topQuery.isLoading ? <CircularProgress size={20} sx={{ mt: 3 }} /> : <List disablePadding sx={{ mt: 1 }}>{(topQuery.data ?? []).map((entry) => <ListItem key={entry.id} divider disableGutters><Typography color="primary.main" fontWeight={800} sx={{ width: 34 }}>{entry.position}</Typography><ListItemText primary={entry.title} secondary={entry.artist} primaryTypographyProps={{ fontWeight: 700 }} /></ListItem>)}</List>}</Paper>}
            {profile.lists.singingList === 'PUBLIC' && <Paper component="section" sx={{ p: 3 }} aria-labelledby="public-singing-heading"><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography id="public-singing-heading" variant="h2" fontSize="1.55rem">Singing List</Typography><Typography variant="body2" color="text.secondary">Personal notes stay private.</Typography></Box><Chip label="Public" color="success" size="small" /></Stack>{singingQuery.isLoading ? <CircularProgress size={20} sx={{ mt: 3 }} /> : <List disablePadding sx={{ mt: 1 }}>{(singingQuery.data ?? []).map((entry) => <ListItem key={entry.id} divider disableGutters><ListItemText primary={entry.title} secondary={entry.artist} primaryTypographyProps={{ fontWeight: 700 }} /><Chip label={statusLabels[entry.status]} size="small" variant="outlined" /></ListItem>)}</List>}</Paper>}
          </Stack>}
    </Container></Box>
  </>;
}

export default function App() {
  const publicProfileMatch = window.location.pathname.match(/^\/u\/([^/]+)\/?$/);
  if (!publicProfileMatch) return <HomePage />;
  try {
    return <PublicProfilePage username={decodeURIComponent(publicProfileMatch[1])} />;
  } catch {
    return <PublicProfilePage username="" />;
  }
}
