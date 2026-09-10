import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { theme } from './theme';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function renderApp(fetchImplementation: (path: string, options?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn((input: string | URL | Request, options?: RequestInit) => fetchImplementation(String(input), options));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><App /></QueryClientProvider></ThemeProvider>);
  return { client, fetchMock };
}

describe('App authentication state', () => {
  it('keeps personal endpoints disabled for anonymous visitors', async () => {
    const { fetchMock } = renderApp((path) => {
      if (path === '/api/auth/session') return response({ user: null });
      if (path === '/api/rankings' || path === '/api/songs') return response([]);
      throw new Error(`Unexpected request: ${path}`);
    });
    expect(await screen.findByRole('heading', { name: 'Your lists are private to you' })).toBeVisible();
    expect(fetchMock.mock.calls.map(([path]) => String(path)).some((path) => path.startsWith('/api/me/'))).toBe(false);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);
    expect(screen.getByRole('dialog', { name: 'Sign in to Music Rank' })).toBeVisible();
  });

  it('loads user-scoped data and removes it from the cache after logout', async () => {
    const user = { id: 'user-1', username: 'listener_1', displayName: 'Listener One' };
    const { client } = renderApp((path) => {
      if (path === '/api/auth/session') return response({ user });
      if (path === '/api/rankings' || path === '/api/songs' || path === '/api/me/top-list' || path === '/api/me/singing-list') return response([]);
      if (path === '/api/me/list-settings') return response({ topList: 'PRIVATE', singingList: 'PRIVATE' });
      if (path === '/api/auth/logout') return response(null, 204);
      throw new Error(`Unexpected request: ${path}`);
    });
    expect(await screen.findByRole('heading', { name: 'My Top 10' })).toBeVisible();
    expect(client.getQueriesData({ queryKey: ['personal', user.id] }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '@listener_1' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Your lists are private to you' })).toBeVisible();
    await waitFor(() => expect(client.getQueriesData({ queryKey: ['personal'] })).toHaveLength(0));
  });

  it('renders only public profile sections on a shared route', async () => {
    window.history.replaceState({}, '', '/u/listener_1');
    renderApp((path) => {
      if (path === '/api/users/listener_1') return response({ username: 'listener_1', displayName: 'Listener One', lists: { topList: 'PUBLIC', singingList: 'PRIVATE' } });
      if (path === '/api/users/listener_1/top-list') return response([{ id: 'song-1', title: '涛声依旧', artist: '毛宁', releaseYear: 1993, position: 1 }]);
      throw new Error(`Unexpected request: ${path}`);
    });
    expect(await screen.findByRole('heading', { name: 'Listener One' })).toBeVisible();
    expect(await screen.findByRole('region', { name: 'Top 10' })).toHaveTextContent('涛声依旧');
    expect(screen.queryByRole('region', { name: 'Singing List' })).not.toBeInTheDocument();
  });
});
