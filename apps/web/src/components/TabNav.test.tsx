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

function renderAt(path: string, session: { user: typeof user | null }) {
  const { client, router } = renderRoute({
    path,
    fetch: (requestPath) => {
      if (requestPath === '/api/auth/session') return jsonResponse(session);
      if (requestPath === '/api/rankings') return jsonResponse([{ id: 'ranking-1', title: '90s', era: null, sourceType: 'DEMO', description: null }]);
      if (requestPath === '/api/songs' || requestPath === '/api/me/top-list' || requestPath === '/api/me/singing-list') return jsonResponse([]);
      if (requestPath === '/api/me/list-settings') return jsonResponse({ topList: 'PRIVATE', singingList: 'PRIVATE' });
      if (requestPath.startsWith('/api/rankings/')) return jsonResponse({ id: 'ranking-1', title: '90s', era: null, sourceType: 'DEMO', description: null, sourceUrl: null, entries: [] });
      throw new Error(`Unexpected request: ${requestPath}`);
    }
  });
  render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
  return router;
}

describe('TabNav', () => {
  it('shows only the ranking tab to anonymous visitors', async () => {
    renderAt('/', { user: null });
    expect(await screen.findByRole('tab', { name: /The Ranking/ })).toBeVisible();
    expect(screen.queryByRole('tab', { name: /Personal Ranking/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Practice Library/ })).not.toBeInTheDocument();
  });

  it('shows all three tabs to an authenticated visitor', async () => {
    renderAt('/', { user });
    expect(await screen.findByRole('tab', { name: /Personal Ranking/ })).toBeVisible();
    expect(screen.getByRole('tab', { name: /Practice Library/ })).toBeVisible();
  });

  it('marks the tab matching the current path as selected', async () => {
    renderAt('/practice', { user });
    expect(await screen.findByRole('tab', { name: /Practice Library/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /The Ranking/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders both the short and the full label for every tab', async () => {
    renderAt('/', { user });
    const rankingTab = await screen.findByRole('tab', { name: /The Ranking/ });
    expect(rankingTab).toHaveTextContent('Ranking');
    expect(rankingTab).toHaveTextContent('The Ranking');
  });

  it('renders every tab as a real anchor so it can be opened in a new tab', async () => {
    renderAt('/', { user });
    expect(await screen.findByRole('tab', { name: /Personal Ranking/ })).toHaveAttribute('href', '/personal');
  });

  it('is not rendered on the public profile route', async () => {
    const { client, router } = renderRoute({
      path: '/u/listener_1',
      fetch: (path) => {
        if (path === '/api/users/listener_1') return jsonResponse({ username: 'listener_1', displayName: 'Listener One', lists: { topList: 'PRIVATE', singingList: 'PRIVATE' } });
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'Listener One' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });
});
