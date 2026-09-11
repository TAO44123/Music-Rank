---
plan_id: PLAN-002
title: Tab Navigation and Client Routing Implementation Plan
status: Completed
author: chance
created: 2026-09-11
updated: 2026-09-11
implements: DESIGN_002_TAB_NAVIGATION.md
related:
  - DESIGN_002_TAB_NAVIGATION.md
  - ENGINEERING_GUIDE.md
---

# Tab Navigation and Client Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the single-page layout with three full-width destinations — The Ranking, Personal Ranking, Practice Library — reachable from a responsive tab bar and each addressable by URL.

**Architecture:** Introduce TanStack Router with a code-based route tree. A layout root route owns the top bar, tab bar, auth dialog, snackbar, and every mutation, exposing them to page components through a small React context. The two personal routes guard themselves with `beforeLoad`, resolving the session through the same `queryOptions` object their components later read. The ranking page's filters become validated URL search parameters.

**Tech Stack:** React 19, TanStack Router 1.170.x, TanStack Query 5, MUI 7, zod 4, Vitest 4 + Testing Library, Playwright 1.57.

**Spec:** `docs/DESIGN_002_TAB_NAVIGATION.md`

## Global Constraints

- Node 24.21.0, npm 11.19.0 (`package.json` `engines`).
- All source, identifiers, comments, UI copy, API messages, test names, and documentation are written in English (`docs/IMPLEMENTATION_HANDOFF.md`).
- No API route, database schema, or migration changes.
- No change to `theme.ts` palette or typography, and no new stylesheet. Tab styling uses existing theme tokens only.
- These five components keep their current behavior and props: `RankingPanel`, `TopListPanel`, `SingingListPanel`, `VisibilityControl`, `AuthDialog`.
- `@music-rank/contracts` and `@music-rank/database` must be built before `apps/web` typechecks: `npm run build --workspace @music-rank/contracts && npm run build --workspace @music-rank/database`.
- Run web tests with `npm run test --workspace @music-rank/web`.
- Every task ends with a passing `npm run test --workspace @music-rank/web` and a commit.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/src/components/Brand.tsx` | Top bar. Extracted from `App.tsx`. | 1 |
| `apps/web/src/components/AccountActions.tsx` | Account menu button. Extracted from `App.tsx`. | 1 |
| `apps/web/src/queries.ts` | Query keys and `queryOptions` factories shared by components and route guards. | 2 |
| `apps/web/src/router.tsx` | Route tree, router factory, `Register` declaration. | 3 |
| `apps/web/src/routes/__root.tsx` | Layout route: `Brand`, `TabNav`, `<Outlet />`, `AuthDialog`, `Snackbar`. | 3, 4 |
| `apps/web/src/routes/index.tsx` | The Ranking page. | 3, 7, 9 |
| `apps/web/src/routes/u.$username.tsx` | Public profile page. Moved from `App.tsx`. | 3 |
| `apps/web/src/routes/personal.tsx` | Personal Ranking page, guarded. | 5 |
| `apps/web/src/routes/practice.tsx` | Practice Library page, guarded. | 6 |
| `apps/web/src/shell/AppShellContext.tsx` | Shared shell state and actions. | 4 |
| `apps/web/src/components/TabNav.tsx` | Tab bar. | 8 |
| `apps/web/src/test/renderRoute.tsx` | Test helper: renders the real route tree over a memory history. | 3 |
| `apps/web/src/App.tsx` | Deleted at the end of Task 3. | 3 |

---

## Task 1: Extract Brand and AccountActions

Pure moves with no behavior change. They come first so later tasks import stable modules instead of reaching into `App.tsx` while it is being dismantled.

**Files:**
- Create: `apps/web/src/components/Brand.tsx`
- Create: `apps/web/src/components/AccountActions.tsx`
- Modify: `apps/web/src/App.tsx:39-46` (remove `Brand`), `apps/web/src/App.tsx:62-73` (remove `AccountActions`), plus their imports

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export function Brand({ action }: { action?: ReactNode }): JSX.Element`
  - `export function AccountActions({ user, onLogout }: { user: AuthUser; onLogout: () => void }): JSX.Element`

- [x] **Step 1: Run the existing suite to record the baseline**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS. Record the number of passing tests; Step 5 must match it.

- [x] **Step 2: Create `apps/web/src/components/Brand.tsx`**

```tsx
import { AppBar, Box, Container, Stack, Toolbar, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function Brand({ action }: { action?: ReactNode }) {
  return <AppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
    <Container maxWidth="xl"><Toolbar disableGutters sx={{ minHeight: 66 }}><Stack direction="row" justifyContent="space-between" alignItems="center" width="100%" gap={2}>
      <Box component="a" href="/" sx={{ color: 'inherit', textDecoration: 'none', minWidth: 0 }}><Typography variant="h1" fontSize="1.45rem">Music Rank</Typography><Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>Build a personal map of the songs you keep returning to.</Typography></Box>
      {action}
    </Stack></Toolbar></Container>
  </AppBar>;
}
```

- [x] **Step 3: Create `apps/web/src/components/AccountActions.tsx`**

```tsx
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { Button, Divider, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';
import type { AuthUser } from '../api';

export function AccountActions({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <>
    <Button startIcon={<AccountCircleOutlinedIcon />} onClick={(event: MouseEvent<HTMLButtonElement>) => setAnchor(event.currentTarget)} aria-controls={anchor ? 'account-menu' : undefined} aria-haspopup="true" aria-expanded={anchor ? 'true' : undefined}>@{user.username}</Button>
    <Menu id="account-menu" anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      <MenuItem component="a" href={`/u/${user.username}`}>View public profile</MenuItem>
      <Divider />
      <MenuItem onClick={() => { setAnchor(null); onLogout(); }}><LogoutIcon fontSize="small" sx={{ mr: 1 }} />Sign out</MenuItem>
    </Menu>
  </>;
}
```

- [x] **Step 4: Delete both definitions from `App.tsx` and import them instead**

Remove the `Brand` and `AccountActions` function bodies. Add:

```tsx
import { AccountActions } from './components/AccountActions';
import { Brand } from './components/Brand';
```

Then remove the now-unused imports from the `@mui/material` and `@mui/icons-material` import lines: `AccountCircleOutlinedIcon`, `LogoutIcon`, `AppBar`, `Menu`, `MenuItem`, `Toolbar`, `Divider`, and the `MouseEvent` type import. Leave every other import in place — `Box`, `Button`, `Container`, `Stack`, and `Typography` are still used elsewhere in the file.

