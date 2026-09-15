import { Box, Tab, Tabs, Typography } from '@mui/material';
import type { Ranking } from '../api';

type Props = {
  rankings: Ranking[];
  slug: string;
  onSelect: (slug: string) => void;
};

export function RankingCatalogNav({ rankings, slug, onSelect }: Props) {
  const tabsSx = {
    minHeight: 42,
    '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0', bgcolor: 'secondary.main' },
    '& .MuiTab-root': { minHeight: 42, minWidth: 0, px: { xs: 1.25, sm: 2 }, textTransform: 'none', fontWeight: 800, color: 'text.secondary' },
    '& .Mui-selected': { color: 'text.primary' },
    '& .Mui-disabled': { opacity: 0.38 }
  };

  return <Box component="nav" aria-label="Ranking catalog" sx={{ borderBottom: 1, borderColor: 'divider' }}>
    <Typography variant="subtitle2" fontWeight={800} sx={{ px: 0.5, mb: 0.25 }}>Explore rankings</Typography>
    <Tabs value={rankings.some((ranking) => ranking.slug === slug) ? slug : false} onChange={(_event, value: string) => onSelect(value)} aria-label="Rankings" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={tabsSx}>
      {rankings.map((ranking) => <Tab key={ranking.id} value={ranking.slug} label={ranking.title} />)}
    </Tabs>
  </Box>;
}
