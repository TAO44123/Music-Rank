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

const user = { id: 'user-1', username: 'listener_1', displayName: 'Listener One' };

describe('/personal', () => {
  it('redirects anonymous visitors to the ranking and opens the sign-in dialog', async () => {
    const { client, router } = renderRoute({
      path: '/personal',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user: null });
        if (path === '/api/rankings') return jsonResponse([{ id: 'ranking-1', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false }]);
        if (path.startsWith('/api/rankings/90s/mainland')) return jsonResponse({ id: 'ranking-1', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false, sourceUrl: null, songCount: 0, facets: { artists: [], releaseYears: [] }, entries: [] });
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('dialog', { name: 'Sign in to Music Rank' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/rankings/90s/mainland');
  });

  it('renders the top list for an authenticated visitor', async () => {
    const { client, router } = renderRoute({
      path: '/personal',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user });
        if (path === '/api/me/top-list') return jsonResponse([]);
        if (path === '/api/me/list-settings') return jsonResponse({ topList: 'PRIVATE', singingList: 'PRIVATE' });
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'My Top 10' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/personal');
  });
});
