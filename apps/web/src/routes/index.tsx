import { Alert, Box, Container } from '@mui/material';
import { createRoute, redirect } from '@tanstack/react-router';
import { rankingsQueryOptions } from '../queries';
import { Route as rootRoute } from './__root';
import { rankingSearchSchema } from './rankingSearch';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: rankingSearchSchema,
  beforeLoad: async ({ context, search }) => {
    const [ranking] = await context.queryClient.ensureQueryData(rankingsQueryOptions());
    if (!ranking) return;
    throw redirect({
      to: '/rankings/$slug',
      params: { slug: ranking.slug },
      search
    });
  },
  component: () => <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl"><Alert severity="info">No published rankings are available yet.</Alert></Container></Box>
});
