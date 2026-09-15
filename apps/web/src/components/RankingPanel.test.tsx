import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { RankingDetail } from '../api';
import { theme } from '../theme';
import { RankingPanel } from './RankingPanel';

afterEach(cleanup);

const baseRanking: RankingDetail = {
  id: 'ranking',
  title: '90s Demo Ranking',
  slug: '90s-demo-ranking',
  era: '1990s',
  decadeStart: 1990,
  decade: '90s',
  region: 'mainland',
  displayOrder: 4,
  sourceType: 'DEMO',
  description: 'Fictional demo fixtures.',
  hasSource: false,
  sourceUrl: null,
  songCount: 1,
  facets: { artists: ['毛宁'], releaseYears: [1993] },
  entries: [{ id: 'song', rank: 1, title: '涛声依旧', artist: '毛宁', releaseYear: 1993 }]
};

const commonProps = {
  isLoading: false,
  query: '涛声',
  onQueryChange: () => undefined,
  artistFilter: 'ALL',
  onArtistFilterChange: () => undefined,
  releaseYearFilter: 'ALL' as const,
  onReleaseYearFilterChange: () => undefined,
  artists: ['毛宁'],
  releaseYears: [1993],
  page: 1,
  onPageChange: () => undefined,
  topSongIds: new Set<string>(),
  singingSongIds: new Set<string>(),
  topAtCapacity: false,
  onAddTop: () => undefined,
  onAddSinging: () => undefined
};

it('shows the filtered result count and a source-derived demo label', () => {
  render(<ThemeProvider theme={theme}><RankingPanel {...commonProps} ranking={baseRanking} /></ThemeProvider>);
  expect(screen.getByText('Demo Data')).toBeInTheDocument();
  expect(screen.getByText('1 song')).toBeInTheDocument();
  expect(screen.getByText('1 result')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Top 10' })).toBeEnabled();
});

it('renders rankings without decade or region metadata', () => {
  const ranking = { ...baseRanking, era: null, decadeStart: null, decade: null, region: null };
  render(<ThemeProvider theme={theme}><RankingPanel {...commonProps} ranking={ranking} /></ThemeProvider>);
  expect(screen.getByText('The ranking')).toBeInTheDocument();
  expect(screen.queryByText('90s')).not.toBeInTheDocument();
  expect(screen.queryByText('Mainland China')).not.toBeInTheDocument();
});

it('shows a safe external link when a ranking has a source URL', () => {
  const ranking = { ...baseRanking, sourceType: 'MEDIA', hasSource: true, sourceUrl: 'https://www.youtube.com/watch?v=source' };
  render(<ThemeProvider theme={theme}><RankingPanel {...commonProps} ranking={ranking} /></ThemeProvider>);
  expect(screen.getByRole('link', { name: 'Watch original video' })).toHaveAttribute('href', ranking.sourceUrl);
  expect(screen.getByRole('link', { name: 'Watch original video' })).toHaveAttribute('rel', 'noopener noreferrer');
});

it('does not render a non-HTTP source URL', () => {
  const ranking = { ...baseRanking, sourceType: 'MEDIA', hasSource: true, sourceUrl: 'javascript:alert(1)' };
  render(<ThemeProvider theme={theme}><RankingPanel {...commonProps} ranking={ranking} /></ThemeProvider>);
  expect(screen.queryByRole('link', { name: 'Watch original video' })).not.toBeInTheDocument();
});

it('shows 25 ranking entries per URL-controlled page', () => {
  const entries = Array.from({ length: 26 }, (_, index) => ({ id: `song-${index + 1}`, rank: index + 1, title: `Song ${index + 1}`, artist: 'Demo Artist', releaseYear: 1993 }));
  const ranking = { ...baseRanking, songCount: 26, facets: { artists: ['Demo Artist'], releaseYears: [1993] }, entries };
  function Harness() {
    const [page, setPage] = useState(1);
    return <RankingPanel {...commonProps} ranking={ranking} page={page} onPageChange={setPage} />;
  }
  render(<ThemeProvider theme={theme}><Harness /></ThemeProvider>);

  expect(screen.getByText('Song 25')).toBeInTheDocument();
  expect(screen.queryByText('Song 26')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
  expect(screen.getByText('Song 26')).toBeInTheDocument();
  expect(screen.getByText('26 results · Page 2 of 2')).toBeInTheDocument();
});

it('clears artist and release-year filters together', () => {
  const onArtistFilterChange = vi.fn();
  const onReleaseYearFilterChange = vi.fn();
  render(<ThemeProvider theme={theme}><RankingPanel {...commonProps} ranking={{ ...baseRanking, entries: [] }} artistFilter="毛宁" onArtistFilterChange={onArtistFilterChange} releaseYearFilter={1993} onReleaseYearFilterChange={onReleaseYearFilterChange} /></ThemeProvider>);

  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(onArtistFilterChange).toHaveBeenCalledWith('ALL');
  expect(onReleaseYearFilterChange).toHaveBeenCalledWith('ALL');
});
