import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../test/renderRoute';
import { theme } from '../theme';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const user = { id: 'owner-1', username: 'owner', displayName: 'Owner' };
const group = 'd0000000-0000-4000-8000-000000000001';
const settings = { topList: 'PRIVATE', singingList: 'PUBLIC' };
const top = [{ id: 'song-1', title: 'Private top song', artist: 'Artist', releaseYear: 1990, position: 1 }];
const practice = [{ id: 'song-2', title: 'Practice song', artist: 'Artist', releaseYear: 1991, status: 'PRACTICING', note: 'Private note' }];
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function mount(path: string, handler: (path: string, init?: RequestInit) => Promise<Response>) {
  const route = renderRoute({ path, fetch: handler });
  render(<ThemeProvider theme={theme}><QueryClientProvider client={route.client}><RouterProvider router={route.router} /></QueryClientProvider></ThemeProvider>);
  return route;
}

function handler(path: string) {
  if (path === '/api/auth/session') return json({ user });
  if (path === '/api/me/list-settings') return json(settings);
  if (path === '/api/me/top-list') return json(top);
  if (path === '/api/me/singing-list') return json(practice);
  if (path === '/api/users/owner') return json({ ...user, lists: settings });
  if (path === '/api/users/owner/singing-list') return json(practice.map(({ note: _note, ...entry }) => entry));
  throw new Error(`Unexpected request: ${path}`);
}

describe('Profile owner view', () => {
  it.each(['/u/owner', `/u/owner?group=${group}`, '/u/owner?view=private'])('shows all owner lists at %s using protected caches', async (path) => {
    const { client, fetchMock } = mount(path, handler);
    expect(await screen.findByText('Private top song')).toBeVisible();
    expect(await screen.findByText('Practice song')).toBeVisible();
    expect(screen.getByLabelText('Top 10 visibility: private')).toBeVisible();
    expect(screen.getByLabelText('Practice Library visibility: public')).toBeVisible();
    expect(screen.queryByText('Private note')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([path]) => String(path).startsWith('/api/users/') || String(path).includes('/members/'))).toBe(false);
    expect(client.getQueryData(['personal', user.id, 'top-list'])).toEqual(top);
    expect(client.getQueryCache().findAll({ queryKey: ['public-profile'] }).every((query) => query.state.data === undefined)).toBe(true);
  });

  it('previews only public lists and returns to the full owner view', async () => {
    const { router } = mount(`/u/owner?group=${group}`, handler);
    await screen.findByText('Private top song');
    fireEvent.click(screen.getByRole('button', { name: 'View public display' }));
    expect(await screen.findByText('This is what other people can see. Your private lists are hidden.')).toBeVisible();
    expect(await within(await screen.findByRole('region', { name: 'Practice Library' })).findByText('Practice song')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Top 10' })).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ group, view: 'public' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to my profile' }));
    expect(await screen.findByText('Private top song')).toBeVisible();
  });

  it('shows both private lists to the owner and keeps a return link in an empty public preview', async () => {
    mount('/u/owner', (path) => {
      if (path === '/api/me/list-settings') return json({ topList: 'PRIVATE', singingList: 'PRIVATE' });
      if (path === '/api/users/owner') return json({ code: 'PUBLIC_PROFILE_NOT_FOUND' }, 404);
      return handler(path);
    });
    await screen.findByText('Private top song');
    expect(await screen.findByLabelText('Practice Library visibility: private')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'View public display' }));
    expect(await screen.findByText('Public profile not found', { exact: true })).toBeVisible();
    expect(screen.queryByText('Private top song')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to my profile' }));
    expect(await screen.findByText('Private top song')).toBeVisible();
  });

  it.each([null, { id: 'viewer-2', username: 'viewer', displayName: 'Viewer' }])('never requests owner resources for another viewer: %s', async (viewer) => {
    const { fetchMock } = mount('/u/owner?view=private', (path) => path === '/api/auth/session' ? json({ user: viewer }) : handler(path));
    const list = await screen.findByRole('region', { name: 'Practice Library' });
    expect(await within(list).findByText('Practice song')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Top 10' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View public display' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([path]) => String(path).startsWith('/api/me/'))).toBe(false);
  });

  it('hides owner contents immediately when the session changes to another user or signed out', async () => {
    const { client } = mount('/u/owner', handler);
    await screen.findByText('Private top song');
    await act(async () => { client.setQueryData(['auth-session'], { user: { id: 'viewer-2', username: 'viewer', displayName: 'Viewer' } }); });
    await screen.findByText('Practice song');
    expect(screen.queryByText('Private top song')).not.toBeInTheDocument();
    await act(async () => { client.setQueryData(['auth-session'], { user: null }); });
    expect(screen.queryByText('Private top song')).not.toBeInTheDocument();
  });

  it('clears protected owner data on an expired session', async () => {
    const { client } = mount('/u/owner', (path) => path === '/api/me/singing-list' ? json({ code: 'AUTH_REQUIRED', message: 'Sign in' }, 401) : handler(path));
    await waitFor(() => expect(client.getQueryData(['auth-session'])).toEqual({ user: null }));
    await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ['personal'] })).toHaveLength(0));
    expect(screen.queryByText('Private top song')).not.toBeInTheDocument();
  });
});
