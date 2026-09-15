import { Box, Button, Container, Stack } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { ApiError, request, type AddSongToListInput, type ExistingSong, type TopListEntry } from '../api';
import { TopListPanel } from '../components/TopListPanel';
import { ExistingSongConfirmationDialog, UnlistedSongDialog } from '../components/UnlistedSongDialog';
import { VisibilityControl, VisibilityStatus } from '../components/VisibilityControl';
import { listSettingsQueryOptions, queryKeys, sessionQueryOptions, topListQueryOptions } from '../queries';
import { useAppShell } from '../shell/AppShellContext';
import { Route as rootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/personal',
  component: PersonalRankingPage,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.user) throw redirect({ to: '/', search: { signin: true } });
  }
});

function PersonalRankingPage() {
  const { user, notify, mutate, setVisibility, isVisibilityPending, onUnauthorized } = useAppShell();
  const queryClient = useQueryClient();
  const topQuery = useQuery(topListQueryOptions(user));
  const settingsQuery = useQuery(listSettingsQueryOptions(user));
  const settings = settingsQuery.data ?? { topList: 'PRIVATE' as const, singingList: 'PRIVATE' as const };
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';
  const shareNotice = (method: 'shared' | 'copied') => notify('success', method === 'shared' ? 'Public profile shared' : 'Public profile link copied');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [existingSong, setExistingSong] = useState<ExistingSong | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const addSongMutation = useMutation({
    mutationFn: ({ input }: { input: AddSongToListInput; fromConfirmation: boolean }) => request<TopListEntry[]>('/api/me/top-list/items', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      if (user) await queryClient.invalidateQueries({ queryKey: queryKeys.topList(user.id) });
      setIsAddOpen(false);
      setExistingSong(null);
      setFormError(null);
      notify('success', 'Song added to My Top 10');
    },
    onError: (error, { fromConfirmation }) => {
      if (error instanceof ApiError && error.status === 401) void onUnauthorized();
      const candidate = error instanceof ApiError ? error.data.existingSong : null;
      if (error instanceof ApiError && error.code === 'SONG_ALREADY_EXISTS' && isExistingSong(candidate)) {
        setIsAddOpen(false);
        setExistingSong(candidate);
        return;
      }
      if (fromConfirmation) notify('error', error instanceof ApiError ? error.message : 'Could not add this song. Please try again.');
      else setFormError(error instanceof ApiError ? error.message : 'Could not add this song. Please try again.');
    }
  });
  const closeAddDialog = () => {
    if (addSongMutation.isPending) return;
    setIsAddOpen(false);
    setFormError(null);
    addSongMutation.reset();
  };

  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl">
    <TopListPanel
      entries={topQuery.data ?? []}
      onReorder={(orderedSongIds) => mutate('/api/me/top-list/order', { method: 'PATCH', body: JSON.stringify({ orderedSongIds }) })}
      onRemove={(songId) => mutate(`/api/me/top-list/items/${songId}`, { method: 'DELETE' })}
      statusLabel={<VisibilityStatus label="Top 10" visibility={settings.topList} />}
      headerAction={<Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" onClick={() => { setFormError(null); setIsAddOpen(true); }} disabled={topQuery.data?.length === 10}>Add a song not listed</Button>
        <VisibilityControl label="Top 10" visibility={settings.topList} publicUrl={publicUrl} disabled={isVisibilityPending} onChange={(visibility) => setVisibility('top-list', visibility)} onShareComplete={shareNotice} />
      </Stack>}
    />
    <UnlistedSongDialog open={isAddOpen} listLabel="My Top 10" isPending={addSongMutation.isPending} error={formError} onClose={closeAddDialog} onSubmit={(song) => addSongMutation.mutate({ input: { song }, fromConfirmation: false })} />
    <ExistingSongConfirmationDialog song={existingSong} listLabel="My Top 10" isPending={addSongMutation.isPending} onCancel={() => { if (!addSongMutation.isPending) setExistingSong(null); }} onConfirm={() => { if (existingSong) addSongMutation.mutate({ input: { songId: existingSong.id }, fromConfirmation: true }); }} />
  </Container></Box>;
}

function isExistingSong(value: unknown): value is ExistingSong {
  return typeof value === 'object' && value !== null
    && typeof (value as ExistingSong).id === 'string'
    && typeof (value as ExistingSong).title === 'string'
    && typeof (value as ExistingSong).artist === 'string';
}
