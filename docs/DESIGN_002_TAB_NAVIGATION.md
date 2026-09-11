---
design_id: DESIGN-002
title: Tab Navigation and Client Routing
status: Draft
author: chance
created: 2026-09-11
updated: 2026-09-11
supersedes: null
related:
  - AUTHENTICATION_DESIGN.md
  - PROJECT_SPEC_EN.md
  - ENGINEERING_GUIDE.md
---

# DESIGN-002 — Tab Navigation and Client Routing

## 1. Approved Scope

Music Rank currently renders every authenticated surface on a single page: a
two-column layout with the public ranking on the left and both personal lists
stacked on the right. This design replaces that layout with three top-level
destinations reachable from a responsive tab bar below the top bar, each with
its own URL.

Approved behavior:

- Three top-level destinations: The Ranking, Personal Ranking, Practice Library.
- Each destination is a full-width page. The right-hand column is removed.
- A tab bar sits directly below the existing top bar and reflects the current
  route. It is not rendered on the public profile page.
- Every destination has a real URL that survives reload, back/forward, and
  sharing.
- Personal Ranking and Practice Library require an authenticated session. Their
  tabs are hidden from anonymous visitors, and direct navigation to their URLs
  redirects to the ranking and opens the sign-in dialog.
- Ranking filters (search text, artist, release year) move from component state
  into validated URL search parameters.
- All user-facing copy for the singing list becomes "Practice Library".

This design does not change the API, the database schema, or any existing
migration.

## 2. Problem Statement

Two facts about the current implementation motivate this work.

The application has no client router. All routing is a single expression at
`apps/web/src/App.tsx:209`:

```ts
const publicProfileMatch = window.location.pathname.match(/^\/u\/([^/]+)\/?$/);
if (!publicProfileMatch) return <HomePage />;
```

This reads `pathname` once at mount. There is no history integration, so
back/forward do nothing, and no in-app navigation can change the URL without a
full page load. The server already serves an SPA fallback in production
(`apps/api/src/index.ts:13`) and the Vite dev server does the same, so deep
links resolve at the network layer. Only the client-side layer is missing.

`apps/web/src/App.tsx` is 216 lines containing `HomePage`, `PublicProfilePage`,
`Brand`, `SignedOutPanel`, `AccountActions`, `VisibilityStatus`, and
`AccountLoadingPanel`. `HomePage` alone owns every query, every mutation, the
auth dialog state, the snackbar state, and all filter state. Splitting the page
into three routes requires splitting this file regardless; the split is part of
this design, not incidental refactoring.

## 3. Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Three independent full-width pages, no persistent side column | Keeps each destination focused; avoids maintaining the same list interaction in two places. |
| D2 | Hide the two personal tabs from anonymous visitors | Navigation shows only what the visitor can act on. Direct URL access is handled by a route guard, not by a disabled control. |
| D3 | TanStack Router | Same ecosystem and documentation conventions as the existing `@tanstack/react-query` dependency. First-class typed search parameters with schema validation, which D6 depends on. |
| D4 | Code-based route tree, not file-based | Four flat routes do not justify adding `@tanstack/router-plugin` and committing a generated `routeTree.gen.ts`. |
| D5 | Equal-width tabs with shortened labels below 600px | All three destinations stay visible at 375px without horizontal scrolling. A scrollable tab bar would clip the third destination and hide its existence. |
| D6 | Ranking filters move into URL search parameters | Filter state becomes shareable and survives reload. The ranking page is already being rewritten for D1, so doing this now avoids revisiting the same file. |
| D7 | "Practice Library" replaces "Singing List" in all user-facing copy | One name for one concept everywhere the user can see it. API paths, database enums, and component identifiers keep `singing`/`SINGING` because those are data contracts. |

## 4. Route Table

| Path | Page | Tab bar | Session required |
| --- | --- | --- | --- |
| `/` | The Ranking | Yes | No |
| `/personal` | Personal Ranking | Yes | Yes |
| `/practice` | Practice Library | Yes | Yes |
| `/u/$username` | Public profile | No | No |

`/u/$username` keeps its existing self-contained header with the "Back to
ranking" action. It is a shareable page for people who may have no account, so
the application's primary navigation does not belong on it.

Unmatched paths render a not-found component that links back to `/`. The
production server's catch-all continues to return `index.html` for these, and
the client decides what to display.

## 5. Module Structure

`apps/web/src/App.tsx` is replaced by the following modules.

| File | Responsibility |
| --- | --- |
| `src/router.tsx` | Route tree, router instance, and the `Register` interface declaration that enables type inference. |
| `src/routes/__root.tsx` | Layout route: top bar, tab bar, `<Outlet />`, auth dialog, snackbar. |
| `src/routes/index.tsx` | The Ranking. Owns search-parameter validation. |
| `src/routes/personal.tsx` | Personal Ranking. Guarded. |
| `src/routes/practice.tsx` | Practice Library. Guarded. |
| `src/routes/u.$username.tsx` | Public profile, moved unchanged from `App.tsx`. |
| `src/shell/AppShellContext.tsx` | Shared shell state and actions provided to route components. |
| `src/components/TabNav.tsx` | Tab bar. |
| `src/components/Brand.tsx` | Top bar, extracted from `App.tsx`. |
| `src/queries.ts` | `queryOptions` factories shared by components and route guards. |

