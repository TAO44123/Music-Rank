import { rankingDecades, rankingRegions } from '@music-rank/contracts';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import type { Ranking, RankingDecade, RankingRegion } from '../api';

const regionLabels: Record<RankingRegion, string> = { 'hk-tw': 'Hong Kong/Taiwan', mainland: 'Mainland China' };
const regions = rankingRegions.map((value) => ({ value, label: regionLabels[value] }));

type Props = {
  rankings: Ranking[];
  decade: RankingDecade;
  region: RankingRegion;
  onSelect: (decade: RankingDecade, region: RankingRegion) => void;
};

export function RankingCatalogNav({ rankings, decade, region, onSelect }: Props) {
  const available = (candidateDecade: RankingDecade, candidateRegion: RankingRegion) =>
    rankings.some((ranking) => ranking.decade === candidateDecade && ranking.region === candidateRegion);
  const selectDecade = (nextDecade: RankingDecade | null) => {
    if (!nextDecade || nextDecade === decade) return;
    const nextRegion = available(nextDecade, region)
      ? region
      : regions.find((candidate) => available(nextDecade, candidate.value))?.value;
    if (nextRegion) onSelect(nextDecade, nextRegion);
  };
  const selectRegion = (nextRegion: RankingRegion | null) => {
    if (nextRegion && nextRegion !== region && available(decade, nextRegion)) onSelect(decade, nextRegion);
  };

  const tabsSx = {
    minHeight: 42,
    '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0', bgcolor: 'secondary.main' },
    '& .MuiTab-root': { minHeight: 42, minWidth: 0, px: { xs: 1.25, sm: 2 }, textTransform: 'none', fontWeight: 800, color: 'text.secondary' },
    '& .Mui-selected': { color: 'text.primary' },
    '& .Mui-disabled': { opacity: 0.38 }
  };

  return <Box component="nav" aria-label="Ranking catalog" sx={{ borderBottom: 1, borderColor: 'divider' }}>
    <Typography variant="subtitle2" fontWeight={800} sx={{ px: 0.5, mb: 0.25 }}>Explore rankings</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 1.5 }} alignItems={{ sm: 'flex-end' }}>
      <Tabs value={decade} onChange={(_event, value: RankingDecade) => selectDecade(value)} aria-label="Ranking decade" sx={tabsSx}>
        {rankingDecades.map((candidate) => <Tab key={candidate} value={candidate} label={candidate} disabled={!rankings.some((ranking) => ranking.decade === candidate)} />)}
      </Tabs>
      <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '1px', height: 26, bgcolor: 'divider', mb: 1 }} />
      <Tabs value={region} onChange={(_event, value: RankingRegion) => selectRegion(value)} aria-label="Ranking region" variant="scrollable" scrollButtons={false} sx={tabsSx}>
        {regions.map((candidate) => <Tab key={candidate.value} value={candidate.value} label={candidate.label} disabled={!available(decade, candidate.value)} />)}
      </Tabs>
    </Stack>
  </Box>;
}
