import { Alert, Box, Button, Chip, CircularProgress, Container, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createRoute, Link } from '@tanstack/react-router';
import { groupIdSchema } from '@music-rank/contracts';
import { useEffect } from 'react';
import { z } from 'zod';
import { VisibilityStatus } from '../components/VisibilityControl';
import { ApiError } from '../api';
import { useAppShell } from '../shell/AppShellContext';
import { Brand } from '../components/Brand';
import { ListReactionButton } from '../components/ListReactionButton';
import { useListReaction } from '../hooks/useListReaction';
import { groupMemberProfileQueryOptions, publicProfileQueryOptions, publicSingingListQueryOptions, publicTopListQueryOptions, listSettingsQueryOptions, topListQueryOptions, singingListQueryOptions } from '../queries';
import { statusLabels } from '../status';
import { Route as rootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/u/$username',
  validateSearch: (search: Record<string, unknown>): { group?: string; view?: 'public' } => ({
    group: groupIdSchema.optional().catch(undefined).parse(search.group),
    view: z.literal('public').optional().catch(undefined).parse(search.view)
  }),
  component: PublicProfilePage
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const navigate = Route.useNavigate();
  const { group, view } = Route.useSearch();
  const { user, isSessionLoading, isSessionError, onUnauthorized } = useAppShell();
  const reactions = useListReaction(username);
  const isOwner = Boolean(user && user.username === username.toLowerCase());
  const ownerView = isOwner && view !== 'public';
  const owner = ownerView ? user : null;
  const groupContext = Boolean(group && user && !ownerView && view !== 'public');
  const publicQuery = useQuery(publicProfileQueryOptions(username, !isSessionLoading && !isSessionError && !ownerView && !groupContext));
  const memberQuery = useQuery(groupMemberProfileQueryOptions(groupContext ? user : null, group, username));
  const settingsQuery = useQuery(listSettingsQueryOptions(owner));
  const ownerTopQuery = useQuery(topListQueryOptions(owner));
  const ownerSingingQuery = useQuery(singingListQueryOptions(owner, 'ALL'));
  const profileQuery = groupContext ? memberQuery : publicQuery;
  useEffect(() => {
    const errors = [memberQuery.error, settingsQuery.error, ownerTopQuery.error, ownerSingingQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.status === 401)) void onUnauthorized();
  }, [memberQuery.error, settingsQuery.error, ownerTopQuery.error, ownerSingingQuery.error, onUnauthorized]);
  const profile = ownerView && user
    ? settingsQuery.data && { ...user, lists: settingsQuery.data }
    : profileQuery.data;
  const publicTopQuery = useQuery(publicTopListQueryOptions(username, user, !ownerView && !isSessionLoading && !isSessionError && profile?.lists.topList === 'PUBLIC'));
  const publicSingingQuery = useQuery(publicSingingListQueryOptions(username, user, !ownerView && !isSessionLoading && !isSessionError && profile?.lists.singingList === 'PUBLIC'));
  const topQuery = ownerView ? ownerTopQuery : publicTopQuery;
  const singingQuery = ownerView ? ownerSingingQuery : publicSingingQuery;
  const loading = isSessionLoading || (ownerView ? settingsQuery.isLoading : profileQuery.isLoading);
  const profileError = ownerView ? settingsQuery.isError : profileQuery.isError;

  return <><Brand action={<Button component={Link} to={group ? "/groups" : "/"} variant="outlined">{group ? 'Back to group' : 'Back to ranking'}</Button>} />
    <Box component="main" sx={{ py: { xs: 3, md: 5 } }}><Container maxWidth="md">
      {isOwner && !isSessionLoading && !isSessionError && <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography color="text.secondary">{ownerView ? 'Only you can see your private lists here. Recipients of your profile link can only see public lists.' : 'This is what other people can see. Your private lists are hidden.'}</Typography>
        <Button onClick={() => void navigate({ search: { group, view: ownerView ? 'public' : undefined } })} variant="outlined" sx={{ alignSelf: 'flex-start' }}>{ownerView ? 'View public display' : 'Back to my profile'}</Button>
      </Stack>}

      {isSessionError ? <Alert severity="error">Could not check your sign-in status. Please reload to try again.</Alert>
        : loading ? <Stack alignItems="center" py={10}><CircularProgress aria-label="Loading profile" /></Stack>
        : profileError || !profile ? ownerView
          ? <Alert severity="error" action={<Button onClick={() => void settingsQuery.refetch()}>Retry</Button>}>Could not load your profile.</Alert>
          : groupContext
          ? <Alert severity="error" action={<Button onClick={() => void profileQuery.refetch()}>Retry</Button>}>Could not load this member’s profile.</Alert>
          : <Alert severity="info"><Typography fontWeight={800}>Public profile not found</Typography>This user has no public lists, or the address is incorrect.</Alert>
          : <Stack spacing={3} sx={{ overflowWrap: 'anywhere' }}>
            <Box><Typography variant="overline" color="secondary.main" fontWeight={800}>{ownerView ? 'Your profile' : 'Public profile'}</Typography><Typography variant="h1" fontSize={{ xs: '2rem', md: '2.65rem' }}>{profile.displayName}</Typography><Typography color="text.secondary">@{profile.username}</Typography></Box>
            {!ownerView && profile.lists.topList !== 'PUBLIC' && profile.lists.singingList !== 'PUBLIC' && <Alert severity="info">This member has not made any lists public yet.</Alert>}
            {(ownerView || profile.lists.topList === 'PUBLIC') && <Paper component="section" sx={{ p: 3 }} aria-labelledby="public-top-heading"><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography id="public-top-heading" variant="h2" fontSize="1.55rem">Top 10</Typography><VisibilityStatus label="Top 10" visibility={profile.lists.topList} /></Stack>{topQuery.isLoading ? <CircularProgress size={20} sx={{ mt: 3 }} /> : topQuery.isError ? <Alert severity="error" sx={{ mt: 2 }}>Could not load this list.</Alert> : <List disablePadding sx={{ mt: 1 }}>{(topQuery.data ?? []).map((entry) => <ListItem key={entry.id} divider disableGutters sx={{ display: 'block' }}><Box sx={{ display: 'flex', alignItems: 'center' }}><Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}><Typography color="primary.main" fontWeight={800} sx={{ width: 34, flexShrink: 0 }}>{entry.position}</Typography><ListItemText primary={entry.title} secondary={entry.artist} primaryTypographyProps={{ fontWeight: 700 }} sx={{ minWidth: 0 }} /></Box><Box sx={{ flexShrink: 0 }}><ListReactionButton kind="LIKE" songTitle={entry.title} reactionCount={entry.reactionCount} viewerHasReacted={entry.viewerHasReacted} disabled={reactions.isPending('top-list', entry.id)} onToggle={() => reactions.toggleReaction('top-list', entry.id, entry.viewerHasReacted)} /></Box></Box></ListItem>)}</List>}</Paper>}
            {(ownerView || profile.lists.singingList === 'PUBLIC') && <Paper component="section" sx={{ p: 3 }} aria-labelledby="public-singing-heading"><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography id="public-singing-heading" variant="h2" fontSize="1.55rem">Practice Library</Typography><Typography variant="body2" color="text.secondary">Personal notes stay private.</Typography></Box><VisibilityStatus label="Practice Library" visibility={profile.lists.singingList} /></Stack>{singingQuery.isLoading ? <CircularProgress size={20} sx={{ mt: 3 }} /> : singingQuery.isError ? <Alert severity="error" sx={{ mt: 2 }}>Could not load this list.</Alert> : <List disablePadding sx={{ mt: 1 }}>{(singingQuery.data ?? []).map((entry) => <ListItem key={entry.id} divider disableGutters sx={{ display: 'block' }}><Box sx={{ display: 'flex', alignItems: 'center' }}><ListItemText primary={entry.title} secondary={entry.artist} primaryTypographyProps={{ fontWeight: 700 }} sx={{ minWidth: 0, flex: 1 }} /><Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}><ListReactionButton kind="CHEER" songTitle={entry.title} reactionCount={entry.reactionCount} viewerHasReacted={entry.viewerHasReacted} disabled={reactions.isPending('singing-list', entry.id)} onToggle={() => reactions.toggleReaction('singing-list', entry.id, entry.viewerHasReacted)} /><Chip label={statusLabels[entry.status]} size="small" variant="outlined" /></Stack></Box></ListItem>)}</List>}</Paper>}
          </Stack>}
    </Container></Box>
  </>;
}
