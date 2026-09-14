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
  { id: '4', title: '90s Mainland', slug: '90s-mainland', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'MEDIA', description: null, hasSource: true }
];

it('selects another decade while preserving an available region', () => {
  const onSelect = vi.fn();
  render(<ThemeProvider theme={theme}><RankingCatalogNav rankings={rankings} decade="90s" region="mainland" onSelect={onSelect} /></ThemeProvider>);
  fireEvent.click(screen.getByRole('tab', { name: '80s' }));
  expect(onSelect).toHaveBeenCalledWith('80s', 'mainland');
});

it('disables unavailable catalog combinations', () => {
  render(<ThemeProvider theme={theme}><RankingCatalogNav rankings={[rankings[3]]} decade="90s" region="mainland" onSelect={() => undefined} /></ThemeProvider>);
  expect(screen.getByRole('tab', { name: '80s' })).toBeDisabled();
  expect(screen.getByRole('tab', { name: 'Hong Kong/Taiwan' })).toBeDisabled();
});