- [x] **Step 5: Verify nothing changed**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS with the same test count as Step 1.

Run: `npm run build --workspace @music-rank/contracts && npm run typecheck --workspace @music-rank/web`
Expected: no output, exit 0.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/components/Brand.tsx apps/web/src/components/AccountActions.tsx apps/web/src/App.tsx
git commit -m "refactor: extract Brand and AccountActions from App"
```

---

## Task 2: Extract shared query options

Route guards and components must resolve queries from one definition, otherwise a guard populates a cache entry under a key its component never reads. `queryOptions` from TanStack Query is the object both sides share.

**Files:**
- Create: `apps/web/src/queries.ts`
- Modify: `apps/web/src/App.tsx:15-27` (remove the local `queryKeys`), and every `useQuery` call in `HomePage` and `PublicProfilePage`

**Interfaces:**
- Consumes: `request`, and the types from `apps/web/src/api.ts`.
- Produces:
  - `queryKeys` — the same object that currently lives in `App.tsx`, unchanged.
  - `getRankingPath(rankingId: string, query: string, artist: string, releaseYear: number | 'ALL'): string`
  - `sessionQueryOptions(): UseQueryOptions<AuthSession>`
  - `rankingsQueryOptions()`, `songsQueryOptions()`
  - `rankingQueryOptions(rankingId: string | undefined, query: string, artist: string, releaseYear: number | 'ALL')`
  - `topListQueryOptions(user: AuthUser | null)`, `singingListQueryOptions(user: AuthUser | null, filter: SingingStatus | 'ALL')`, `listSettingsQueryOptions(user: AuthUser | null)`
  - `publicProfileQueryOptions(username: string)`, `publicTopListQueryOptions(username: string, enabled: boolean)`, `publicSingingListQueryOptions(username: string, enabled: boolean)`

- [x] **Step 1: Create `apps/web/src/queries.ts`**

```ts
import { queryOptions } from '@tanstack/react-query';
import { request, type AuthSession, type AuthUser, type ListSettings, type PublicProfile, type PublicSingingListEntry, type Ranking, type RankingDetail, type SingingListEntry, type SingingStatus, type Song, type TopListEntry } from './api';

export const queryKeys = {
  session: ['auth-session'] as const,
  rankings: ['rankings'] as const,
  songs: ['songs'] as const,
  ranking: (id: string, q: string, artist: string, releaseYear: number | 'ALL') => ['ranking', id, q, artist, releaseYear] as const,
  personal: ['personal'] as const,
  signedOut: (resource: string, detail?: string) => ['signed-out', resource, detail ?? 'all'] as const,
  topList: (userId: string) => ['personal', userId, 'top-list'] as const,
  singingList: (userId: string, status: string) => ['personal', userId, 'singing-list', status] as const,
  listSettings: (userId: string) => ['personal', userId, 'list-settings'] as const,
  publicProfile: (username: string) => ['public-profile', username] as const,
  publicTopList: (username: string) => ['public-profile', username, 'top-list'] as const,
  publicSingingList: (username: string) => ['public-profile', username, 'singing-list'] as const
};

export function getRankingPath(rankingId: string, query: string, artist: string, releaseYear: number | 'ALL') {
  const parameters = new URLSearchParams();
  if (query) parameters.set('q', query);
  if (artist !== 'ALL') parameters.set('artist', artist);
  if (releaseYear !== 'ALL') parameters.set('releaseYear', String(releaseYear));
  const queryString = parameters.toString();
  return `/api/rankings/${rankingId}${queryString ? `?${queryString}` : ''}`;
}

export const sessionQueryOptions = () => queryOptions({
  queryKey: queryKeys.session,
  queryFn: () => request<AuthSession>('/api/auth/session'),
  retry: false
});

export const rankingsQueryOptions = () => queryOptions({ queryKey: queryKeys.rankings, queryFn: () => request<Ranking[]>('/api/rankings') });

export const songsQueryOptions = () => queryOptions({ queryKey: queryKeys.songs, queryFn: () => request<Song[]>('/api/songs') });

export const rankingQueryOptions = (rankingId: string | undefined, query: string, artist: string, releaseYear: number | 'ALL') => queryOptions({
  queryKey: queryKeys.ranking(rankingId ?? 'pending', query, artist, releaseYear),
  queryFn: () => request<RankingDetail>(getRankingPath(rankingId!, query, artist, releaseYear)),
  enabled: Boolean(rankingId)
});

export const topListQueryOptions = (user: AuthUser | null) => queryOptions({
  queryKey: user ? queryKeys.topList(user.id) : queryKeys.signedOut('top-list'),
  queryFn: () => request<TopListEntry[]>('/api/me/top-list'),
  enabled: Boolean(user),
  retry: false
});

export const singingListQueryOptions = (user: AuthUser | null, filter: SingingStatus | 'ALL') => queryOptions({
  queryKey: user ? queryKeys.singingList(user.id, filter) : queryKeys.signedOut('singing-list', filter),
  queryFn: () => request<SingingListEntry[]>(filter === 'ALL' ? '/api/me/singing-list' : `/api/me/singing-list?status=${filter}`),
  enabled: Boolean(user),
  retry: false
});

export const listSettingsQueryOptions = (user: AuthUser | null) => queryOptions({
  queryKey: user ? queryKeys.listSettings(user.id) : queryKeys.signedOut('list-settings'),
  queryFn: () => request<ListSettings>('/api/me/list-settings'),
  enabled: Boolean(user),
  retry: false
});

export const publicProfileQueryOptions = (username: string) => queryOptions({
  queryKey: queryKeys.publicProfile(username),
  queryFn: () => request<PublicProfile>(`/api/users/${encodeURIComponent(username)}`),
  retry: false
});

export const publicTopListQueryOptions = (username: string, enabled: boolean) => queryOptions({
  queryKey: queryKeys.publicTopList(username),
  queryFn: () => request<TopListEntry[]>(`/api/users/${encodeURIComponent(username)}/top-list`),
  enabled,
  retry: false
});

