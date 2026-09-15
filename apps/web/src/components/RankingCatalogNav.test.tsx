import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, expect, it, vi } from 'vitest';
import type { Ranking } from '../api';
import { theme } from '../theme';
import { RankingCatalogNav } from './RankingCatalogNav';

afterEach(cleanup);

const rankings: Ranking[] = [
  { id: '1', title: '80s HK/TW', slug: '80s-hk-tw', era: '1980s', decadeStart: 1980, decade: '80s', region: 'hk-tw', displayOrder: 1, sourceType: 'MEDIA', description: null, hasSource: true },
  { id: '2', title: '80s Mainland', slug: '80s-mainland', era: '1980s', decadeStart: 1980, decade: '80s', region: 'mainland', displayOrder: 2, sourceType: 'MEDIA', description: null, hasSource: true },
  { id: '3', title: '90s HK/TW', slug: '90s-hk-tw', era: '1990s', decadeStart: 1990, decade: '90s', region: 'hk-tw', displayOrder: 3, sourceType: 'MEDIA', description: null, hasSource: true },
  { id: '4', title: 'Cantonese Classics', slug: 'cantonese-classics', era: null, decadeStart: null, decade: null, region: null, displayOrder: 4, sourceType: 'MEDIA', description: null, hasSource: true }
];

it('selects a ranking directly by stable slug', () => {
  const onSelect = vi.fn();
  render(<ThemeProvider theme={theme}><RankingCatalogNav rankings={rankings} slug="90s-hk-tw" onSelect={onSelect} /></ThemeProvider>);
  fireEvent.click(screen.getByRole('tab', { name: 'Cantonese Classics' }));
  expect(onSelect).toHaveBeenCalledWith('cantonese-classics');
});

it('renders metadata-free rankings without disabled combinations', () => {
  render(<ThemeProvider theme={theme}><RankingCatalogNav rankings={rankings} slug="cantonese-classics" onSelect={() => undefined} /></ThemeProvider>);
  expect(screen.getByRole('tab', { name: 'Cantonese Classics' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getAllByRole('tab')).toHaveLength(4);
});
