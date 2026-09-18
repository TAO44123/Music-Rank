import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../test/renderRoute';
import { theme } from '../theme';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const group = { id: 'd0000000-0000-4000-8000-000000000001', name: 'Default Group', slug: 'default' };
const user = { id: 'user-1', username: 'listener_1', displayName: 'Listener One' };
const otherMember = { id: 'user-2', username: 'listener_2', displayName: 'Listener Two' };
const response = (body: unknown, status = 200) => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const ranking = { id: 'ranking-1', title: 'Ranking', slug: 'test-ranking', displayOrder: 1, decade: null, region: null, sourceType: 'DEMO', hasSource: false };

function mount(path: string, handler: (path: string, init?: RequestInit) => Promise<Response>) {
  const route = renderRoute({ path, fetch: handler });
  render(<ThemeProvider theme={theme}><QueryClientProvider client={route.client}><RouterProvider router={route.router} /></QueryClientProvider></ThemeProvider>);
  return route;
}

function home(path: string) {
  if (path === '/api/rankings') return response([ranking]);
  if (path.startsWith('/api/rankings/test-ranking')) return response({ ...ranking, entries: [], songCount: 0, facets: { artists: [], releaseYears: [] }, sourceUrl: null });
  if (path === '/api/me/top-list' || path === '/api/me/singing-list') return response([]);
  if (path === '/api/me/list-settings') return response({ topList: 'PRIVATE', singingList: 'PRIVATE' });
  throw new Error(`Unexpected request: ${path}`);
}

function submitAuth(mode: 'login' | 'register', account = user) {
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Username/), { target: { value: account.username } });
  if (mode === 'register') fireEvent.change(within(dialog).getByLabelText(/Display name/), { target: { value: account.displayName } });
  fireEvent.change(within(dialog).getByLabelText(/Password/), { target: { value: 'correct horse battery staple' } });
  fireEvent.click(within(dialog).getByRole('button', { name: mode === 'login' ? 'Sign in' : 'Create account' }));
}

describe('Default Group', () => {
  it('shows the nonmember empty state without a join button or a member request', async () => {
    const { fetchMock } = mount('/groups', (path) => {
      if (path === '/api/auth/session') return response({ user });
      if (path === '/api/me/groups') return response([]);
      return home(path);
    });
    expect(await screen.findByText('You have not joined any groups yet.', {}, { timeout: 5000 })).toBeVisible();
    expect(screen.queryByRole('button', { name: /join/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([path]) => String(path).includes('/members') || String(path).endsWith('/join'))).toBe(false);
  });

  it('opens a known member with private lists without requesting private contents', async () => {
    const { fetchMock, router } = mount('/groups', (path) => {
      if (path === '/api/auth/session') return response({ user });
      if (path === '/api/me/groups') return response([group]);
      if (path === `/api/me/groups/${group.id}/members`) return response([otherMember]);
      if (path === `/api/me/groups/${group.id}/members/${otherMember.username}`) return response({ ...otherMember, lists: { topList: 'PRIVATE', singingList: 'PRIVATE' } });
      return home(path);
    });
    const list = await screen.findByRole('list', { name: 'Group members' });
    fireEvent.click(within(list).getByText('Listener Two'));
    expect(await screen.findByText('This member has not made any lists public yet.')).toBeVisible();
    expect(router.state.location.pathname).toBe(`/u/${otherMember.username}`);
    expect(screen.getByRole('link', { name: 'Back to group' })).toHaveAttribute('href', '/groups');
    expect(fetchMock.mock.calls.some(([path]) => /\/api\/users\/.*\/(top-list|singing-list)/.test(String(path)))).toBe(false);
  });

  it('does not describe a failed member profile request as no public lists', async () => {
    mount(`/u/${otherMember.username}?group=${group.id}`, (path) => {
      if (path === '/api/auth/session') return response({ user });
      if (path.includes('/members/')) return response({ code: 'SERVER_ERROR' }, 500);
      return home(path);
    });
    expect(await screen.findByText('Could not load this member’s profile.')).toBeVisible();
    expect(screen.queryByText('This member has not made any lists public yet.')).not.toBeInTheDocument();
  });

  it('clears member caches when signing out and switching to a nonmember account', async () => {
    const secondUser = { id: 'user-2', username: 'listener_2', displayName: 'Listener Two' };
    let currentUser: typeof user | null = user;
    const { client } = mount('/groups', (path) => {
      if (path === '/api/auth/session') return response({ user: currentUser });
      if (path === '/api/auth/logout') { currentUser = null; return response(null, 204); }
      if (path === '/api/auth/login') { currentUser = secondUser; return response({ user: secondUser }); }
      if (path === '/api/me/groups') return response(currentUser?.id === secondUser.id ? [] : [group]);
      if (path.endsWith('/members')) return response([user]);
      return home(path);
    });
    await screen.findByRole('list', { name: 'Group members' });
    fireEvent.click(screen.getByRole('button', { name: `@${user.username}` }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    await waitFor(() => expect(client.getQueryData(['auth-session'])).toEqual({ user: null }));
    await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ['personal'] })).toHaveLength(0));
    expect(screen.queryByRole('list', { name: 'Group members' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    await screen.findByRole('dialog');
    submitAuth('login', secondUser);
    await screen.findByRole('button', { name: `@${secondUser.username}` }, { timeout: 5000 });
    fireEvent.click(await screen.findByRole('link', { name: 'Groups' }));
    expect(await screen.findByText('You have not joined any groups yet.', {}, { timeout: 5000 })).toBeVisible();
    expect(client.getQueryCache().findAll({ queryKey: ['personal', user.id] })).toHaveLength(0);
  });

  it('clears protected group caches after a session expires', async () => {
    const { client } = mount('/groups', (path) => {
      if (path === '/api/auth/session') return response({ user });
      if (path === '/api/me/groups') return response([group]);
      if (path.endsWith('/members')) return response({ code: 'AUTH_REQUIRED', message: 'Sign in' }, 401);
      return home(path);
    });
    await waitFor(() => expect(client.getQueryData(['auth-session'])).toEqual({ user: null }), { timeout: 5000 });
    await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ['personal'] })).toHaveLength(0));
    expect(screen.queryByRole('list', { name: 'Group members' })).not.toBeInTheDocument();
  });
});

