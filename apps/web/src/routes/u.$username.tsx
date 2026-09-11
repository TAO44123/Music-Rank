import { Alert, Box, Button, Chip, CircularProgress, Container, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { Brand } from '../components/Brand';
import { publicProfileQueryOptions, publicSingingListQueryOptions, publicTopListQueryOptions } from '../queries';
import { statusLabels } from '../status';
import { Route as rootRoute } from './__root';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/u/$username', component: PublicProfilePage });

function PublicProfilePage() {
  const { username } = Route.useParams();
  const profileQuery = useQuery(publicProfileQueryOptions(username));
  const profile = profileQuery.data;
  const topQuery = useQuery(publicTopListQueryOptions(username, profile?.lists.topList === 'PUBLIC'));
  const singingQuery = useQuery(publicSingingListQueryOptions(username, profile?.lists.singingList === 'PUBLIC'));

  return <><Brand action={<Button href="/" variant="outlined">Back to ranking</Button>} />
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
