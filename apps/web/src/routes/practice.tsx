import { Box, Container } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import type { SingingStatus } from '../api';
import { SingingListPanel } from '../components/SingingListPanel';
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
  const { user, notify, mutate, setVisibility, isVisibilityPending } = useAppShell();
  const [filter, setFilter] = useState<SingingStatus | 'ALL'>('ALL');
  const singingQuery = useQuery(singingListQueryOptions(user, filter));
  const settingsQuery = useQuery(listSettingsQueryOptions(user));
  const settings = settingsQuery.data ?? { topList: 'PRIVATE' as const, singingList: 'PRIVATE' as const };
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';
  const shareNotice = (method: 'shared' | 'copied') => notify('success', method === 'shared' ? 'Public profile shared' : 'Public profile link copied');

  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl">
    <SingingListPanel
      entries={singingQuery.data ?? []}
      filter={filter}
      onFilterChange={setFilter}
      onSave={(songId, status, note) => mutate(`/api/me/singing-list/items/${songId}`, { method: 'PUT', body: JSON.stringify({ status, note }) })}
      onRemove={(songId) => mutate(`/api/me/singing-list/items/${songId}`, { method: 'DELETE' })}
      statusLabel={<VisibilityStatus label="Singing List" visibility={settings.singingList} />}
      headerAction={<VisibilityControl label="Singing List" visibility={settings.singingList} publicUrl={publicUrl} privateNotes disabled={isVisibilityPending} onChange={(visibility) => setVisibility('singing-list', visibility)} onShareComplete={shareNotice} />}
    />
  </Container></Box>;
}
