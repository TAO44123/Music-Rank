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

function renderAt(path: string, session: { user: typeof user | null }) {
  const { client, router } = renderRoute({
    path,
    fetch: (requestPath) => {
      if (requestPath === '/api/auth/session') return jsonResponse(session);
      if (requestPath === '/api/rankings') return jsonResponse([{ id: 'ranking-1', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false }]);
      if (requestPath === '/api/me/top-list' || requestPath === '/api/me/singing-list') return jsonResponse([]);
      if (requestPath === '/api/me/list-settings') return jsonResponse({ topList: 'PRIVATE', singingList: 'PRIVATE' });
      if (requestPath.startsWith('/api/rankings/')) return jsonResponse({ id: 'ranking-1', title: '90s Demo Ranking', slug: '90s-demo-ranking', era: '1990s', decadeStart: 1990, decade: '90s', region: 'mainland', displayOrder: 4, sourceType: 'DEMO', description: null, hasSource: false, sourceUrl: null, songCount: 0, facets: { artists: [], releaseYears: [] }, entries: [] });
      throw new Error(`Unexpected request: ${requestPath}`);
    }
  });
  render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
  return router;
}

// Every test scopes its queries to the bar with `within`. TabNav carries
// aria-label="Primary" and is in the same document — jsdom does not evaluate the
// media query that hides one of the two — so an unscoped query for a destination
// would match both surfaces.
describe('BottomNav', () => {
  it('shows all four destinations to an anonymous visitor', async () => {
    renderAt('/', { user: null });
    const bar = await screen.findByRole('navigation', { name: 'Primary bottom' });
    expect(within(bar).getByRole('link', { name: 'The Ranking' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Personal Ranking' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Practice Library' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Groups' })).toBeInTheDocument();
  });

  it('opens the sign-in dialog instead of navigating when an anonymous visitor taps a guarded destination', async () => {
    const router = renderAt('/', { user: null });
    const bar = await screen.findByRole('navigation', { name: 'Primary bottom' });

    fireEvent.click(within(bar).getByRole('button', { name: 'Personal Ranking' }));

    expect(await screen.findByRole('heading', { name: 'Sign in to Music Rank' })).toBeVisible();
    // The root has already selected the first published ranking. The guarded
    // button must leave that catalog route unchanged instead of entering the
    // personal route and relying on its redirect guard.
    expect(router.state.location.pathname).toBe('/rankings/90s-demo-ranking');
  });

  it('gives an authenticated visitor real links', async () => {
    renderAt('/', { user });
    // Waiting on the bar itself is not enough: it renders immediately, while the
    // session query is still pending and `user` is null, so at that moment the
    // guarded destinations are still buttons. Wait for the link instead.
    expect(await screen.findByRole('link', { name: 'Personal Ranking' }, { timeout: 5000 })).toHaveAttribute('href', '/personal');
    const bar = screen.getByRole('navigation', { name: 'Primary bottom' });
    expect(within(bar).getByRole('link', { name: 'Practice Library' })).toHaveAttribute('href', '/practice');
    expect(within(bar).getByRole('link', { name: 'Groups' })).toHaveAttribute('href', '/groups');
  });

  it('announces the full destination name while showing the short label', async () => {
    renderAt('/', { user });
    const personal = await screen.findByRole('link', { name: 'Personal Ranking' });
    expect(personal).toHaveTextContent('Personal');
    expect(personal).not.toHaveTextContent('Personal Ranking');
  });

  it('marks the destination matching the current path as current', async () => {
    renderAt('/practice', { user });
    expect(await screen.findByRole('link', { name: 'Practice Library' })).toHaveAttribute('aria-current', 'page');
    const bar = screen.getByRole('navigation', { name: 'Primary bottom' });
    expect(within(bar).getByRole('link', { name: 'The Ranking' })).not.toHaveAttribute('aria-current');
  });
});
