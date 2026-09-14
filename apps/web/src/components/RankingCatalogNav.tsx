import { rankingDecades, rankingRegions } from '@music-rank/contracts';
import { Box, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
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

  return <Paper component="nav" aria-label="Ranking catalog" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
      <Box>
        <Typography variant="overline" color="text.secondary" fontWeight={800}>Decade</Typography>
        <ToggleButtonGroup exclusive size="small" value={decade} onChange={(_event, value: RankingDecade | null) => selectDecade(value)} aria-label="Ranking decade">
          {rankingDecades.map((candidate) => <ToggleButton key={candidate} value={candidate} disabled={!rankings.some((ranking) => ranking.decade === candidate)}>{candidate}</ToggleButton>)}
        </ToggleButtonGroup>
      </Box>
      <Box>
        <Typography variant="overline" color="text.secondary" fontWeight={800}>Region</Typography>
        <ToggleButtonGroup exclusive size="small" value={region} onChange={(_event, value: RankingRegion | null) => selectRegion(value)} aria-label="Ranking region">
          {regions.map((candidate) => <ToggleButton key={candidate.value} value={candidate.value} disabled={!available(decade, candidate.value)}>{candidate.label}</ToggleButton>)}
        </ToggleButtonGroup>
      </Box>
    </Stack>
  </Paper>;
}