`src/main.tsx` renders `<RouterProvider router={router} />` inside the existing
`QueryClientProvider` and `ThemeProvider`, and passes the query client into the
router context.

The four helper components currently defined inside `App.tsx` resolve as
follows:

| Component | Disposition |
| --- | --- |
| `AccountActions` | Moves to `src/components/AccountActions.tsx`, used by the top bar. |
| `VisibilityStatus` | Moves to `src/components/VisibilityStatus.tsx`, used by both personal pages. |
| `SignedOutPanel` | Deleted. It filled the right column for anonymous visitors; with the column gone, the tabs hidden, and the guard redirecting, no anonymous visitor can reach a surface that would render it. |
| `AccountLoadingPanel` | Deleted. It covered the window where the session was still loading inside the right column. The guards now resolve the session before either personal page renders, so the state it represented no longer exists. |

These five components are not modified, only remounted: `RankingPanel`,
`TopListPanel`, `SingingListPanel`, `VisibilityControl`, `AuthDialog`. Their
props and behavior stay as they are. `SingingListPanel` keeps its filename and
identifier; only its rendered copy changes per D7.

`src/queries.ts` exists because route guards and components must share one
definition of each query. A guard calls `ensureQueryData` with the same
`queryOptions` object a component later passes to `useQuery`, so the guard
populates the cache the component reads.

## 6. State Ownership

`HomePage` currently owns all state. After the split, state moves to the
narrowest scope that needs it.

| State | New owner | Reason |
| --- | --- | --- |
| `sessionQuery` | `__root` | The tab bar, the account action, and both guards depend on it. |
| `authDialog` | `__root` | Opened from the top bar, from `requireUser`, and by the redirect guard. |
| `notice` (snackbar) | `__root` | Mutations on any route report through it. |
| `mutation`, `visibilityMutation`, `logoutMutation` | `__root` | Shared invalidation and 401 handling must stay in one place. |
| `requireUser` | `__root` | Wraps the auth dialog. |
| `query`, `artistFilter`, `releaseYearFilter` | `/` route search params | Only the ranking uses them. See section 8. |
| `filter` (singing status) | `/practice` | Only the practice library uses it. |

Shell state reaches route components through `AppShellContext` rather than
props, because `<Outlet />` sits between the provider and the consumers.
The context exposes a deliberately small surface:

```ts
interface AppShell {
  user: AuthUser | null;
  isSessionLoading: boolean;
  requireUser: (action: () => void) => void;
  openAuth: (mode: AuthMode) => void;
  notify: (severity: 'success' | 'error', message: string) => void;
  mutate: (path: string, options?: RequestInit) => void;
  setVisibility: (listType: ListType, visibility: ListVisibility) => void;
}
```

## 7. Tab Navigation

The tab bar renders directly beneath the top bar and continues its bottom
border, so the two read as one header block. It reuses existing theme tokens
with no new stylesheet and no palette change: `background.default` for the
surface, `primary.main` for the indicator, `divider` for the bottom border,
`textTransform: none` and `fontWeight: 700` for labels.

Responsive behavior:

| Viewport | Variant | Alignment | Labels |
| --- | --- | --- | --- |
| `< 600px` | `fullWidth` | Equal width | Ranking / Personal / Practice |
| `>= 600px` | `standard` | Left | The Ranking / Personal Ranking / Practice Library |

Both label lengths are present in the DOM inside two `<span>` elements whose
`display` is switched by `sx` breakpoints. `useMediaQuery` is not used: it
returns `false` on the first render, which would flash the wrong label.

Each `Tab` renders as `component={Link} to="/personal"`, producing a real
anchor. Modifier-click, middle-click, and "copy link address" therefore behave
as users expect, which a `button` with an `onClick` handler cannot provide.

The selected tab derives from the current pathname through `useRouterState`.
No local selection state exists, so the tab bar cannot disagree with the URL.

Accessibility: the bar is labeled as the primary navigation, the active tab
carries the current-page indication, and the three tabs form one arrow-key
group as MUI's `Tabs` already implements.

## 8. Ranking Search Parameters

`/` validates its search parameters with a zod schema:

```ts
const rankingSearchSchema = z.object({
  q: z.string().trim().min(1).optional(),
  artist: z.string().trim().min(1).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  signin: z.boolean().optional()
});
```

`signin` is declared here, not only in section 9, because `validateSearch`
strips parameters the schema does not know. A redirect carrying an undeclared
parameter would silently lose it and the dialog would never open. The route
clears `signin` with a replacing navigation as soon as the dialog opens, so the
parameter does not persist in the address bar or in a shared link.

Filter changes call `navigate({ search: next, replace: true })`. `replace` keeps
typing in the search field from filling the history stack, so one back press
leaves the ranking rather than stepping through every keystroke.

Invalid or unknown parameters fall back to the schema's defaults instead of
throwing, so a hand-edited or truncated URL degrades to an unfiltered ranking.

