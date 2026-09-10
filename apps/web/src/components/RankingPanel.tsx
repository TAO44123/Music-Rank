import AddIcon from '@mui/icons-material/Add';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import MicNoneIcon from '@mui/icons-material/MicNone';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, Chip, CircularProgress, FormControl, InputAdornment, InputLabel, List, ListItem, ListItemText, MenuItem, Pagination, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { RankingDetail } from '../api';

const pageSize = 25;

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
  topSongIds: Set<string>;
  singingSongIds: Set<string>;
  topAtCapacity: boolean;
  onAddTop: (songId: string) => void;
  onAddSinging: (songId: string) => void;
};

export function RankingPanel({ ranking, isLoading, query, onQueryChange, artistFilter, onArtistFilterChange, releaseYearFilter, onReleaseYearFilterChange, artists, releaseYears, topSongIds, singingSongIds, topAtCapacity, onAddTop, onAddSinging }: Props) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil((ranking?.entries.length ?? 0) / pageSize));
  const visibleEntries = ranking?.entries.slice((page - 1) * pageSize, page * pageSize) ?? [];
  const handleQueryChange = (value: string) => {
    setPage(1);
    onQueryChange(value);
  };
  const handleArtistFilterChange = (value: string) => {
    setPage(1);
    onArtistFilterChange(value);
  };
  const handleReleaseYearFilterChange = (value: number | 'ALL') => {
    setPage(1);
    onReleaseYearFilterChange(value);
  };
  const handleClearFilters = () => {
    setPage(1);
    onArtistFilterChange('ALL');
    onReleaseYearFilterChange('ALL');
  };

  return <Paper component="section" sx={{ p: { xs: 2, sm: 3 }, minHeight: 560 }} aria-labelledby="ranking-heading">
    <Stack spacing={2.5}>
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="overline" color="secondary.main" fontWeight={800}>The ranking</Typography>
            <Typography id="ranking-heading" variant="h2" fontSize={{ xs: '1.55rem', sm: '1.9rem' }}>{ranking?.title ?? 'Loading ranking'}</Typography>
          </Box>
          <Chip label="Demo Data" color="secondary" variant="outlined" sx={{ fontWeight: 800 }} />
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>{ranking?.description ?? 'Fictional fixtures for exploring the app.'}</Typography>
      </Box>
      <TextField label="Search songs or artists" value={query} onChange={(event) => handleQueryChange(event.target.value)} fullWidth slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
      <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
        <FormControl size="small" sx={{ width: { xs: 170, sm: 210 } }}>
          <InputLabel id="artist-filter-label">Artist</InputLabel>
          <Select labelId="artist-filter-label" label="Artist" value={artistFilter} onChange={(event) => handleArtistFilterChange(event.target.value)}>
            <MenuItem value="ALL">All artists</MenuItem>
            {artists.map((artist) => <MenuItem key={artist} value={artist}>{artist}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ width: { xs: 145, sm: 165 } }}>
          <InputLabel id="release-year-filter-label">Release year</InputLabel>
          <Select labelId="release-year-filter-label" label="Release year" value={releaseYearFilter} onChange={(event) => handleReleaseYearFilterChange(event.target.value as number | 'ALL')}>
            <MenuItem value="ALL">All years</MenuItem>
            {releaseYears.map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="text" startIcon={<FilterAltOffIcon />} onClick={handleClearFilters} disabled={artistFilter === 'ALL' && releaseYearFilter === 'ALL'} sx={{ minWidth: 88, height: 40 }}>Clear</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" aria-live="polite">{ranking ? `${ranking.entries.length} ${ranking.entries.length === 1 ? 'result' : 'results'}${pageCount > 1 ? ` · Page ${page} of ${pageCount}` : ''}` : 'Loading results'}</Typography>
      {isLoading ? <Box textAlign="center" py={8}><CircularProgress aria-label="Loading ranking" /></Box> : ranking?.entries.length === 0 ? <Box py={8} textAlign="center"><Typography variant="h6">No songs found</Typography><Typography color="text.secondary">Try a different title or artist.</Typography></Box> : <List disablePadding aria-label="Ranked songs">
        {visibleEntries.map((entry) => {
          const inTop = topSongIds.has(entry.id);
          const inSinging = singingSongIds.has(entry.id);
          return <ListItem key={entry.id} divider alignItems="center" sx={{ px: 0, py: 1.4, gap: 1.5 }} secondaryAction={<Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems="stretch">
            <Button variant={inTop ? 'outlined' : 'contained'} disabled={inTop || (!inTop && topAtCapacity)} startIcon={<AddIcon />} onClick={() => onAddTop(entry.id)} sx={{ width: 144, justifyContent: 'center' }}>{inTop ? 'In Top 10' : 'Add Top 10'}</Button>
            <Button variant="outlined" disabled={inSinging} startIcon={<MicNoneIcon />} onClick={() => onAddSinging(entry.id)} sx={{ width: 164, justifyContent: 'center' }}>{inSinging ? 'In Singing List' : 'Add Singing'}</Button>
          </Stack>}>
            <Typography component="span" color="primary.main" fontWeight={800} sx={{ width: 34, fontSize: '1.1rem' }}>{entry.rank}</Typography>
            <ListItemText primary={entry.title} secondary={`${entry.artist}${entry.releaseYear ? ` · ${entry.releaseYear}` : ''}`} primaryTypographyProps={{ fontWeight: 700 }} sx={{ pr: { xs: 0, sm: 25 } }} />
          </ListItem>;
        })}
      </List>}
      {!isLoading && pageCount > 1 && <Stack alignItems="center" pt={1}><Pagination count={pageCount} page={page} onChange={(_event, value) => setPage(value)} color="primary" shape="rounded" aria-label="Ranking pagination" /></Stack>}
    </Stack>
  </Paper>;
}