export const publicSingingListQueryOptions = (username: string, enabled: boolean) => queryOptions({
  queryKey: queryKeys.publicSingingList(username),
  queryFn: () => request<PublicSingingListEntry[]>(`/api/users/${encodeURIComponent(username)}/singing-list`),
  enabled,
  retry: false
});
```

- [x] **Step 2: Replace the inline definitions in `App.tsx`**

Delete the local `queryKeys` object and `getRankingPath` function. Import from `./queries` instead, and rewrite each `useQuery` call to spread its options factory. For example:

```tsx
const sessionQuery = useQuery(sessionQueryOptions());
const rankingsQuery = useQuery(rankingsQueryOptions());
const songsQuery = useQuery(songsQueryOptions());
const rankingQuery = useQuery(rankingQueryOptions(rankingId, query, artistFilter, releaseYearFilter));
const topQuery = useQuery(topListQueryOptions(user));
const singingQuery = useQuery(singingListQueryOptions(user, filter));
const settingsQuery = useQuery(listSettingsQueryOptions(user));
```

And in `PublicProfilePage`:

```tsx
const profileQuery = useQuery(publicProfileQueryOptions(username));
const profile = profileQuery.data;
const topQuery = useQuery(publicTopListQueryOptions(username, profile?.lists.topList === 'PUBLIC'));
const singingQuery = useQuery(publicSingingListQueryOptions(username, profile?.lists.singingList === 'PUBLIC'));
```

- [x] **Step 3: Verify behavior is unchanged**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS, same count as Task 1 Step 1. The existing test `keeps personal endpoints disabled for anonymous visitors` asserts no `/api/me/*` request fires while signed out, which is exactly the `enabled` wiring this task moved.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/queries.ts apps/web/src/App.tsx
git commit -m "refactor: share query options between components and future guards"
```

---

## Task 3: Introduce the router with the current two pages

The router replaces the `pathname` regex. Page composition does not change yet, so any failure in this task is attributable to routing alone.

**Files:**
- Create: `apps/web/src/router.tsx`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/index.tsx`, `apps/web/src/routes/u.$username.tsx`, `apps/web/src/test/renderRoute.tsx`
- Modify: `apps/web/src/main.tsx`, `apps/web/src/App.test.tsx`, `apps/web/package.json`
- Delete: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `Brand`, `AccountActions` (Task 1); every `*QueryOptions` factory (Task 2).
- Produces:
  - `export interface RouterContext { queryClient: QueryClient }`
  - `export function createAppRouter(queryClient: QueryClient, history?: RouterHistory)`
  - `export function renderRoute(options: { path?: string; fetch: (path: string, init?: RequestInit) => Promise<Response> }): { client: QueryClient; fetchMock: Mock; router: ReturnType<typeof createAppRouter> }`

- [x] **Step 1: Add the dependencies**

```bash
npm install --workspace @music-rank/web @tanstack/react-router@^1.170.35 zod@^4.1.12
```

`zod` is declared explicitly rather than relied on through workspace hoisting from `@music-rank/contracts`; it is used directly by Task 9.

- [x] **Step 2: Write the failing routing test**

Replace the whole of `apps/web/src/App.test.tsx` with `apps/web/src/routes/routing.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { renderRoute } from '../test/renderRoute';
import { theme } from '../theme';

afterEach(cleanup);

describe('client routing', () => {
  it('renders the ranking at the root path', async () => {
    const { client, router } = renderRoute({
      path: '/',
      fetch: (path) => {
        if (path === '/api/auth/session') return jsonResponse({ user: null });
        if (path === '/api/rankings' || path === '/api/songs') return jsonResponse([]);
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'Music Rank' })).toBeVisible();
  });

  it('renders the public profile at /u/:username without the account actions', async () => {
    const { client, router } = renderRoute({
      path: '/u/listener_1',
      fetch: (path) => {
        if (path === '/api/users/listener_1') return jsonResponse({ username: 'listener_1', displayName: 'Listener One', lists: { topList: 'PUBLIC', singingList: 'PRIVATE' } });
        if (path === '/api/users/listener_1/top-list') return jsonResponse([{ id: 'song-1', title: '涛声依旧', artist: '毛宁', releaseYear: 1993, position: 1 }]);
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('heading', { name: 'Listener One' })).toBeVisible();
    expect(await screen.findByRole('region', { name: 'Top 10' })).toHaveTextContent('涛声依旧');
    expect(screen.queryByRole('region', { name: 'Singing List' })).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}
```

- [x] **Step 3: Run it to verify it fails**

Run: `npm run test --workspace @music-rank/web -- routing`
Expected: FAIL — `Cannot find module '../test/renderRoute'`.

- [x] **Step 4: Create the test helper `apps/web/src/test/renderRoute.tsx`**

```tsx
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory } from '@tanstack/react-router';
import { vi } from 'vitest';
import { createAppRouter } from '../router';

export function renderRoute({ path = '/', fetch }: { path?: string; fetch: (path: string, init?: RequestInit) => Promise<Response> }) {
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => fetch(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(client, createMemoryHistory({ initialEntries: [path] }));
  return { client, fetchMock, router };
}
```

- [x] **Step 5: Create `apps/web/src/routes/__root.tsx`**

Move `HomePage`'s shell markup here; the page body stays in `index.tsx` for now by rendering `<Outlet />`. Copy `SignedOutPanel`, `AccountLoadingPanel`, and `VisibilityStatus` usage into `index.tsx` unchanged — they are removed in Task 7.

```tsx
import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, CssBaseline, Stack, Typography } from '@mui/material';

export interface RouterContext { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound
});

function RootLayout() {
  return <><CssBaseline /><Outlet /></>;
}

function NotFound() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <Box component="main" sx={{ py: 10, textAlign: 'center' }}>
    <Typography variant="h1" fontSize="2rem">Page not found</Typography>
    <Alert severity="info" sx={{ my: 3, justifyContent: 'center' }}>No page exists at {pathname}.</Alert>
    <Stack alignItems="center"><Button variant="contained" href="/">Back to the ranking</Button></Stack>
  </Box>;
}
```

The layout stays this thin in Task 3 on purpose. `Brand`, `TabNav`, the auth dialog, and the snackbar move up in Task 4, after routing itself is proven.

- [x] **Step 6: Create `apps/web/src/routes/index.tsx` and `apps/web/src/routes/u.$username.tsx`**

Move the `HomePage` function body verbatim from `App.tsx` into `index.tsx`, and `PublicProfilePage` into `u.$username.tsx`. Neither body changes; only the export shape does. In `index.tsx`:

```tsx
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });

function HomePage() { /* body moved verbatim from App.tsx */ }
```

In `u.$username.tsx`, take the username from route params instead of a prop:

```tsx
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';

export const Route = createRoute({ getParentRoute: () => rootRoute, path: '/u/$username', component: PublicProfilePage });

