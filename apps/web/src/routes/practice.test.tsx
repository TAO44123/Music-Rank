import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

describe('/practice', () => {
  it('redirects anonymous visitors to the ranking and opens the sign-in dialog', async () => {
    const { client, router } = renderRoute({
      path: '/practice',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user: null });
        if (path === '/api/rankings') return jsonResponse([{ id: 'ranking-1', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false }]);
        if (path.startsWith('/api/rankings/90s-demo-ranking')) return jsonResponse({ id: 'ranking-1', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false, sourceUrl: null, songCount: 0, facets: { artists: [], releaseYears: [] }, entries: [] });
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('dialog', { name: 'Sign in to Music Rank' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/rankings/90s-demo-ranking');
  });

  it('renders the practice library for an authenticated visitor', async () => {
    const { client, router } = renderRoute({
      path: '/practice',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user });
        if (path === '/api/me/singing-list') return jsonResponse([]);
        if (path === '/api/me/list-settings') return jsonResponse({ topList: 'PRIVATE', singingList: 'PRIVATE' });
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'My Practice Library' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/practice');
  });

  it('adds a new unlisted song to Practice Library', async () => {
    let entries: unknown[] = [];
    const { client, router } = renderRoute({
      path: '/practice',
      fetch: (path, init) => {
        if (path === '/api/auth/session') return jsonResponse({ user });
        if (path === '/api/me/singing-list') return jsonResponse(entries);
        if (path === '/api/me/list-settings') return jsonResponse({ topList: 'PRIVATE', singingList: 'PRIVATE' });
        if (path === '/api/me/singing-list/items' && init?.method === 'POST') {
          entries = [{ id: 'submitted-song', title: 'New Practice Song', artist: 'New Artist', releaseYear: null, status: 'WANT_TO_LEARN', note: null }];
          return jsonResponse(entries, 201);
        }
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    await screen.findByRole('heading', { name: 'My Practice Library' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a song not listed' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a song not listed' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Song title' }), { target: { value: 'New Practice Song' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Artist' }), { target: { value: 'New Artist' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add song' }));
    expect(await screen.findByText('New Practice Song')).toBeVisible();
  });
});
