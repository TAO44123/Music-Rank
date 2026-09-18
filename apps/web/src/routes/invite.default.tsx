import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { ApiError, request, type AuthSession, type GroupSummary } from '../api';
import { defaultInvitationQueryOptions, queryKeys } from '../queries';
import { useAppShell } from '../shell/AppShellContext';
import { Route as rootRoute } from './__root';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/invite/default', component: InvitationPage });

function InvitationPage() {
  const { user, isSessionLoading, isSessionError, openAuth, onUnauthorized } = useAppShell();
  const invitation = useQuery(defaultInvitationQueryOptions());
  const client = useQueryClient();
  const router = useRouter();
  const attemptedUser = useRef<string | null>(null);
  const join = useMutation({
    mutationFn: (_userId: string) => request<GroupSummary>('/api/group-invitations/default/join', { method: 'POST' }),
    onSuccess: async (_group, userId) => {
      if (client.getQueryData<AuthSession>(queryKeys.session)?.user?.id !== userId) return;
      await client.invalidateQueries({ queryKey: queryKeys.groups(userId) });
      if (client.getQueryData<AuthSession>(queryKeys.session)?.user?.id === userId && router.state.location.pathname === '/invite/default') {
        await router.navigate({ to: '/groups' });
      }
    },
    onError: (error, userId) => {
      if (error instanceof ApiError && error.status === 401 && client.getQueryData<AuthSession>(queryKeys.session)?.user?.id === userId) {
        void onUnauthorized();
      }
    }
  });
  const mutate = join.mutate;
  useEffect(() => {
    if (!user) { attemptedUser.current = null; return; }
    if (isSessionLoading || isSessionError || !invitation.data || attemptedUser.current === user.id) return;
    attemptedUser.current = user.id;
    mutate(user.id);
  }, [user, isSessionLoading, isSessionError, invitation.data, mutate]);

  return <Box component="main" sx={{ py: { xs: 3, md: 6 } }}><Container maxWidth="sm"><Paper sx={{ p: { xs: 2, sm: 4 } }}><Stack spacing={3}>
    <Typography variant="overline" color="secondary.main">You’re invited</Typography>
    <Typography variant="h1" sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>Join {invitation.data?.name ?? 'Default Group'}</Typography>
    <Typography>Meet other music lovers and explore the lists they’ve made public. Your private lists and practice notes stay private.</Typography>
    {isSessionLoading || invitation.isLoading ? <CircularProgress aria-label="Loading invitation" />
      : isSessionError ? <Alert severity="error" action={<Button onClick={() => void client.invalidateQueries({ queryKey: queryKeys.session })}>Retry</Button>}>Could not check your sign-in status.</Alert>
        : invitation.isError ? <Alert severity="error" action={<Button onClick={() => void invitation.refetch()}>Retry</Button>}>This invitation could not be loaded.</Alert>
          : !user ? <><Typography>Sign in or create an account to automatically join Default Group.</Typography>
            <Stack direction="row" spacing={2}><Button variant="contained" onClick={() => openAuth('login')}>Sign in</Button><Button variant="outlined" onClick={() => openAuth('register')}>Create account</Button></Stack></>
            : join.isError ? <Alert severity="error" action={<Button disabled={join.isPending} onClick={() => mutate(user.id)}>Retry</Button>}>Could not join the group. You are still signed in.</Alert>
              : <Stack direction="row" alignItems="center" gap={2}><CircularProgress size={24} aria-label="Joining group" /><Typography>Opening your group…</Typography></Stack>}
  </Stack></Paper></Container></Box>;
}
