import AddIcon from '@mui/icons-material/Add';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import MicNoneIcon from '@mui/icons-material/MicNone';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, Chip, CircularProgress, FormControl, InputAdornment, InputLabel, List, ListItem, ListItemText, MenuItem, Pagination, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import type { RankingDetail } from '../api';

const pageSize = 25;

// The rank column plus the row gap, so stacked actions align under the title
// rather than under the rank number.
const textColumnOffset = '46px';

// Same short/long pattern as TabNav: the hidden span is dropped from the
// accessible name, so each width exposes exactly one label.
function ActionLabel({ short, full }: { short: string; full: string }) {
  return <>
    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{short}</Box>
    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{full}</Box>
  </>;
}

type Props = {
  ranking?: RankingDetail;
  isLoading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  artistFilter: string;
  onArtistFilterChange: (value: string) => void;
  releaseYearFilter: number | 'ALL';
  onReleaseYearFilterChange: (value: number | 'ALL') => void;
  artists: string[];
  releaseYears: number[];
  page: number;
  onPageChange: (value: number) => void;
  topSongIds: Set<string>;
  singingSongIds: Set<string>;
  topAtCapacity: boolean;
  onAddTop: (songId: string) => void;
  onAddSinging: (songId: string) => void;
};

const sourceLabels: Record<string, string> = {
  DEMO: 'Demo Data',
  OFFICIAL: 'Official Source',
  MEDIA: 'Media Source',
  COMMUNITY: 'Community Source'
};

const softFilterFieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#F3EADB',
    '& fieldset': { borderColor: 'transparent' },
    '&:hover fieldset': { borderColor: 'divider' },
    '&.Mui-focused fieldset': { borderColor: 'primary.main' }
  }
};

function safeSourceUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function RankingPanel({ ranking, isLoading, query, onQueryChange, artistFilter, onArtistFilterChange, releaseYearFilter, onReleaseYearFilterChange, artists, releaseYears, page, onPageChange, topSongIds, singingSongIds, topAtCapacity, onAddTop, onAddSinging }: Props) {
  const sourceUrl = safeSourceUrl(ranking?.sourceUrl);
  const regionLabel = ranking?.region === 'hk-tw' ? 'Hong Kong/Taiwan' : ranking?.region === 'mainland' ? 'Mainland China' : null;
  const metadataLabels = ranking ? [ranking.decade ?? ranking.era, regionLabel].filter((value): value is string => Boolean(value)) : [];
  const pageCount = Math.max(1, Math.ceil((ranking?.entries.length ?? 0) / pageSize));
  const visibleEntries = ranking?.entries.slice((page - 1) * pageSize, page * pageSize) ?? [];
  const handleQueryChange = (value: string) => {
    onQueryChange(value);
  };
  const handleArtistFilterChange = (value: string) => {
    onArtistFilterChange(value);
  };
  const handleReleaseYearFilterChange = (value: number | 'ALL') => {
    onReleaseYearFilterChange(value);
  };
  const handleClearFilters = () => {
    onArtistFilterChange('ALL');
    onReleaseYearFilterChange('ALL');
  };

  return <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minHeight: 560 }} aria-labelledby="ranking-heading">
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2}>
        <Box>
          {metadataLabels.length > 0
            ? <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>{metadataLabels.map((label) => <Chip key={label} size="small" label={label} variant="outlined" color="secondary" sx={{ fontWeight: 800 }} />)}</Stack>
            : <Typography variant="overline" color="secondary.main" fontWeight={800}>The ranking</Typography>}
          <Typography id="ranking-heading" variant="h2" fontSize={{ xs: '1.75rem', sm: '2.15rem' }}>{ranking?.title ?? 'Loading ranking'}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>{ranking?.description ?? 'Browse songs from this ranking.'}</Typography>
        </Box>
        {ranking && <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary" fontWeight={700}>{ranking.songCount} {ranking.songCount === 1 ? 'song' : 'songs'}</Typography>
          <Chip label={sourceLabels[ranking.sourceType] ?? 'Ranking Source'} color={ranking.sourceType === 'DEMO' ? 'secondary' : 'primary'} variant="outlined" sx={{ fontWeight: 800 }} />
          {sourceUrl && <Button component="a" href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label="Watch original video" variant="outlined" endIcon={<OpenInNewIcon />}>Watch source</Button>}
        </Stack>}
      </Stack>
      <Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }}>
          <TextField size="small" label="Search songs or artists" value={query} onChange={(event) => handleQueryChange(event.target.value)} fullWidth sx={{ flex: 1, ...softFilterFieldSx }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon color="secondary" /></InputAdornment> } }} />
          <FormControl size="small" sx={{ width: { xs: '100%', md: 210 }, flexShrink: 0, ...softFilterFieldSx }}>
            <InputLabel id="artist-filter-label">Artist</InputLabel>
            <Select labelId="artist-filter-label" label="Artist" value={artistFilter} onChange={(event) => handleArtistFilterChange(event.target.value)}>
              <MenuItem value="ALL">All artists</MenuItem>
              {artists.map((artist) => <MenuItem key={artist} value={artist}>{artist}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ width: { xs: '100%', md: 165 }, flexShrink: 0, ...softFilterFieldSx }}>
            <InputLabel id="release-year-filter-label">Release year</InputLabel>
            <Select labelId="release-year-filter-label" label="Release year" value={releaseYearFilter} onChange={(event) => handleReleaseYearFilterChange(event.target.value as number | 'ALL')}>
              <MenuItem value="ALL">All years</MenuItem>
              {releaseYears.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="text" startIcon={<FilterAltOffIcon />} onClick={handleClearFilters} disabled={artistFilter === 'ALL' && releaseYearFilter === 'ALL'} sx={{ minWidth: 88, height: 40, alignSelf: { xs: 'flex-start', md: 'center' } }}>Clear</Button>
        </Stack>
      </Box>
      <Typography variant="body2" color="text.secondary" aria-live="polite">{ranking ? `${ranking.entries.length} ${ranking.entries.length === 1 ? 'result' : 'results'}${pageCount > 1 ? ` · Page ${page} of ${pageCount}` : ''}` : 'Loading results'}</Typography>
      {isLoading ? <Box textAlign="center" py={8}><CircularProgress aria-label="Loading ranking" /></Box> : ranking?.entries.length === 0 ? <Box py={8} textAlign="center"><Typography variant="h6">No songs found</Typography><Typography color="text.secondary">Try a different title or artist.</Typography></Box> : <List disablePadding aria-label="Ranked songs">
        {visibleEntries.map((entry) => {
          const inTop = topSongIds.has(entry.id);
          const inSinging = singingSongIds.has(entry.id);
          // The actions deliberately sit in the normal flow instead of MUI's
          // `secondaryAction` slot. That slot is absolutely positioned, so it
          // reserves no space and the row text renders underneath it.
          return <ListItem key={entry.id} divider disableGutters sx={{ display: 'block', px: 0, py: 1.4 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                <Typography component="span" color="primary.main" fontWeight={800} sx={{ width: 34, flexShrink: 0, fontSize: '1.1rem' }}>{entry.rank}</Typography>
                <ListItemText primary={entry.title} secondary={`${entry.artist}${entry.releaseYear ? ` · ${entry.releaseYear}` : ''}`} primaryTypographyProps={{ fontWeight: 700 }} sx={{ my: 0, minWidth: 0 }} />
              </Box>
              <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, pl: { xs: textColumnOffset, sm: 0 } }}>
                <Button variant={inTop ? 'outlined' : 'contained'} disabled={inTop || (!inTop && topAtCapacity)} startIcon={<AddIcon />} onClick={() => onAddTop(entry.id)} sx={{ flex: { xs: 1, sm: '0 0 auto' }, width: { sm: 144 }, justifyContent: 'center' }}>{inTop ? 'In Top 10' : 'Add Top 10'}</Button>
                <Button variant="outlined" disabled={inSinging} startIcon={<MicNoneIcon />} onClick={() => onAddSinging(entry.id)} sx={{ flex: { xs: 1, sm: '0 0 auto' }, width: { sm: 164 }, justifyContent: 'center' }}>{inSinging ? <ActionLabel short="In Library" full="In Practice Library" /> : <ActionLabel short="Practice" full="Add Practice" />}</Button>
              </Stack>
            </Box>
          </ListItem>;
        })}
      </List>}
      {!isLoading && pageCount > 1 && <Stack alignItems="center" pt={1}><Pagination count={pageCount} page={page} onChange={(_event, value) => onPageChange(value)} color="primary" shape="rounded" aria-label="Ranking pagination" /></Stack>}
    </Stack>
  </Paper>;
}
