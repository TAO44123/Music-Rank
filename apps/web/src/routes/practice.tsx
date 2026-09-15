import { Box, Container } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { ApiError, request, type AddSongToListInput, type ExistingSong, type SingingListEntry, type SingingStatus } from '../api';
import { SingingListPanel } from '../components/SingingListPanel';
import { ExistingSongConfirmationDialog, UnlistedSongDialog, UnlistedSongPrompt } from '../components/UnlistedSongDialog';
import { VisibilityControl, VisibilityStatus } from '../components/VisibilityControl';
import { listSettingsQueryOptions, sessionQueryOptions, singingListQueryOptions } from '../queries';
import { useAppShell } from '../shell/AppShellContext';
import { Route as rootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice',
  component: PracticeLibraryPage,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.user) throw redirect({ to: '/', search: { signin: true } });
  }
});

function PracticeLibraryPage() {
  const { user, notify, mutate, setVisibility, isVisibilityPending, onUnauthorized } = useAppShell();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<SingingStatus | 'ALL'>('ALL');
  const singingQuery = useQuery(singingListQueryOptions(user, filter));
  const settingsQuery = useQuery(listSettingsQueryOptions(user));
  const settings = settingsQuery.data ?? { topList: 'PRIVATE' as const, singingList: 'PRIVATE' as const };
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';
  const shareNotice = (method: 'shared' | 'copied') => notify('success', method === 'shared' ? 'Public profile shared' : 'Public profile link copied');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [existingSong, setExistingSong] = useState<ExistingSong | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const addSongMutation = useMutation({
    mutationFn: ({ input }: { input: AddSongToListInput; fromConfirmation: boolean }) => request<SingingListEntry[]>('/api/me/singing-list/items', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      if (user) await queryClient.invalidateQueries({ queryKey: ['personal', user.id, 'singing-list'] });
      setIsAddOpen(false);
      setExistingSong(null);
      setFormError(null);
      notify('success', 'Song added to My Practice Library');
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
    <SingingListPanel
      entries={singingQuery.data ?? []}
      filter={filter}
      onFilterChange={setFilter}
      onSave={(songId, status, note) => mutate(`/api/me/singing-list/items/${songId}`, { method: 'PUT', body: JSON.stringify({ status, note }) })}
      onRemove={(songId) => mutate(`/api/me/singing-list/items/${songId}`, { method: 'DELETE' })}
      promptAction={<UnlistedSongPrompt onClick={() => { setFormError(null); setIsAddOpen(true); }} />}
      statusLabel={<VisibilityStatus label="Practice Library" visibility={settings.singingList} />}
      headerAction={<VisibilityControl label="Practice Library" visibility={settings.singingList} publicUrl={publicUrl} privateNotes disabled={isVisibilityPending} onChange={(visibility) => setVisibility('singing-list', visibility)} onShareComplete={shareNotice} />}
    />
    <UnlistedSongDialog open={isAddOpen} listLabel="My Practice Library" isPending={addSongMutation.isPending} error={formError} onClose={closeAddDialog} onSubmit={(song) => addSongMutation.mutate({ input: { song }, fromConfirmation: false })} />
    <ExistingSongConfirmationDialog song={existingSong} listLabel="My Practice Library" isPending={addSongMutation.isPending} onCancel={() => { if (!addSongMutation.isPending) setExistingSong(null); }} onConfirm={() => { if (existingSong) addSongMutation.mutate({ input: { songId: existingSong.id }, fromConfirmation: true }); }} />
  </Container></Box>;
}

function isExistingSong(value: unknown): value is ExistingSong {
  return typeof value === 'object' && value !== null
    && typeof (value as ExistingSong).id === 'string'
    && typeof (value as ExistingSong).title === 'string'
    && typeof (value as ExistingSong).artist === 'string';
}
