import { AppBar, Box, Container, Stack, Toolbar, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function Brand({ action }: { action?: ReactNode }) {
  return <AppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
    <Container maxWidth="xl"><Toolbar disableGutters sx={{ minHeight: { xs: 56, sm: 66 } }}><Stack direction="row" justifyContent="space-between" alignItems="center" width="100%" gap={2}>
      <Box component="a" href="/" sx={{ color: 'inherit', textDecoration: 'none', minWidth: 0 }}><Typography variant="h1" fontSize={{ xs: '1.25rem', sm: '1.45rem' }}>Music Rank</Typography><Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Build a personal map of the songs you keep returning to.</Typography></Box>
      {action}
    </Stack></Toolbar></Container>
  </AppBar>;
}
