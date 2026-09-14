import { Box, Container } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createRoute, redirect } from '@tanstack/react-router';
import { TopListPanel } from '../components/TopListPanel';
import { VisibilityControl, VisibilityStatus } from '../components/VisibilityControl';
import { listSettingsQueryOptions, sessionQueryOptions, topListQueryOptions } from '../queries';
import { useAppShell } from '../shell/AppShellContext';
import { Route as rootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/personal',
  component: PersonalRankingPage,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.user) throw redirect({ to: '/rankings/$decade/$region', params: { decade: '90s', region: 'mainland' }, search: { signin: true } });
  }
});

function PersonalRankingPage() {
  const { user, notify, mutate, setVisibility, isVisibilityPending } = useAppShell();
  const topQuery = useQuery(topListQueryOptions(user));
  const settingsQuery = useQuery(listSettingsQueryOptions(user));
  const settings = settingsQuery.data ?? { topList: 'PRIVATE' as const, singingList: 'PRIVATE' as const };
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';
  const shareNotice = (method: 'shared' | 'copied') => notify('success', method === 'shared' ? 'Public profile shared' : 'Public profile link copied');

  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl">
    <TopListPanel
      entries={topQuery.data ?? []}
      onReorder={(orderedSongIds) => mutate('/api/me/top-list/order', { method: 'PATCH', body: JSON.stringify({ orderedSongIds }) })}
      onRemove={(songId) => mutate(`/api/me/top-list/items/${songId}`, { method: 'DELETE' })}
      statusLabel={<VisibilityStatus label="Top 10" visibility={settings.topList} />}
      headerAction={<VisibilityControl label="Top 10" visibility={settings.topList} publicUrl={publicUrl} disabled={isVisibilityPending} onChange={(visibility) => setVisibility('top-list', visibility)} onShareComplete={shareNotice} />}
    />
  </Container></Box>;
}
