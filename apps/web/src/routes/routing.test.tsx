import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../test/renderRoute';
import { theme } from '../theme';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('client routing', () => {
  it('renders the ranking at the root path', async () => {
    const { client, router } = renderRoute({
      path: '/',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user: null });
        if (path === '/api/rankings') return jsonResponse([{ id: 'ranking-1', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false }]);
        if (path.startsWith('/api/rankings/90s-demo-ranking')) return jsonResponse({ id: 'ranking-1', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false, sourceUrl: null, songCount: 0, facets: { artists: [], releaseYears: [] }, entries: [] });
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'Music Rank' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/rankings/90s-demo-ranking');
  });

  it('renders the public profile at /u/:username', async () => {
    const { client, router } = renderRoute({
      path: '/u/listener_1',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user: null });
        if (path === '/api/users/listener_1') return jsonResponse({ username: 'listener_1', displayName: 'Listener One', lists: { topList: 'PUBLIC', singingList: 'PRIVATE' } });
        if (path === '/api/users/listener_1/top-list') return jsonResponse([{ id: 'song-1', title: '涛声依旧', artist: '毛宁', releaseYear: 1993, position: 1, reactionCount: 0, viewerHasReacted: false }]);
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'Listener One' })).toBeVisible();
    expect(await screen.findByRole('region', { name: 'Top 10' })).toHaveTextContent('涛声依旧');
    expect(screen.queryByRole('region', { name: 'Practice Library' })).not.toBeInTheDocument();
  });

  it('renders a not-found page for an unknown path', async () => {
    const { client, router } = renderRoute({
      path: '/nope',
      fetch: (path) => {
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
