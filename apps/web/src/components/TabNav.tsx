import { Box, Container, Tab, Tabs } from '@mui/material';
import { Link, useRouterState } from '@tanstack/react-router';
import { useAppShell } from '../shell/AppShellContext';

const tabs = [
  { to: '/', short: 'Ranking', full: 'The Ranking', personal: false },
  { to: '/personal', short: 'Personal', full: 'Personal Ranking', personal: true },
  { to: '/practice', short: 'Practice', full: 'Practice Library', personal: true }
] as const;

function Label({ short, full }: { short: string; full: string }) {
  return <>
    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{short}</Box>
    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{full}</Box>
  </>;
}

export function TabNav() {
  const { user } = useAppShell();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const visible = tabs.filter((tab) => !tab.personal || user);
  const rankingPath = '/';
  const current = pathname.startsWith('/rankings/') ? rankingPath : visible.some((tab) => tab.to === pathname) ? pathname : rankingPath;

  return <Box component="nav" aria-label="Primary" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
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
        {visible.map((tab) => <Tab key={tab.to} value={tab.to} component={Link} to={tab.to} label={<Label short={tab.short} full={tab.full} />} />)}
      </Tabs>
    </Container>
  </Box>;
}