describe('Default invitation', () => {
  it('retains the invitation after failed authentication and dialog cancellation without joining', async () => {
    const { fetchMock, router } = mount('/invite/default', (path) => {
      if (path === '/api/auth/session') return response({ user: null });
      if (path === '/api/group-invitations/default') return response(group);
      if (path === '/api/auth/login') return response({ code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }, 401);
      return home(path);
    });
    await screen.findByText('Sign in or create an account to automatically join Default Group.');
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' }).at(-1)!);
    await screen.findByRole('dialog');
    submitAuth('login');
    expect(await screen.findByText('Invalid username or password')).toBeVisible();
    expect(router.state.location.pathname).toBe('/invite/default');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith('/join'))).toBe(false);
  });

  it('allows an anonymous visitor to read and refresh the invitation without joining', async () => {
    const handler = (path: string) => {
      if (path === '/api/auth/session') return response({ user: null });
      if (path === '/api/group-invitations/default') return response(group);
      return home(path);
    };
    const first = mount('/invite/default', handler);
    const card = await screen.findByText('Sign in or create an account to automatically join Default Group.');
    expect(card).toBeVisible();
    expect(first.fetchMock.mock.calls.some(([path]) => String(path).endsWith('/join'))).toBe(false);
    cleanup();
    const second = mount('/invite/default', handler);
    expect(await screen.findByText('Sign in or create an account to automatically join Default Group.')).toBeVisible();
    expect(second.router.state.location.pathname).toBe('/invite/default');
  });

  it.each(['login', 'register'] as const)('continues invitation %s into joining and the group page', async (mode) => {
    let currentUser: typeof user | null = null;
    let joins = 0;
    const { router } = mount('/invite/default', (path) => {
      if (path === '/api/auth/session') return response({ user: currentUser });
      if (path === '/api/group-invitations/default') return response(group);
      if (path === `/api/auth/${mode}`) { currentUser = user; return response({ user }, mode === 'register' ? 201 : 200); }
      if (path.endsWith('/default/join')) { joins++; return response(group); }
      if (path === '/api/me/groups') return response([group]);
      if (path.endsWith('/members')) return response([user]);
      return home(path);
    });
    await screen.findByText('Sign in or create an account to automatically join Default Group.');
    fireEvent.click(screen.getAllByRole('button', { name: mode === 'login' ? 'Sign in' : 'Create account' }).at(-1)!);
    await screen.findByRole('dialog');
    // Switching both ways must preserve the invitation route and intent.
    fireEvent.click(screen.getByRole('button', { name: mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: mode === 'login' ? 'Already have an account? Sign in' : 'Need an account? Register' }));
    submitAuth(mode);
    expect(await screen.findByRole('heading', { name: 'Default Group' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/groups');
    expect(joins).toBe(1);
  });

  it('automatically joins a logged-in visitor and allows retry after a failed join', async () => {
    let joins = 0;
    const { router } = mount('/invite/default', (path) => {
      if (path === '/api/auth/session') return response({ user });
      if (path === '/api/group-invitations/default') return response(group);
      if (path.endsWith('/default/join')) return ++joins === 1 ? response({ code: 'SERVER_ERROR' }, 503) : response(group);
      if (path === '/api/me/groups') return response([group]);
      if (path.endsWith('/members')) return response([user]);
      return home(path);
    });
    expect(await screen.findByText('Could not join the group. You are still signed in.')).toBeVisible();
    expect(joins).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('heading', { name: 'Default Group' });
    expect(router.state.location.pathname).toBe('/groups');
    expect(joins).toBe(2);
  });

  it('does not join when session resolution fails', async () => {
    const { fetchMock } = mount('/invite/default', (path) => {
      if (path === '/api/auth/session') return response({ code: 'SERVER_ERROR' }, 503);
      if (path === '/api/group-invitations/default') return response(group);
      return home(path);
    });
    expect(await screen.findByText('Could not check your sign-in status.')).toBeVisible();
    expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith('/join'))).toBe(false);
    expect(screen.queryByText('Sign in or create an account to automatically join Default Group.')).not.toBeInTheDocument();
  });
});
