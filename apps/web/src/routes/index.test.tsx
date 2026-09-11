import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function rankingFetch(path: string) {
  if (path === '/api/auth/session') return jsonResponse({ user });
  if (path === '/api/rankings') return jsonResponse([{ id: 'ranking-1', title: '90s', era: '1990s', sourceType: 'DEMO', description: null }]);
  if (path === '/api/songs') return jsonResponse([]);
  if (path === '/api/me/top-list' || path === '/api/me/singing-list') return jsonResponse([]);
  if (path === '/api/me/list-settings') return jsonResponse({ topList: 'PRIVATE', singingList: 'PRIVATE' });
  if (path.startsWith('/api/rankings/ranking-1')) return jsonResponse({ id: 'ranking-1', title: '90s', era: '1990s', sourceType: 'DEMO', description: null, sourceUrl: null, entries: [] });
  throw new Error(`Unexpected request: ${path}`);
}

describe('/', () => {
  it('renders the ranking full width with no personal list column', async () => {
    const { client, router } = renderRoute({ path: '/', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: '90s' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'My Top 10' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'My Singing List' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('issues no personal request for an anonymous visitor', async () => {
    const { client, router, fetchMock } = renderRoute({
      path: '/',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user: null });
        if (path === '/api/rankings') return jsonResponse([{ id: 'ranking-1', title: '90s', era: '1990s', sourceType: 'DEMO', description: null }]);
        if (path === '/api/songs') return jsonResponse([]);
        if (path.startsWith('/api/rankings/ranking-1')) return jsonResponse({ id: 'ranking-1', title: '90s', era: '1990s', sourceType: 'DEMO', description: null, sourceUrl: null, entries: [] });
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: '90s' })).toBeVisible();
    expect(fetchMock.mock.calls.map(([path]) => String(path)).some((path) => path.startsWith('/api/me/'))).toBe(false);
  });

  it('applies filters from the URL on load', async () => {
    const { client, router } = renderRoute({ path: '/?q=%E9%82%A3%E8%8B%B1&year=1993', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByLabelText('Search songs or artists')).toHaveValue('那英');
    expect(router.state.location.search).toEqual({ q: '那英', year: 1993 });
  });

  it('writes filter changes into the URL without stacking history entries', async () => {
    const { client, router } = renderRoute({ path: '/', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    const field = await screen.findByLabelText('Search songs or artists');
    const lengthBefore = router.history.length;
    fireEvent.change(field, { target: { value: '涛声' } });
    await waitFor(() => expect(router.state.location.search).toEqual({ q: '涛声' }));
    expect(router.history.length).toBe(lengthBefore);
  });

  it('degrades an invalid year to unfiltered while keeping the valid text filter', async () => {
    const { client, router } = renderRoute({ path: '/?q=%E9%82%A3%E8%8B%B1&year=banana', fetch: rankingFetch });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByLabelText('Search songs or artists')).toHaveValue('那英');
    expect(router.state.location.search).toEqual({ q: '那英' });
  });
});
