import { Box, Container, Tab, Tabs } from '@mui/material';
import { Link, useRouterState } from '@tanstack/react-router';
import { destinations } from '../navigation';
import { useAppShell } from '../shell/AppShellContext';

function Label({ short, full }: { short: string; full: string }) {
  return <>
    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{short}</Box>
    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{full}</Box>
  </>;
}

export function TabNav() {
  const { user } = useAppShell();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const visible = destinations.filter((destination) => !destination.personal || user);
  const rankingPath = '/';
  const current = pathname.startsWith('/rankings/') ? rankingPath : visible.some((destination) => destination.to === pathname) ? pathname : rankingPath;

  return <Box component="nav" aria-label="Primary" sx={{ display: { xs: 'none', sm: 'block' }, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
    <Container maxWidth="xl">
      <Tabs
        value={current}
        variant="fullWidth"
        textColor="primary"
        indicatorColor="primary"
        sx={{
          minHeight: 52,
          '& .MuiTabs-flexContainer': { justifyContent: { sm: 'flex-start' } },
          '& .MuiTab-root': { minHeight: 52, textTransform: 'none', fontWeight: 700, flex: { sm: '0 0 auto' }, px: { sm: 2.5 } }
        }}
      >
        {visible.map((destination) => <Tab key={destination.to} value={destination.to} component={Link} to={destination.to} label={<Label short={destination.short} full={destination.full} />} />)}
      </Tabs>
    </Container>
  </Box>;
}