function PublicProfilePage() {
  const { username } = Route.useParams();
  /* remaining body moved verbatim from App.tsx */
}
```

The `try`/`catch` around `decodeURIComponent` in the old `App.tsx` is dropped: TanStack Router decodes path parameters and never hands the component a malformed escape sequence.

- [x] **Step 7: Create `apps/web/src/router.tsx`**

```tsx
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Route as rootRoute } from './routes/__root';
import { Route as indexRoute } from './routes/index';
import { Route as publicProfileRoute } from './routes/u.$username';

const routeTree = rootRoute.addChildren([indexRoute, publicProfileRoute]);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({ routeTree, context: { queryClient }, history, defaultPreload: false });
}

declare module '@tanstack/react-router' {
  interface Register { router: ReturnType<typeof createAppRouter> }
}
```

- [x] **Step 8: Rewrite `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './router';
import { theme } from './theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const router = createAppRouter(queryClient);
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider theme={theme}><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider></StrictMode>);
```

- [x] **Step 9: Delete `App.tsx` and run the tests**

```bash
git rm apps/web/src/App.tsx apps/web/src/App.test.tsx
```

Run: `npm run test --workspace @music-rank/web`
Expected: PASS, including both new routing tests.

- [x] **Step 10: Verify in the browser**

Run: `npm run dev`, open `http://localhost:5173/`, then `http://localhost:5173/u/<a public username>`, then press Back.
Expected: the ranking renders, the profile renders, Back returns to the ranking without a full page reload.

- [x] **Step 11: Commit**

```bash
git add apps/web/src apps/web/package.json package-lock.json
git commit -m "feat: replace pathname matching with a TanStack Router route tree"
```

---

## Task 4: Move shell state into the root layout

**Files:**
- Create: `apps/web/src/shell/AppShellContext.tsx`
- Modify: `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/index.tsx`
- Test: `apps/web/src/shell/AppShellContext.test.tsx`

**Interfaces:**
- Consumes: `Brand`, `AccountActions` (Task 1); `sessionQueryOptions`, `listSettingsQueryOptions`, `queryKeys` (Task 2).
- Produces:
  - `export interface AppShell { user: AuthUser | null; isSessionLoading: boolean; requireUser: (action: () => void) => void; openAuth: (mode: AuthMode) => void; notify: (severity: 'success' | 'error', message: string) => void; mutate: (path: string, options?: RequestInit) => void; setVisibility: (listType: 'top-list' | 'singing-list', visibility: ListVisibility) => void; isVisibilityPending: boolean; }`
  - `export function useAppShell(): AppShell` — throws `Error('useAppShell must be used inside AppShellProvider')` when no provider is mounted.
  - `export function AppShellProvider({ children }: { children: ReactNode }): JSX.Element`

- [x] **Step 1: Write the failing test**

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAppShell } from './AppShellContext';

afterEach(cleanup);

function Probe() {
  useAppShell();
  return <p>rendered</p>;
}

