import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Ranking, RankingDecade, RankingRegion } from '../api';
import { renderRoute } from '../test/renderRoute';
import { theme } from '../theme';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

const user = { id: 'user-1', username: 'listener_1', displayName: 'Listener One' };
const catalog: Ranking[] = [
  { id: 'ranking-1', title: '80s Hong Kong/Taiwan', slug: '80s-hk-tw', era: '1980s', decadeStart: 1980, decade: '80s', region: 'hk-tw', displayOrder: 1, sourceType: 'MEDIA', description: null, hasSource: true },
  { id: 'ranking-2', title: '80s Mainland China', slug: '80s-mainland', era: '1980s', decadeStart: 1980, decade: '80s', region: 'mainland', displayOrder: 2, sourceType: 'MEDIA', description: null, hasSource: true },
  { id: 'ranking-3', title: '90s Hong Kong/Taiwan', slug: '90s-hk-tw', era: '1990s', decadeStart: 1990, decade: '90s', region: 'hk-tw', displayOrder: 3, sourceType: 'MEDIA', description: null, hasSource: true },
  { id: 'ranking-4', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false }
];

function rankingDetail(decade: RankingDecade, region: RankingRegion) {
  const ranking = catalog.find((candidate) => candidate.decade === decade && candidate.region === region)!;
  const entries = Array.from({ length: 26 }, (_, index) => ({ id: `song-${index + 1}`, rank: index + 1, title: `Song ${index + 1}`, artist: '毛宁', releaseYear: 1993 }));
  return { ...ranking, sourceUrl: ranking.hasSource ? 'https://www.youtube.com/watch?v=source' : null, songCount: entries.length, facets: { artists: ['毛宁'], releaseYears: [1993] }, entries };
}

function rankingResponse(path: string, sessionUser: typeof user | null) {
  if (path === '/api/auth/session') return jsonResponse({ user: sessionUser });
  if (path === '/api/rankings') return jsonResponse(catalog);
  if (path === '/api/me/top-list' || path === '/api/me/singing-list') return jsonResponse([]);
  if (path === '/api/me/list-settings') return jsonResponse({ topList: 'PRIVATE', singingList: 'PRIVATE' });
  const match = /^\/api\/rankings\/(80s|90s)\/(hk-tw|mainland)(?:\?|$)/.exec(path);
  if (match) return jsonResponse(rankingDetail(match[1] as RankingDecade, match[2] as RankingRegion));
  throw new Error(`Unexpected request: ${path}`);
}

const rankingFetch = (path: string, _init?: RequestInit) => rankingResponse(path, user);

describe('ranking routes', () => {
  it('redirects the root path to the default ranking', async () => {
    const { client, router } = renderRoute({ path: '/', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: '90s Demo Ranking' }, { timeout: 5_000 })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'My Top 10' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'My Practice Library' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/rankings/90s/mainland');
  });

  it('issues no personal request for an anonymous visitor', async () => {
    const { client, router, fetchMock } = renderRoute({ path: '/rankings/90s/mainland', fetch: (path) => rankingResponse(path, null) });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: '90s Demo Ranking' })).toBeVisible();
    expect(fetchMock.mock.calls.map(([path]) => String(path)).some((path) => path.startsWith('/api/me/'))).toBe(false);
  });

  it('applies filters and pagination from the URL on load', async () => {
    const { client, router } = renderRoute({ path: '/rankings/90s/mainland?q=%E9%82%A3%E8%8B%B1&year=1993&page=2', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByLabelText('Search songs or artists')).toHaveValue('那英');
    await waitFor(() => expect(router.state.location.search).toEqual({ q: '那英', year: 1993, page: 2 }));
  });

  it('writes filter changes into the URL without stacking history entries', async () => {
    const { client, router } = renderRoute({ path: '/rankings/90s/mainland', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    const field = await screen.findByLabelText('Search songs or artists');
    const lengthBefore = router.history.length;
    fireEvent.change(field, { target: { value: '涛声' } });
    await waitFor(() => expect(router.state.location.search).toEqual({ q: '涛声' }));
    expect(router.history.length).toBe(lengthBefore);
  });

  it('navigates by decade and region with stable paths', async () => {
    const { client, router } = renderRoute({ path: '/rankings/90s/mainland?q=%E6%B6%9B%E5%A3%B0&artist=%E6%AF%9B%E5%AE%81&year=1993&page=2', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    await screen.findByRole('heading', { name: '90s Demo Ranking' });
    fireEvent.click(screen.getByRole('tab', { name: '80s' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/rankings/80s/mainland'));
    expect(router.state.location.search).toEqual({ q: '涛声' });
    expect(await screen.findByRole('heading', { name: '80s Mainland China' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Hong Kong/Taiwan' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/rankings/80s/hk-tw'));
  });

  it('degrades an invalid year and page while keeping a valid text filter', async () => {
    const { client, router } = renderRoute({ path: '/rankings/90s/mainland?q=%E9%82%A3%E8%8B%B1&year=banana&page=zero', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByLabelText('Search songs or artists')).toHaveValue('那英');
    expect(router.state.location.search).toEqual({ q: '那英' });
  });

  it('shows a clear unavailable state for an unpublished combination', async () => {
    const { client, router } = renderRoute({
      path: '/rankings/80s/hk-tw',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user: null });
        if (path === '/api/rankings') return jsonResponse([catalog[3]]);
        if (path.startsWith('/api/rankings/80s/hk-tw')) return jsonResponse({ code: 'RANKING_NOT_FOUND', message: 'Ranking not found' }, 404);
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByText('Ranking not available.')).toBeVisible();
  });
});
