import { Alert, Avatar, Box, Button, Chip, CircularProgress, Container, List, ListItem, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createLink, createRoute, redirect } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ApiError, type GroupSummary } from '../api';
import { ShareInvitation } from '../components/ShareInvitation';
import { groupMembersQueryOptions, groupsQueryOptions, sessionQueryOptions } from '../queries';
import { useAppShell } from '../shell/AppShellContext';
import { Route as rootRoute } from './__root';

const MemberLink = createLink(ListItemButton);

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups',
  component: GroupsPage,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.user) throw redirect({ to: '/', search: { signin: true } });
  }
});

function GroupsPage() {
  const { user, onUnauthorized } = useAppShell();
  const query = useQuery(groupsQueryOptions(user));
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) void onUnauthorized();
  }, [query.error, onUnauthorized]);
  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="md"><Stack spacing={3}>
    <Typography variant="h1" sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>Groups</Typography>
    {query.isLoading ? <CircularProgress aria-label="Loading groups" />
      : query.isError ? <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Retry</Button>}>Could not load your groups.</Alert>
        : query.data?.length === 0 ? <Paper sx={{ p: { xs: 2, sm: 3 } }}><Typography>You have not joined any groups yet.</Typography></Paper>
          : query.data?.map((group) => <GroupPanel key={group.id} group={group} />)}
  </Stack></Container></Box>;
}

function GroupPanel({ group }: { group: GroupSummary }) {
  const { user, onUnauthorized } = useAppShell();
  const query = useQuery(groupMembersQueryOptions(user, group.id));
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) void onUnauthorized();
  }, [query.error, onUnauthorized]);
  return <Paper component="section" sx={{ p: { xs: 2, sm: 3 } }} aria-labelledby={`group-${group.id}`}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
      <Box><Typography id={`group-${group.id}`} variant="h2" sx={{ fontSize: '1.6rem' }}>{group.name}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>Discover your group members’ public music lists.</Typography></Box>
      <ShareInvitation />
    </Stack>
    {query.isLoading ? <CircularProgress aria-label="Loading group members" sx={{ mt: 3 }} />
      : query.isError ? <Alert severity="error" sx={{ mt: 3 }} action={<Button onClick={() => void query.refetch()}>Retry</Button>}>Could not load group members.</Alert>
        : <><Chip label={`${query.data?.length ?? 0} members`} size="small" sx={{ mt: 3 }} />
          <List aria-label="Group members" sx={{ mt: 1 }}>{query.data?.map((member) => <ListItem key={member.id} disablePadding divider>
            <MemberLink to="/u/$username" params={{ username: member.username }} search={{ group: group.id }} sx={{ gap: 2, minWidth: 0, px: 0, py: 2 }}>
              <Avatar sx={{ flexShrink: 0 }}>{member.displayName.slice(0, 1).toUpperCase()}</Avatar>
              <ListItemText primary={member.displayName} secondary={`@${member.username}`} sx={{ minWidth: 0, overflowWrap: 'anywhere' }} />
            </MemberLink>
          </ListItem>)}</List>
        </>}
  </Paper>;
}
