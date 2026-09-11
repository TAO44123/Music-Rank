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

describe('/practice', () => {
  it('redirects anonymous visitors to the ranking and opens the sign-in dialog', async () => {
    const { client, router } = renderRoute({
      path: '/practice',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user: null });
        if (path === '/api/rankings' || path === '/api/songs') return jsonResponse([]);
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('dialog', { name: 'Sign in to Music Rank' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });

  it('renders the singing list for an authenticated visitor', async () => {
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
    expect(await screen.findByRole('heading', { name: 'My Singing List' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/practice');
  });
});