describe('useAppShell', () => {
  it('fails loudly when used outside the provider', () => {
    expect(() => render(<Probe />)).toThrowError('useAppShell must be used inside AppShellProvider');
    expect(screen.queryByText('rendered')).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npm run test --workspace @music-rank/web -- AppShellContext`
Expected: FAIL — `Cannot find module './AppShellContext'`.

- [x] **Step 3: Create `apps/web/src/shell/AppShellContext.tsx`**

Move these out of `index.tsx` unchanged in behavior: `authDialog` and `notice` state, `sessionQuery`, `clearPersonalData`, `loseAuthentication`, the 401 `useEffect`, `authMutation`, `openAuth`, `logoutMutation`, `invalidatePersonalLists`, `mutation`, `visibilityMutation`, and `requireUser`. The provider renders `Brand`, `AuthDialog`, `Snackbar`, and `children`.

```tsx
const AppShellContext = createContext<AppShell | null>(null);

export function useAppShell(): AppShell {
  const value = useContext(AppShellContext);
  if (!value) throw new Error('useAppShell must be used inside AppShellProvider');
  return value;
}
```

The context value is memoized with `useMemo` keyed on `user`, `sessionQuery.isLoading`, and `visibilityMutation.isPending`, so page components do not re-render on every unrelated shell state change.

- [x] **Step 4: Wrap `<Outlet />` in `__root.tsx`**

```tsx
function RootLayout() {
  return <><CssBaseline /><AppShellProvider><Outlet /></AppShellProvider></>;
}
```

Remove `<CssBaseline />` and `<Brand ... />` from `index.tsx` and `u.$username.tsx`; both now inherit them from the layout. `u.$username.tsx` keeps its own `Brand` action ("Back to ranking") by rendering its own `Brand` — see Task 8 Step 6, which makes the layout skip its chrome on that route.

- [x] **Step 5: Consume the context in `index.tsx`**

```tsx
const { user, isSessionLoading, requireUser, notify, mutate, setVisibility, isVisibilityPending } = useAppShell();
```

- [x] **Step 6: Run the tests**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS, including the new `useAppShell` test and both Task 3 routing tests.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/shell apps/web/src/routes
git commit -m "refactor: own shell state in the root layout route"
```

---

## Task 5: Add the guarded /personal route

**Files:**
- Create: `apps/web/src/routes/personal.tsx`, `apps/web/src/routes/personal.test.tsx`
- Modify: `apps/web/src/router.tsx`, `apps/web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `sessionQueryOptions`, `topListQueryOptions`, `listSettingsQueryOptions` (Task 2); `useAppShell` (Task 4).
- Produces: `Route` for `/personal`; a `signin` search parameter on `/` that other guards reuse.

- [x] **Step 1: Write the failing tests**

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { renderRoute } from '../test/renderRoute';
import { theme } from '../theme';

afterEach(cleanup);

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
        if (path === '/api/rankings' || path === '/api/songs') return jsonResponse([]);
        throw new Error(`Unexpected request: ${path}`);
      }
    });
    render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
    expect(await screen.findByRole('dialog', { name: 'Sign in to Music Rank' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
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
```

- [x] **Step 2: Run to verify they fail**

Run: `npm run test --workspace @music-rank/web -- personal`
Expected: FAIL — the router has no `/personal` route, so the not-found component renders.

- [x] **Step 3: Declare the `signin` search parameter on `/`**

In `routes/index.tsx`:

```tsx
import { z } from 'zod';

const rankingSearchSchema = z.object({
  signin: z.boolean().optional().catch(undefined)
});

export type RankingSearch = z.infer<typeof rankingSearchSchema>;

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): RankingSearch => rankingSearchSchema.parse(search)
});
```

`validateSearch` drops parameters the schema does not declare, so `signin` must be declared here for the guard's redirect to survive. Per-field `.catch(undefined)` means one malformed value degrades that field alone instead of discarding the whole search object.

In `HomePage`, open the dialog once and clear the flag so it does not persist in the address bar or a shared link:

```tsx
const { signin } = Route.useSearch();
const navigate = Route.useNavigate();
useEffect(() => {
  if (!signin) return;
  openAuth('login');
  void navigate({ search: (current) => ({ ...current, signin: undefined }), replace: true });
}, [signin]);
```

- [x] **Step 4: Create `apps/web/src/routes/personal.tsx`**

```tsx
import { createRoute, redirect } from '@tanstack/react-router';
import { Box, Container } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Route as rootRoute } from './__root';
import { listSettingsQueryOptions, sessionQueryOptions, topListQueryOptions } from '../queries';
import { TopListPanel } from '../components/TopListPanel';
import { VisibilityControl, VisibilityStatus } from '../components/VisibilityControl';
import { useAppShell } from '../shell/AppShellContext';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/personal',
  component: PersonalRankingPage,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.user) throw redirect({ to: '/', search: { signin: true } });
  }
});

function PersonalRankingPage() {
  const { user, notify, mutate, setVisibility, isVisibilityPending } = useAppShell();
  const topQuery = useQuery(topListQueryOptions(user));
  const settingsQuery = useQuery(listSettingsQueryOptions(user));
  const settings = settingsQuery.data ?? { topList: 'PRIVATE' as const, singingList: 'PRIVATE' as const };
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';
  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl">
    <TopListPanel
      entries={topQuery.data ?? []}
      onReorder={(orderedSongIds) => mutate('/api/me/top-list/order', { method: 'PATCH', body: JSON.stringify({ orderedSongIds }) })}
      onRemove={(songId) => mutate(`/api/me/top-list/items/${songId}`, { method: 'DELETE' })}
      statusLabel={<VisibilityStatus label="Top 10" visibility={settings.topList} />}
      headerAction={<VisibilityControl label="Top 10" visibility={settings.topList} publicUrl={publicUrl} disabled={isVisibilityPending} onChange={(visibility) => setVisibility('top-list', visibility)} onShareComplete={(method) => notify('success', method === 'shared' ? 'Public profile shared' : 'Public profile link copied')} />}
    />
  </Container></Box>;
}
```

- [x] **Step 5: Register the route**

In `router.tsx`, import `Route as personalRoute` from `./routes/personal` and add it to `rootRoute.addChildren([indexRoute, personalRoute, publicProfileRoute])`.

- [x] **Step 6: Run the tests**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS, including both `/personal` tests.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/routes apps/web/src/router.tsx
git commit -m "feat: add the guarded personal ranking route"
```

---

## Task 6: Add the guarded /practice route

**Files:**
- Create: `apps/web/src/routes/practice.tsx`, `apps/web/src/routes/practice.test.tsx`
- Modify: `apps/web/src/router.tsx`

**Interfaces:**
- Consumes: `sessionQueryOptions`, `singingListQueryOptions`, `listSettingsQueryOptions` (Task 2); `useAppShell` (Task 4); the `signin` search parameter (Task 5).
- Produces: `Route` for `/practice`.

- [x] **Step 1: Write the failing tests**

Same shape as Task 5 Step 1, with these differences: the path is `/practice`; the authenticated case stubs `/api/me/singing-list` returning `[]` and `/api/me/list-settings`; the authenticated assertion is `expect(await screen.findByRole('heading', { name: 'My Singing List' })).toBeVisible()`; and `expect(router.state.location.pathname).toBe('/practice')`.

The heading is still "My Singing List" at this point. Task 10 renames it and updates this assertion to "My Practice Library".

- [x] **Step 2: Run to verify they fail**

Run: `npm run test --workspace @music-rank/web -- practice`
Expected: FAIL — no `/practice` route exists.

- [x] **Step 3: Create `apps/web/src/routes/practice.tsx`**

```tsx
import { createRoute, redirect } from '@tanstack/react-router';
import { Box, Container } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Route as rootRoute } from './__root';
import { listSettingsQueryOptions, sessionQueryOptions, singingListQueryOptions } from '../queries';
import { SingingListPanel } from '../components/SingingListPanel';
import { VisibilityControl, VisibilityStatus } from '../components/VisibilityControl';
import { useAppShell } from '../shell/AppShellContext';
import type { SingingStatus } from '../api';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice',
  component: PracticeLibraryPage,
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.user) throw redirect({ to: '/', search: { signin: true } });
  }
});

function PracticeLibraryPage() {
  const { user, notify, mutate, setVisibility, isVisibilityPending } = useAppShell();
  const [filter, setFilter] = useState<SingingStatus | 'ALL'>('ALL');
  const singingQuery = useQuery(singingListQueryOptions(user, filter));
  const settingsQuery = useQuery(listSettingsQueryOptions(user));
  const settings = settingsQuery.data ?? { topList: 'PRIVATE' as const, singingList: 'PRIVATE' as const };
  const publicUrl = user ? `${window.location.origin}/u/${user.username}` : '';
  return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl">
    <SingingListPanel
      entries={singingQuery.data ?? []}
      filter={filter}
      onFilterChange={setFilter}
      onSave={(songId, status, note) => mutate(`/api/me/singing-list/items/${songId}`, { method: 'PUT', body: JSON.stringify({ status, note }) })}
      onRemove={(songId) => mutate(`/api/me/singing-list/items/${songId}`, { method: 'DELETE' })}
      statusLabel={<VisibilityStatus label="Singing List" visibility={settings.singingList} />}
      headerAction={<VisibilityControl label="Singing List" visibility={settings.singingList} publicUrl={publicUrl} privateNotes disabled={isVisibilityPending} onChange={(visibility) => setVisibility('singing-list', visibility)} onShareComplete={(method) => notify('success', method === 'shared' ? 'Public profile shared' : 'Public profile link copied')} />}
    />
  </Container></Box>;
}
```

The `label` values stay "Singing List" here and change in Task 10, so this task's diff is routing only.

- [x] **Step 4: Register the route**

In `router.tsx`, add `practiceRoute` to `rootRoute.addChildren([indexRoute, personalRoute, practiceRoute, publicProfileRoute])`.

- [x] **Step 5: Run the tests**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/routes apps/web/src/router.tsx
git commit -m "feat: add the guarded practice library route"
```

---

## Task 7: Make the ranking page full width

