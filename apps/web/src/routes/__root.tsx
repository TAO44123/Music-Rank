import { Alert, Box, Button, CssBaseline, Stack, Typography } from '@mui/material';
import type { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router';
import { AppShellProvider } from '../shell/AppShellContext';

export interface RouterContext { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound
});

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPublicProfile = pathname.startsWith('/u/');
  return <><CssBaseline /><AppShellProvider chrome={!isPublicProfile}><Outlet /></AppShellProvider></>;
}

function NotFound() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <Box component="main" sx={{ py: 10, textAlign: 'center' }}>
    <Typography variant="h1" fontSize="2rem">Page not found</Typography>
    <Alert severity="info" sx={{ my: 3, justifyContent: 'center' }}>No page exists at {pathname}.</Alert>
    <Stack alignItems="center"><Button variant="contained" href="/">Back to the ranking</Button></Stack>
  </Box>;
}
