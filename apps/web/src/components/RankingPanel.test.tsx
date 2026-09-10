import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, expect, it, vi } from 'vitest';
import { RankingPanel } from './RankingPanel';
import { theme } from '../theme';

afterEach(cleanup);

it('shows the filtered result count and an explicit demo label', () => {
  render(<ThemeProvider theme={theme}><RankingPanel isLoading={false} query="涛声" onQueryChange={() => undefined} artistFilter="ALL" onArtistFilterChange={() => undefined} releaseYearFilter="ALL" onReleaseYearFilterChange={() => undefined} artists={['毛宁']} releaseYears={[1993]} topSongIds={new Set()} singingSongIds={new Set()} topAtCapacity={false} onAddTop={() => undefined} onAddSinging={() => undefined} ranking={{ id: 'ranking', title: '90s Mainland China Pop Songs', era: '1990s', sourceType: 'DEMO', description: 'Fictional demo fixtures.', sourceUrl: null, entries: [{ id: 'song', rank: 1, title: '涛声依旧', artist: '毛宁', releaseYear: 1993 }] }} /></ThemeProvider>);
  expect(screen.getByText('Demo Data')).toBeInTheDocument();
  expect(screen.getByText('1 result')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Top 10' })).toBeEnabled();
});

it('shows 25 ranking entries per page', () => {
  const entries = Array.from({ length: 26 }, (_, index) => ({ id: `song-${index + 1}`, rank: index + 1, title: `Song ${index + 1}`, artist: 'Demo Artist', releaseYear: 1993 }));
  render(<ThemeProvider theme={theme}><RankingPanel isLoading={false} query="" onQueryChange={() => undefined} artistFilter="ALL" onArtistFilterChange={() => undefined} releaseYearFilter="ALL" onReleaseYearFilterChange={() => undefined} artists={['Demo Artist']} releaseYears={[1993]} topSongIds={new Set()} singingSongIds={new Set()} topAtCapacity={false} onAddTop={() => undefined} onAddSinging={() => undefined} ranking={{ id: 'ranking', title: '90s Mainland China Pop Songs', era: '1990s', sourceType: 'DEMO', description: 'Fictional demo fixtures.', sourceUrl: null, entries }} /></ThemeProvider>);

  expect(screen.getByText('Song 25')).toBeInTheDocument();
  expect(screen.queryByText('Song 26')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
  expect(screen.getByText('Song 26')).toBeInTheDocument();
  expect(screen.getByText('26 results · Page 2 of 2')).toBeInTheDocument();
});

it('clears artist and release-year filters together', () => {
  const onArtistFilterChange = vi.fn();
  const onReleaseYearFilterChange = vi.fn();
  render(<ThemeProvider theme={theme}><RankingPanel isLoading={false} query="涛声" onQueryChange={() => undefined} artistFilter="毛宁" onArtistFilterChange={onArtistFilterChange} releaseYearFilter={1993} onReleaseYearFilterChange={onReleaseYearFilterChange} artists={['毛宁']} releaseYears={[1993]} topSongIds={new Set()} singingSongIds={new Set()} topAtCapacity={false} onAddTop={() => undefined} onAddSinging={() => undefined} ranking={{ id: 'ranking', title: '90s Mainland China Pop Songs', era: '1990s', sourceType: 'DEMO', description: 'Fictional demo fixtures.', sourceUrl: null, entries: [] }} /></ThemeProvider>);

  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(onArtistFilterChange).toHaveBeenCalledWith('ALL');
  expect(onReleaseYearFilterChange).toHaveBeenCalledWith('ALL');
});
