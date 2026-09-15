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

describe('/personal', () => {
  it('redirects anonymous visitors to the ranking and opens the sign-in dialog', async () => {
    const { client, router } = renderRoute({
      path: '/personal',
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
    const prompt = screen.getByRole('button', { name: 'Can’t find a song? Add it here' });
    const visibility = screen.getByLabelText('Top 10 visibility: private');
    expect(prompt.compareDocumentPosition(visibility) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(router.state.location.pathname).toBe('/personal');
  });

  it('confirms a duplicate unlisted song before adding the existing shared song', async () => {
    let topEntries: unknown[] = [];
    let postCount = 0;
    const { client, router } = renderRoute({
      path: '/personal',
      fetch: (path, init) => {
        if (path === '/api/auth/session') return jsonResponse({ user });
        if (path === '/api/me/top-list') return jsonResponse(topEntries);
        if (path === '/api/me/list-settings') return jsonResponse({ topList: 'PRIVATE', singingList: 'PRIVATE' });
        if (path === '/api/me/top-list/items' && init?.method === 'POST') {
          postCount += 1;
          if (postCount === 1) return jsonResponse({
            code: 'SONG_ALREADY_EXISTS',
            message: 'This song already exists. Confirm that you want to use it.',
            existingSong: { id: 'shared-song', title: 'Shared Song', artist: 'Shared Artist' }
          }, 409);
          topEntries = [{ id: 'shared-song', title: 'Shared Song', artist: 'Shared Artist', releaseYear: null, position: 1 }];
          return jsonResponse(topEntries, 201);
        }
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    await screen.findByRole('heading', { name: 'My Top 10' });
    fireEvent.click(screen.getByRole('button', { name: 'Can’t find a song? Add it here' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a song' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Song title' }), { target: { value: 'Shared Song' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Artist' }), { target: { value: 'Shared Artist' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add song' }));
    expect(await screen.findByRole('dialog', { name: 'Use existing song?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add existing song' }));
    expect(await screen.findByText('Shared Song')).toBeVisible();
    expect(postCount).toBe(2);
  });
});