**Files:**
- Modify: `apps/web/src/routes/index.tsx`
- Test: `apps/web/src/routes/index.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4–6.
- Produces: a ranking page with no personal-list column. `SignedOutPanel` and `AccountLoadingPanel` cease to exist.

- [x] **Step 1: Write the failing test**

```tsx
it('renders the ranking full width with no personal list column', async () => {
  const { client, router } = renderRoute({
    path: '/',
    fetch: (path) => {
      if (path === '/api/auth/session') return jsonResponse({ user });
      if (path === '/api/rankings') return jsonResponse([{ id: 'ranking-1', title: '90s', era: '1990s', sourceType: 'DEMO', description: null }]);
      if (path === '/api/songs') return jsonResponse([]);
      if (path.startsWith('/api/rankings/ranking-1')) return jsonResponse({ id: 'ranking-1', title: '90s', era: '1990s', sourceType: 'DEMO', description: null, sourceUrl: null, entries: [] });
      throw new Error(`Unexpected request: ${path}`);
    }
  });
  render(<ThemeProvider theme={theme}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></ThemeProvider>);
  expect(await screen.findByRole('heading', { name: '90s' })).toBeVisible();
  expect(screen.queryByRole('region', { name: 'My Top 10' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'My Singing List' })).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/');
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npm run test --workspace @music-rank/web -- index`
Expected: FAIL — both personal regions are still in the document.

- [x] **Step 3: Strip the second column out of `index.tsx`**

Replace the two-column grid with a single full-width panel:

```tsx
return <Box component="main" sx={{ py: { xs: 2, md: 4 } }}><Container maxWidth="xl"><Stack spacing={2}>
  {sessionQuery.isError && <Alert severity="warning">Account status could not be loaded. Public rankings are still available.</Alert>}
  <RankingPanel ranking={rankingQuery.data} isLoading={rankingsQuery.isLoading || rankingQuery.isLoading} query={query} onQueryChange={setQuery} artistFilter={artistFilter} onArtistFilterChange={setArtistFilter} releaseYearFilter={releaseYearFilter} onReleaseYearFilterChange={setReleaseYearFilter} artists={artists} releaseYears={releaseYears} topSongIds={topSongIds} singingSongIds={singingSongIds} topAtCapacity={topEntries.length >= 10} onAddTop={addTop} onAddSinging={addSinging} />
</Stack></Container></Box>;
```

`topSongIds`, `singingSongIds`, and `topAtCapacity` still come from `topListQueryOptions` and `singingListQueryOptions`, because `RankingPanel` uses them to disable already-added songs. Those queries stay `enabled: Boolean(user)`, so anonymous visitors still issue no `/api/me/*` request.

Delete the `SignedOutPanel` and `AccountLoadingPanel` functions and their `LockOutlineIcon` import. Neither is reachable: the column is gone, Task 8 hides the personal tabs from anonymous visitors, and Tasks 5–6 redirect direct navigation.

- [x] **Step 4: Run the tests**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/routes/index.tsx apps/web/src/routes/index.test.tsx
git commit -m "feat: render the ranking full width"
```

---

## Task 8: Add the responsive tab bar

**Files:**
- Create: `apps/web/src/components/TabNav.tsx`, `apps/web/src/components/TabNav.test.tsx`
- Modify: `apps/web/src/shell/AppShellContext.tsx`, `apps/web/src/routes/u.$username.tsx`

**Interfaces:**
- Consumes: `useAppShell` (Task 4); the `/personal` and `/practice` routes (Tasks 5–6).
- Produces: `export function TabNav(): JSX.Element | null`

- [x] **Step 1: Write the failing tests**

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { renderRoute } from '../test/renderRoute';
import { theme } from '../theme';

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

const user = { id: 'user-1', username: 'listener_1', displayName: 'Listener One' };

function renderAt(path: string, session: { user: typeof user | null }) {
  const { client, router } = renderRoute({
    path,
    fetch: (requestPath) => {
      if (requestPath === '/api/auth/session') return jsonResponse(session);
      if (requestPath === '/api/rankings' || requestPath === '/api/songs' || requestPath === '/api/me/top-list' || requestPath === '/api/me/singing-list') return jsonResponse([]);
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
```

- [x] **Step 2: Run to verify they fail**

Run: `npm run test --workspace @music-rank/web -- TabNav`
Expected: FAIL — `Cannot find module './TabNav'`.

- [x] **Step 3: Create `apps/web/src/components/TabNav.tsx`**

```tsx
import { Box, Container, Tab, Tabs } from '@mui/material';
import { Link, useRouterState } from '@tanstack/react-router';
import { useAppShell } from '../shell/AppShellContext';

const tabs = [
  { to: '/', short: 'Ranking', full: 'The Ranking', personal: false },
  { to: '/personal', short: 'Personal', full: 'Personal Ranking', personal: true },
  { to: '/practice', short: 'Practice', full: 'Practice Library', personal: true }
] as const;

function Label({ short, full }: { short: string; full: string }) {
  return <>
    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{short}</Box>
    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{full}</Box>
  </>;
}

export function TabNav() {
  const { user } = useAppShell();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const visible = tabs.filter((tab) => !tab.personal || user);
  const current = visible.some((tab) => tab.to === pathname) ? pathname : '/';
  return <Box component="nav" aria-label="Primary" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
    <Container maxWidth="xl">
      <Tabs value={current} variant="fullWidth" textColor="primary" indicatorColor="primary" sx={{ minHeight: 52, '& .MuiTabs-flexContainer': { justifyContent: { sm: 'flex-start' } }, '& .MuiTab-root': { minHeight: 52, textTransform: 'none', fontWeight: 700, flex: { sm: '0 0 auto' }, px: { sm: 2.5 } } }}>
        {visible.map((tab) => <Tab key={tab.to} value={tab.to} component={Link} to={tab.to} label={<Label short={tab.short} full={tab.full} />} />)}
      </Tabs>
    </Container>
  </Box>;
}
```

`variant="fullWidth"` is always set; the `sm` breakpoint overrides `flex` on each tab so the row collapses to its natural width and left-aligns from 600px up. This keeps a single `Tabs` instance across breakpoints rather than swapping variants, which would remount the tab list. `useMediaQuery` is deliberately not used: it returns `false` on the first render, which would flash the short label on desktop.

`current` falls back to `/` when the pathname matches no visible tab, because MUI warns when `Tabs` receives a `value` that no `Tab` declares.

- [x] **Step 4: Render it in the shell, except on the public profile**

In `AppShellContext.tsx`, render `<Brand action={...} />` then `<TabNav />` above `{children}`. Give `TabNav` a stable box height so the row does not resize when the two personal tabs appear after the session resolves — the `minHeight: 52` above applies in both states because the container renders even with one tab.

`u.$username.tsx` must not show either the shell's `Brand` or the tab bar. Add a `chrome` prop to the provider and set it from the root layout:

```tsx
function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPublicProfile = pathname.startsWith('/u/');
  return <><CssBaseline /><AppShellProvider chrome={!isPublicProfile}><Outlet /></AppShellProvider></>;
}
```

When `chrome` is `false`, the provider renders `children` plus the dialog and snackbar, but neither `Brand` nor `TabNav`. `u.$username.tsx` keeps rendering its own `Brand` with the "Back to ranking" action, as it does today.

- [x] **Step 5: Run the tests**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS.

- [x] **Step 6: Check both breakpoints in the browser**

Run `npm run dev`, sign in, then in DevTools device mode:
- At 375px: three equal-width tabs read Ranking / Personal / Practice with no horizontal scrollbar.
- At 1280px: three left-aligned tabs read the full labels.
- Sign out: only The Ranking remains, and the bar keeps its height.
- Middle-click "Personal Ranking": it opens in a new tab at `/personal`.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/components/TabNav.tsx apps/web/src/components/TabNav.test.tsx apps/web/src/shell/AppShellContext.tsx apps/web/src/routes/__root.tsx apps/web/src/routes/u.$username.tsx
git commit -m "feat: add the responsive primary tab navigation"
```

---

## Task 9: Move the ranking filters into URL search parameters

**Files:**
- Modify: `apps/web/src/routes/index.tsx`
- Test: `apps/web/src/routes/index.test.tsx`

**Interfaces:**
- Consumes: the `signin` parameter and `validateSearch` wiring from Task 5.
- Produces: `RankingSearch = { q?: string; artist?: string; year?: number; signin?: boolean }`

- [x] **Step 1: Write the failing tests**

```tsx
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
```

`rankingFetch` is the same stub used in Task 7 Step 1, extracted to a module-level function in this file.

- [x] **Step 2: Run to verify they fail**

Run: `npm run test --workspace @music-rank/web -- index`
Expected: FAIL — filters are still React state, so `router.state.location.search` stays empty.

- [x] **Step 3: Extend the schema**

```tsx
const rankingSearchSchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  artist: z.string().trim().min(1).optional().catch(undefined),
  year: z.coerce.number().int().min(1900).max(2100).optional().catch(undefined),
  signin: z.boolean().optional().catch(undefined)
});
```

- [x] **Step 4: Replace the three `useState` calls with search-parameter reads and writes**

```tsx
const { q, artist, year } = Route.useSearch();
const navigate = Route.useNavigate();
const query = q ?? '';
const artistFilter = artist ?? 'ALL';
const releaseYearFilter = year ?? 'ALL';
const setSearch = (patch: Partial<RankingSearch>) =>
  void navigate({ search: (current) => ({ ...current, ...patch }), replace: true });
const setQuery = (value: string) => setSearch({ q: value || undefined });
const setArtistFilter = (value: string) => setSearch({ artist: value === 'ALL' ? undefined : value });
const setReleaseYearFilter = (value: number | 'ALL') => setSearch({ year: value === 'ALL' ? undefined : value });
```

Assigning `undefined` removes the parameter from the URL rather than serializing an empty value, so a cleared filter returns the address to exactly `/`. `replace: true` keeps each keystroke from pushing a history entry.

`RankingPanel`'s props are unchanged: it still receives `query`, `onQueryChange`, `artistFilter`, `onArtistFilterChange`, `releaseYearFilter`, and `onReleaseYearFilterChange` with the same types.

- [x] **Step 5: Run the tests**

Run: `npm run test --workspace @music-rank/web`
Expected: PASS.

- [x] **Step 6: Verify in the browser**

Open `http://localhost:5173/?q=%E9%82%A3%E8%8B%B1&year=1993`. The search field shows 那英 and the year filter shows 1993. Clear both; the address returns to `/`. Press Back once; you leave the ranking rather than stepping back through each keystroke.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/routes/index.tsx apps/web/src/routes/index.test.tsx
git commit -m "feat: keep ranking filters in validated URL search parameters"
```

---

## Task 10: Rename the singing list to Practice Library in user-facing copy

Spec section 10 lists the copy changes. Two occurrences found during planning are not in that table and are included here: a button pair in `RankingPanel` and one API error message. Both are user-facing strings, so acceptance criterion 6 covers them.

**Files:**
- Modify: `apps/web/src/components/SingingListPanel.tsx:51,92,97`, `apps/web/src/components/RankingPanel.tsx:88`, `apps/web/src/components/VisibilityControl.tsx:65`, `apps/web/src/routes/practice.tsx`, `apps/web/src/routes/u.$username.tsx`, `apps/api/src/services.ts:166`
- Test: `apps/web/src/routes/practice.test.tsx`, `apps/web/src/components/VisibilityControl.test.tsx`, `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: every route from Tasks 5–8.
- Produces: no new exports. `SingingListPanel`, the `singing-list` API paths, the `SINGING_LIST` enum, the `singing_list_entries` table, and the `singingList` settings field are all unchanged.

| Location | Before | After |
| --- | --- | --- |
| `SingingListPanel.tsx:92` | `My Singing List` | `My Practice Library` |
| `SingingListPanel.tsx:51` | `Remove ${entry.title} from My Singing List` | `Remove ${entry.title} from My Practice Library` |
| `SingingListPanel.tsx:97` | `Filter singing list by status` | `Filter practice library by status` |
| `RankingPanel.tsx:88` | `In Singing List` / `Add Singing` | `In Practice Library` / `Add Practice` |
| `VisibilityControl.tsx:65` | `Your Singing List notes always remain private.` | `Your Practice Library notes always remain private.` |
| `practice.tsx` | `label="Singing List"` (both usages) | `label="Practice Library"` |
| `u.$username.tsx` | `Singing List` heading | `Practice Library` |
| `services.ts:166` | `Song is not in My Singing List` | `Song is not in My Practice Library` |

- [x] **Step 1: Update the assertions first**

In `practice.test.tsx`, change the authenticated assertion to `screen.findByRole('heading', { name: 'My Practice Library' })`. In `VisibilityControl.test.tsx`, replace the three `Singing List` label fixtures with `Practice Library`. In `apps/api/src/app.test.ts`, update any assertion on the `SINGING_LIST_ITEM_NOT_FOUND` message text.

- [x] **Step 2: Run to verify they fail**

Run: `npm run test --workspace @music-rank/web && npm run test --workspace @music-rank/api`
Expected: FAIL on the renamed assertions.

- [x] **Step 3: Apply every replacement in the table**

The error code `SINGING_LIST_ITEM_NOT_FOUND` does not change — it is a contract consumed by the client; only its human-readable message does.

- [x] **Step 4: Verify no user-facing occurrence remains**

```bash
grep -rn "Singing List" apps packages e2e --include=*.ts --include=*.tsx
```

Expected: no matches outside identifiers such as `SingingListPanel`, `SingingListEntry`, `singingListQueryOptions`, and `SINGING_LIST_ITEM_NOT_FOUND`.

- [x] **Step 5: Run the tests**

Run: `npm run test --workspace @music-rank/web && npm run test --workspace @music-rank/api`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/web/src apps/api/src
git commit -m "feat: rename the singing list to Practice Library in user-facing copy"
```

---

## Task 11: Update the end-to-end flow and verify the whole system

**Files:**
- Modify: `e2e/music-rank.spec.ts:21,39-57,64`

**Interfaces:**
- Consumes: every task above.
- Produces: nothing consumed by later tasks; this is the final gate.

- [x] **Step 1: Update the spec for the new navigation**

Four changes:

1. Delete line 21's `expect(page.getByRole('heading', { name: 'Your lists are private to you' }))` — `SignedOutPanel` no longer exists. Replace it with a check that the personal tabs are hidden while anonymous:

```ts
await expect(page.getByRole('tab', { name: /Personal Ranking/ })).toHaveCount(0);
```

2. After signing in (line 36), assert the tabs appeared:

```ts
await expect(page.getByRole('tab', { name: /Personal Ranking/ })).toBeVisible();
```

3. `Add Singing` at line 41 becomes `Add Practice`. Before the assertions that were on lines 47–49, navigate to each destination:

```ts
await page.getByRole('tab', { name: /Personal Ranking/ }).click();
await expect(page).toHaveURL(/\/personal$/);
await expect(page.getByRole('region', { name: 'My Top 10' }).getByText('涛声依旧')).toBeVisible();
await page.getByRole('button', { name: 'Top 10 is private. Make public' }).click();
await page.getByRole('button', { name: 'Make public' }).click();
await expect(page.getByLabel('Top 10 visibility: public')).toBeVisible();

await page.getByRole('tab', { name: /Practice Library/ }).click();
await expect(page).toHaveURL(/\/practice$/);
const singingEntry = page.getByRole('region', { name: 'My Practice Library' }).getByRole('listitem').filter({ hasText: '涛声依旧' });
await expect(singingEntry.getByText('Practicing', { exact: true })).toBeVisible();
await page.getByRole('button', { name: 'Practice Library is private. Make public' }).click();
await expect(page.getByText('Your Practice Library notes always remain private.')).toBeVisible();
await page.getByRole('button', { name: 'Make public' }).click();
await expect(page.getByLabel('Practice Library visibility: public')).toBeVisible();
```

The edit steps at lines 42–45 stay, but they now run on `/practice`, so move them after that tab click.

4. Line 64's public-profile region becomes `{ name: 'Practice Library' }`.

- [x] **Step 2: Add a deep-link and back/forward case**

Append to the spec, after sign-out:

```ts
await page.goto('/personal');
await expect(page).toHaveURL('/');
await expect(page.getByRole('dialog', { name: 'Sign in to Music Rank' })).toBeVisible();
```

- [x] **Step 3: Run the full verification**

```bash
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Expected: all four pass. The database container must be running (`npm run db:up`) and the dev servers must be stopped, since Playwright starts its own.

- [x] **Step 4: Walk the acceptance criteria**

Confirm each of the seven criteria in spec section 14 by hand, including the 375px and 1280px checks and the production-shaped server:

```bash
NODE_ENV=production APP_ORIGIN=http://localhost:3001 PORT=3001 npm run start
```

Then load `/personal` and `/practice` directly against port 3001 to confirm the Express SPA fallback serves them.

- [x] **Step 5: Update the engineering guide**

`docs/ENGINEERING_GUIDE.md` section 1.1 requires updating the guide in the same change as the code. Update the architecture section to describe the route tree, the guard, and the tab bar, and refresh "最后更新日期" and "最后核对的代码提交".

- [x] **Step 6: Commit**

```bash
git add e2e/music-rank.spec.ts docs/ENGINEERING_GUIDE.md
git commit -m "test: cover tab navigation and guarded routes end to end"
```

---

## Self-Review

**Spec coverage.** Spec sections 4 (route table) → Tasks 3, 5, 6; 5 (module structure) → Tasks 1–4, with the `SignedOutPanel` and `AccountLoadingPanel` deletions in Task 7; 6 (state ownership) → Tasks 4, 6, 9; 7 (tab navigation) → Task 8; 8 (search parameters) → Tasks 5, 9; 9 (guard and session timing) → Tasks 5, 6, 8; 10 (terminology) → Task 10; 12 (testing) → every task, with e2e in Task 11; 14 (acceptance criteria) → Task 11 Step 4.

**Deviations from the spec, both intentional.** The spec sketched `validateSearch` as a whole-object `safeParse` fallback; this plan uses per-field `.catch(undefined)` so one malformed parameter does not discard the others, which is what spec section 8 asks for in prose. And spec section 10's table omits `RankingPanel`'s button copy and the `services.ts` error message; Task 10 adds both, since acceptance criterion 6 admits no user-facing exception.

## 变更记录

| 日期 | 作者 | 变更 | Commit |
| --- | --- | --- | --- |
| 2026-09-11 | chance | 初稿：11 个任务，覆盖 DESIGN-002 全部范围 | — |
| 2026-09-11 | chance | 11 个任务全部完成并验证。执行期偏离：① `chrome` 开关从 Task 8 提前到 Task 4，避免公开页出现两个 Brand 的破损中间态；② AppShell 增加 `onUnauthorized`，401 检测留在页面（shell 拿不到页面的 Query 错误）；③ 新增 `router.invalidate()` 让会话页内失效时守卫重新求值，登出改为先导航再清会话，否则刚登出就被要求登录；④ 修复 `playwright.config.ts` 的 Windows 不兼容（POSIX env 前缀改为 `webServer.env`）；⑤ 榜单页去掉 `filter` 状态与 `settingsQuery`，固定以 `ALL` 读取演唱成员集合 | b1f9d98 |
