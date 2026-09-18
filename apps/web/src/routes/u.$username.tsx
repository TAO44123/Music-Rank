import { Alert, Box, Button, Chip, CircularProgress, Container, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createRoute, Link } from '@tanstack/react-router';
import { groupIdSchema } from '@music-rank/contracts';
import { useEffect } from 'react';
import { ApiError } from '../api';
import { useAppShell } from '../shell/AppShellContext';
import { Brand } from '../components/Brand';
import { groupMemberProfileQueryOptions, publicProfileQueryOptions, publicSingingListQueryOptions, publicTopListQueryOptions } from '../queries';
import { statusLabels } from '../status';
import { Route as rootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/u/$username',
  validateSearch: (search: Record<string, unknown>) => ({ group: groupIdSchema.optional().catch(undefined).parse(search.group) }),
  component: PublicProfilePage
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const { group } = Route.useSearch();
  const { user, isSessionLoading, onUnauthorized } = useAppShell();
  const groupContext = Boolean(group && user);
  const publicQuery = useQuery(publicProfileQueryOptions(username, !group || (!isSessionLoading && !user)));
  const memberQuery = useQuery(groupMemberProfileQueryOptions(user, group, username));
  const profileQuery = groupContext ? memberQuery : publicQuery;
  useEffect(() => {
    if (memberQuery.error instanceof ApiError && memberQuery.error.status === 401) void onUnauthorized();
  }, [memberQuery.error, onUnauthorized]);
  const profile = profileQuery.data;
  const topQuery = useQuery(publicTopListQueryOptions(username, profile?.lists.topList === 'PUBLIC'));
  const singingQuery = useQuery(publicSingingListQueryOptions(username, profile?.lists.singingList === 'PUBLIC'));

  return <><Brand action={<Button component={Link} to={group ? "/groups" : "/"} variant="outlined">{group ? 'Back to group' : 'Back to ranking'}</Button>} />
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}><Container maxWidth="md">
      {(group && isSessionLoading) || profileQuery.isLoading ? <Stack alignItems="center" py={10}><CircularProgress aria-label="Loading public profile" /></Stack>
        : profileQuery.isError || !profile ? groupContext
          ? <Alert severity="error" action={<Button onClick={() => void profileQuery.refetch()}>Retry</Button>}>Could not load this member’s profile.</Alert>
          : <Alert severity="info"><Typography fontWeight={800}>Public profile not found</Typography>This user has no public lists, or the address is incorrect.</Alert>
          : <Stack spacing={3} sx={{ overflowWrap: 'anywhere' }}>
            <Box><Typography variant="overline" color="secondary.main" fontWeight={800}>Public profile</Typography><Typography variant="h1" fontSize={{ xs: '2rem', md: '2.65rem' }}>{profile.displayName}</Typography><Typography color="text.secondary">@{profile.username}</Typography></Box>
            {profile.lists.topList !== 'PUBLIC' && profile.lists.singingList !== 'PUBLIC' && <Alert severity="info">This member has not made any lists public yet.</Alert>}
            {profile.lists.topList === 'PUBLIC' && <Paper component="section" sx={{ p: 3 }} aria-labelledby="public-top-heading"><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography id="public-top-heading" variant="h2" fontSize="1.55rem">Top 10</Typography><Chip label="Public" color="success" size="small" /></Stack>{topQuery.isLoading ? <CircularProgress size={20} sx={{ mt: 3 }} /> : topQuery.isError ? <Alert severity="error" sx={{ mt: 2 }}>Could not load this public list.</Alert> : <List disablePadding sx={{ mt: 1 }}>{(topQuery.data ?? []).map((entry) => <ListItem key={entry.id} divider disableGutters><Typography color="primary.main" fontWeight={800} sx={{ width: 34 }}>{entry.position}</Typography><ListItemText primary={entry.title} secondary={entry.artist} primaryTypographyProps={{ fontWeight: 700 }} /></ListItem>)}</List>}</Paper>}
            {profile.lists.singingList === 'PUBLIC' && <Paper component="section" sx={{ p: 3 }} aria-labelledby="public-singing-heading"><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography id="public-singing-heading" variant="h2" fontSize="1.55rem">Practice Library</Typography><Typography variant="body2" color="text.secondary">Personal notes stay private.</Typography></Box><Chip label="Public" color="success" size="small" /></Stack>{singingQuery.isLoading ? <CircularProgress size={20} sx={{ mt: 3 }} /> : singingQuery.isError ? <Alert severity="error" sx={{ mt: 2 }}>Could not load this public list.</Alert> : <List disablePadding sx={{ mt: 1 }}>{(singingQuery.data ?? []).map((entry) => <ListItem key={entry.id} divider disableGutters><ListItemText primary={entry.title} secondary={entry.artist} primaryTypographyProps={{ fontWeight: 700 }} /><Chip label={statusLabels[entry.status]} size="small" variant="outlined" /></ListItem>)}</List>}</Paper>}
          </Stack>}
    </Container></Box>
  </>;
}