Empty filters are omitted from the URL rather than serialized as empty strings,
keeping the default address exactly `/`.

`zod` must be added to `apps/web` dependencies. It currently resolves only
through workspace hoisting from `@music-rank/contracts`, which is an undeclared
dependency. The schema lives in `apps/web` rather than `packages/contracts`,
because `contracts` holds API request contracts shared with the server and URL
search parameters are not part of any API contract.

## 9. Authentication Guard and Session Timing

Three separate concerns, resolved independently.

**Tab visibility.** While the session query is unresolved, the tab bar renders
only The Ranking. The bar's height is fixed across both states so the page
content below it does not shift when the other two tabs appear.

**Direct navigation.** `/personal` and `/practice` each declare:

```ts
beforeLoad: async ({ context }) => {
  const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
  if (!session.user) throw redirect({ to: '/', search: { signin: true } });
}
```

The redirect target opens the auth dialog through the `signin` search
parameter, so an anonymous visitor arriving from a stale bookmark is told what
to do instead of landing on an unexplained ranking page.

**Root does not block.** The guard is declared only on the two personal routes.
`/` and `/u/$username` never await the session, so anonymous first paint is not
delayed by an authentication round trip.

**Session loss during a visit.** The existing 401 handler already clears the
session cache. When that happens on `/personal` or `/practice`, the route
guard re-evaluates and the visitor is redirected to `/`, matching the behavior
of a direct visit.

Returning to the originally requested page after signing in is out of scope.
Sign-in completes on `/`.

## 10. Terminology

Per D7, all user-facing copy uses "Practice Library":

| Location | Before | After |
| --- | --- | --- |
| Tab label | — | Practice Library |
| Page heading | My Singing List | My Practice Library |
| Public profile section | Singing List | Practice Library |
| Visibility control | Singing List is private | Practice Library is private |
| Empty and helper copy | "...Singing List notes..." | "...Practice Library notes..." |

Unchanged, because they are data contracts rather than copy: the
`/api/me/singing-list/*` and `/api/users/:username/singing-list` paths, the
`SINGING_LIST` list-type enum, the `singing_list_entries` table, the
`singingList` field in list settings, and the `SingingListPanel` identifier.

## 11. Out of Scope

- Any API, schema, or migration change.
- Returning to the requested page after sign-in.
- Moving practice-library or personal-ranking state into search parameters.
- Route-level code splitting or lazy loading.
- A dedicated mobile bottom navigation bar.
- Changing `RankingPanel`, `TopListPanel`, `SingingListPanel`,
  `VisibilityControl`, or `AuthDialog` behavior.

## 12. Testing

| Test | Coverage |
| --- | --- |
| `TabNav.test.tsx` (new) | One tab when anonymous; three when authenticated; selected tab follows the pathname; both label lengths present in the DOM. |
| `routes/personal.test.tsx` (new) | Anonymous navigation to `/personal` lands on `/` with the auth dialog open; authenticated navigation renders the top-list panel. |
| `routes/index.test.tsx` (new) | Search parameters populate the filters on load; changing a filter updates the URL; an invalid `year` degrades to unfiltered. |
| `App.test.tsx` (rewritten) | Currently renders `<App />` directly. Becomes a router render over `createMemoryHistory`, covering the shell: top bar, auth dialog, snackbar. |
| `e2e/music-rank.spec.ts` (updated) | Lines 21 and 47–57 assume the ranking and both personal lists share one screen. Tab navigation steps are inserted before the personal-list and visibility assertions. |

The existing component tests for `RankingPanel`, `SingingListPanel`,
`AuthDialog`, and `VisibilityControl` change only where D7 renames rendered
copy.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| The `App.tsx` split touches every surface at once, making regressions hard to attribute. | Extract components before introducing the router, keeping each step independently verifiable. |
| Guard and component could read different session state. | Both use the single `sessionQueryOptions` from `src/queries.ts`. |
| Tab bar appearing after the session resolves shifts page content. | Fixed tab-bar height in both states. |
| Search-parameter navigation floods browser history. | `replace: true` on filter changes. |
| D7 copy changes could miss an occurrence. | Enumerated in section 10; verified by a repository-wide search for the removed strings. |

## 14. Acceptance Criteria

1. `/`, `/personal`, `/practice`, and `/u/<username>` each render their page on
   direct load, on reload, and through back/forward navigation.
2. The tab bar shows one tab when anonymous and three when authenticated, on
   both the development and production servers.
3. At 375px all three tabs are visible without horizontal scrolling; at 1280px
   all three show their full labels, left aligned.
4. Anonymous navigation to `/personal` or `/practice` lands on `/` with the
   sign-in dialog open.
5. `/?q=%E9%82%A3%E8%8B%B1&year=1993` loads the ranking with both filters
   applied; clearing them returns the address to `/`.
6. No user-facing string contains "Singing List".
7. `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e`
   all pass.

## 变更记录

| 日期 | 作者 | 变更 | Commit |
| --- | --- | --- | --- |
| 2026-09-11 | chance | 初稿：三 tab 导航、TanStack Router 客户端路由、榜单筛选进 URL、Practice Library 术语统一 | — |
