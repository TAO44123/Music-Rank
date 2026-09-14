---
plan_id: PLAN-004
title: Mobile Bottom Navigation Implementation Plan
status: Completed
author: chance
created: 2026-09-14
updated: 2026-09-14
implements: DESIGN_004_MOBILE_BOTTOM_NAV.md
related:
  - DESIGN_004_MOBILE_BOTTOM_NAV.md
  - DESIGN_006_RESPONSIVE_PANELS.md
  - DESIGN_002_TAB_NAVIGATION.md
  - ENGINEERING_GUIDE.md
---

# Mobile Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move primary navigation to a fixed bottom bar below 600px while leaving the tab bar unchanged at 600px and above.

**Architecture:** One destination table in `apps/web/src/navigation.ts` feeds both navigation surfaces. `TabNav` and a new `BottomNav` both render at all times and are shown or hidden by a single MUI `sm` breakpoint in `sx` — no `useMediaQuery`, no JavaScript width branch. `BottomNav` renders a guarded destination as a plain button that opens the sign-in dialog rather than as a link, so an anonymous tap never starts a navigation the route guard would bounce back.

**Tech Stack:** React 19, TanStack Router 1.170.x, TanStack Query 5, MUI 7, Vitest 4 + Testing Library, Playwright 1.57.

**Spec:** `docs/DESIGN_004_MOBILE_BOTTOM_NAV.md`

## Global Constraints

- Node 24.21.0, npm 11.19.0 (`package.json` `engines`).
- All source, identifiers, comments, UI copy, test names, and documentation are written in English (`docs/IMPLEMENTATION_HANDOFF.md`). The 变更记录 table at the bottom of each doc is the only exception.
- No API route, database schema, migration, route table, or `beforeLoad` guard changes.
- No change to `theme.ts`. The bottom bar uses existing theme tokens and `theme.zIndex.appBar` only.
- The single breakpoint is MUI's `sm` (600px). No new breakpoint (DESIGN-006 D5, DESIGN-004 D3).
- `@music-rank/contracts` and `@music-rank/database` must be built before `apps/web` typechecks:
  `npm run build --workspace @music-rank/contracts && npm run build --workspace @music-rank/database`
- Run web unit tests with `npm run test --workspace @music-rank/web`.
- Run end-to-end tests with `npm run test:e2e`.
- Every task ends with passing tests and a commit.

## Known baseline issue — read before you start

`npm run test` (all workspaces) fails intermittently on
`apps/web/src/components/TabNav.test.tsx` > `renders every tab as a real anchor
so it can be opened in a new tab`. Measured on 2026-09-14 at commit `3817511`:
2 runs of `npm run test`, 1 failed; 3 runs of `npx vitest run` inside
`apps/web`, all passed; 3 runs of that file alone, all passed. The assertion is
`await screen.findByRole(...)`, whose default timeout is 1000ms, and it only
fails under full-workspace load. `main`'s most recent commit is
`test: stabilize web suite under parallel load`, so this is a known,
unresolved flake.

**It is not caused by this plan.** If that specific test fails during a task,
re-run the file alone before investigating. If any *other* test fails, that is
yours.

## Open question for the spec author — raise before Task 2

`TabNav` filters guarded destinations out for anonymous visitors
(`TabNav.tsx:22`, asserted by `TabNav.test.tsx:38`). DESIGN-004 D4 has
`BottomNav` show all three to anonymous visitors. That is deliberate for the
bottom bar — a one-item bottom bar reads as a button, not as navigation — but
it does leave the two surfaces advertising different destination sets to the
same anonymous visitor: three on a phone, one on a desktop.

This plan implements the spec as written: `TabNav` keeps filtering, `BottomNav`
does not. Flag it to the spec author before Task 2. If they want the surfaces
unified, that is a change to DESIGN-002 D2 or DESIGN-004 D4 and needs a spec
revision, not a decision made here.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/src/navigation.ts` | The destination table and the bottom bar's height. Sole source for both navigation surfaces. | 1 |
| `apps/web/src/components/TabNav.tsx` | Tab bar. Consumes `navigation.ts`; gains the `sm`-and-up breakpoint. | 1, 3 |
| `apps/web/src/components/TabNav.test.tsx` | Existing tab bar tests. Visibility assertions change in Task 3. | 1, 3 |
| `apps/web/src/components/BottomNav.tsx` | Fixed bottom bar, below 600px. | 2, 3 |
| `apps/web/src/components/BottomNav.test.tsx` | Bottom bar behavior that does not depend on the breakpoint. | 2 |
| `apps/web/src/shell/AppShellContext.tsx` | Renders `BottomNav`, reserves space for it, lifts the snackbar above it. | 2, 3 |
| `e2e/responsive.spec.ts` | Breakpoint behavior, which jsdom cannot verify. | 3 |
| `docs/ENGINEERING_GUIDE.md` | Component responsibilities section. | 3 |

---

## Task 1: Extract the destination table

Pure refactor. `TabNav` must behave identically; its existing six tests are the
proof and are not modified in this task.

**Files:**
- Create: `apps/web/src/navigation.ts`
- Modify: `apps/web/src/components/TabNav.tsx:1-9`, `:22`, `:36`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `destinations: readonly Destination[]` and `bottomNavHeight: 56`
  from `apps/web/src/navigation.ts`. `Destination` is
  `{ to: '/' | '/personal' | '/practice'; short: string; full: string; icon: SvgIconComponent; personal: boolean }`.
  Task 2 and Task 3 both import `destinations`; Task 3 imports `bottomNavHeight`.

- [ ] **Step 1: Run the existing tests to establish the baseline**

```bash
npm run test --workspace @music-rank/web -- src/components/TabNav.test.tsx
```

Expected: PASS, 6 tests. These six are the regression net for this task — if
any of them changes behavior later in the task, the refactor was not pure.

- [ ] **Step 2: Create the destination table**

Create `apps/web/src/navigation.ts`:

```ts
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import MicNoneIcon from '@mui/icons-material/MicNone';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import type { SvgIconComponent } from '@mui/icons-material';

export type Destination = {
  to: '/' | '/personal' | '/practice';
  short: string;
  full: string;
  icon: SvgIconComponent;
  /** Requires an authenticated session. `TabNav` hides these from anonymous
      visitors; `BottomNav` shows them and opens the sign-in dialog instead. */
  personal: boolean;
};

// `short` and `full` are the labels DESIGN-002 D5 introduced so all three
// destinations fit at 375px. `icon` is used only by the bottom bar: MicNone is
// already the icon on the ranking row's practice action, so the bar names
// Practice with the icon the visitor has been tapping.
export const destinations: readonly Destination[] = [
  { to: '/', short: 'Ranking', full: 'The Ranking', icon: FormatListNumberedOutlinedIcon, personal: false },
  { to: '/personal', short: 'Personal', full: 'Personal Ranking', icon: StarOutlineIcon, personal: true },
  { to: '/practice', short: 'Practice', full: 'Practice Library', icon: MicNoneIcon, personal: true }
];

// MUI's BottomNavigation height. Defined here because AppShellContext spends it
// in three separate expressions, and a bar whose height disagrees with the space
// reserved for it is the class of bug DESIGN-006 §2.1 traced to a hard-coded
// reserve chasing a layout.
export const bottomNavHeight = 56;
```

- [ ] **Step 3: Point TabNav at the table**

In `apps/web/src/components/TabNav.tsx`, delete the local `tabs` constant
(lines 5-9) and import the table instead. The top of the file becomes:

```tsx
import { Box, Container, Tab, Tabs } from '@mui/material';
import { Link, useRouterState } from '@tanstack/react-router';
import { destinations } from '../navigation';
import { useAppShell } from '../shell/AppShellContext';
```

Then rename the two uses inside `TabNav`:

```tsx
  const visible = destinations.filter((destination) => !destination.personal || user);
  const current = visible.some((destination) => destination.to === pathname) ? pathname : '/';
```

and the map:

```tsx
        {visible.map((destination) => <Tab key={destination.to} value={destination.to} component={Link} to={destination.to} label={<Label short={destination.short} full={destination.full} />} />)}
```

`Label` and the `Tabs` element keep their current definitions untouched.

- [ ] **Step 4: Verify the refactor changed nothing**

```bash
npm run test --workspace @music-rank/web -- src/components/TabNav.test.tsx
```

Expected: PASS, 6 tests — the same six, unmodified. A failure here means the
refactor was not behavior-preserving; fix the refactor, do not touch the tests.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck --workspace @music-rank/web
```

Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/navigation.ts apps/web/src/components/TabNav.tsx
git commit -m "refactor: lift the destination table out of TabNav"
```

---

## Task 2: Add the bottom bar

The bar renders and behaves correctly. It is not yet hidden at any width and
nothing reserves space for it — that is Task 3. Everything asserted here is
breakpoint-independent, which is exactly what jsdom can verify (DESIGN-006 D6).

**Files:**
- Create: `apps/web/src/components/BottomNav.tsx`
- Create: `apps/web/src/components/BottomNav.test.tsx`
- Modify: `apps/web/src/shell/AppShellContext.tsx:141-145`

**Interfaces:**
- Consumes: `destinations` from `apps/web/src/navigation.ts` (Task 1);
  `useAppShell()` returning `{ user: AuthUser | null; openAuth: (mode: AuthMode) => void }`
  from `apps/web/src/shell/AppShellContext.tsx:14-25`.
- Produces: `BottomNav` — a component taking no props, exported from
  `apps/web/src/components/BottomNav.tsx`. Task 3 adds an `sx` breakpoint to it.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/BottomNav.test.tsx`. The `renderAt` helper is
copied from `TabNav.test.tsx:20-34` rather than shared — the two files stub
different route sets and a shared helper would have to grow options for both.

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import userEvent from '@testing-library/user-event';
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

// Every test scopes its queries to the bar with `within`. TabNav carries
// aria-label="Primary" and is in the same document — jsdom does not evaluate the
// media query that hides one of the two — so an unscoped query for a destination
// would match both surfaces.
describe('BottomNav', () => {
  it('shows all three destinations to an anonymous visitor', async () => {
    renderAt('/', { user: null });
    const bar = await screen.findByRole('navigation', { name: 'Primary bottom' });
    expect(within(bar).getByRole('link', { name: 'The Ranking' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Personal Ranking' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Practice Library' })).toBeInTheDocument();
  });

  it('opens the sign-in dialog instead of navigating when an anonymous visitor taps a guarded destination', async () => {
    const router = renderAt('/', { user: null });
    const bar = await screen.findByRole('navigation', { name: 'Primary bottom' });

    await userEvent.click(within(bar).getByRole('button', { name: 'Personal Ranking' }));

    expect(await screen.findByRole('heading', { name: 'Sign in to Music Rank' })).toBeVisible();
    // The point of rendering a button rather than a link: the route guard in
    // routes/personal.tsx would have redirected back to '/', flashing a page the
    // visitor never asked for.
    expect(router.state.location.pathname).toBe('/');
  });

  it('gives an authenticated visitor real links', async () => {
    renderAt('/', { user });
    const bar = await screen.findByRole('navigation', { name: 'Primary bottom' });
    expect(within(bar).getByRole('link', { name: 'Personal Ranking' })).toHaveAttribute('href', '/personal');
    expect(within(bar).getByRole('link', { name: 'Practice Library' })).toHaveAttribute('href', '/practice');
  });

  it('announces the full destination name while showing the short label', async () => {
    renderAt('/', { user });
    const bar = await screen.findByRole('navigation', { name: 'Primary bottom' });
    const personal = within(bar).getByRole('link', { name: 'Personal Ranking' });
    expect(personal).toHaveTextContent('Personal');
    expect(personal).not.toHaveTextContent('Personal Ranking');
  });

  it('marks the destination matching the current path as current', async () => {
    renderAt('/practice', { user });
    const bar = await screen.findByRole('navigation', { name: 'Primary bottom' });
    expect(within(bar).getByRole('link', { name: 'Practice Library' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('link', { name: 'The Ranking' })).not.toHaveAttribute('aria-current');
  });
});
```

Add `within` to the Testing Library import:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react';
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test --workspace @music-rank/web -- src/components/BottomNav.test.tsx
```

Expected: FAIL, 5 tests, each with `Unable to find an accessible element with
the role "navigation" and name "Primary bottom"`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/BottomNav.tsx`:

```tsx
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Link, useRouterState } from '@tanstack/react-router';
import { bottomNavHeight, destinations } from '../navigation';
import { useAppShell } from '../shell/AppShellContext';

export function BottomNav() {
  const { user, openAuth } = useAppShell();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = destinations.some((destination) => destination.to === pathname) ? pathname : '/';

  return <Paper component="nav" aria-label="Primary bottom" square elevation={3} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, pb: 'env(safe-area-inset-bottom)' }}>
    <BottomNavigation showLabels value={current} sx={{ height: bottomNavHeight }}>
      {destinations.map((destination) => {
        const Icon = destination.icon;
        // A guarded destination is not a link for an anonymous visitor: following
        // it would hit the beforeLoad guard in routes/personal.tsx, redirect back
        // to '/', and flash a page the visitor never asked for. It is a button
        // that opens the dialog, which is also the honest semantics — it does not
        // navigate.
        const locked = destination.personal && !user;
        const selected = current === destination.to;
        return <BottomNavigationAction
          key={destination.to}
          value={destination.to}
          label={destination.short}
          // The visible label is shortened to fit three destinations at 320px.
          // The accessible name must not be.
          aria-label={destination.full}
          icon={<Icon />}
          {...(locked
            ? { onClick: () => openAuth('login') }
            : { component: Link, to: destination.to, 'aria-current': selected ? 'page' as const : undefined })}
        />;
      })}
    </BottomNavigation>
  </Paper>;
}
```

- [ ] **Step 4: Render it in the shell**

In `apps/web/src/shell/AppShellContext.tsx`, add the import beside the existing
component imports:

```tsx
import { BottomNav } from '../components/BottomNav';
```

and render it inside the same `chrome &&` guard the other chrome uses, directly
after `{children}`:

```tsx
    {chrome && <Brand action={accountAction} />}
    {chrome && <TabNav />}
    {children}
    {chrome && <BottomNav />}
```

Placing it under `chrome &&` is what keeps it off the public profile page at
`/u/:username`, which renders with `chrome={false}` (`routes/__root.tsx:16`).

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test --workspace @music-rank/web -- src/components/BottomNav.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Run the whole web suite**

```bash
npm run test --workspace @music-rank/web
```

Expected: PASS. The bar is now in the DOM on every page, so this catches any
existing test whose query newly matches two elements. If `TabNav.test.tsx`'s
`renders every tab as a real anchor` fails, re-run that file alone first — see
"Known baseline issue" above.

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck --workspace @music-rank/web
```

Expected: no output, exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/BottomNav.tsx apps/web/src/components/BottomNav.test.tsx apps/web/src/shell/AppShellContext.tsx
git commit -m "feat: add the mobile bottom navigation bar"
```

---

## Task 3: Switch surfaces at 600px and reserve the bar's space

**Files:**
- Modify: `apps/web/src/components/TabNav.tsx` (root `Box` `sx`)
- Modify: `apps/web/src/components/BottomNav.tsx` (`Paper` `sx`)
- Modify: `apps/web/src/components/TabNav.test.tsx:38-48` (visibility assertions)
- Modify: `apps/web/src/shell/AppShellContext.tsx` (content padding, snackbar offset)
- Modify: `e2e/responsive.spec.ts`
- Modify: `docs/ENGINEERING_GUIDE.md`

**Interfaces:**
- Consumes: `bottomNavHeight` from `apps/web/src/navigation.ts` (Task 1);
  `BottomNav` from Task 2.
- Produces: nothing later tasks depend on. This is the last task.

- [ ] **Step 1: Add the breakpoint to both navigation surfaces**

In `apps/web/src/components/TabNav.tsx`, the root `Box` gains `display`:

```tsx
  return <Box component="nav" aria-label="Primary" sx={{ display: { xs: 'none', sm: 'block' }, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
```

In `apps/web/src/components/BottomNav.tsx`, the `Paper` gains the mirror:

```tsx
  return <Paper component="nav" aria-label="Primary bottom" square elevation={3} sx={{ display: { xs: 'block', sm: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (theme) => theme.zIndex.appBar, pb: 'env(safe-area-inset-bottom)' }}>
```

> **Corrected during execution.** Steps 2-4 below predicted that adding the
> breakpoint would break three `toBeVisible()` assertions in `TabNav.test.tsx`,
> on the theory that `sx` emits `display: none` as the base rule and jsdom
> ignores the `@media` override. That did not happen: the suite stayed green.
> Measured instead — jsdom's `getComputedStyle` does not apply emotion's
> injected stylesheet at all, so **both** navigation surfaces report
> `display: block` in unit tests regardless of the breakpoint, and
> `window.matchMedia` is not implemented. Steps 3 and 4 were therefore skipped
> and `TabNav.test.tsx` was not modified. The conclusion the plan was built on —
> that breakpoint behavior can only be verified by Playwright — holds more
> strongly than before.

- [ ] **Step 2: Run the web suite and watch TabNav fail**

```bash
npm run test --workspace @music-rank/web -- src/components/TabNav.test.tsx
```

Expected: FAIL, 3 of 6 tests, on `toBeVisible()`.

This failure is correct and expected, not a mistake to undo. `sx` compiles
`display: { xs: 'none', sm: 'block' }` to a base rule of `display: none` plus a
`@media (min-width:600px)` override. jsdom does not evaluate media queries, so
only the base rule applies and `TabNav` is `display: none` in every unit test.
`toBeVisible()` checks computed `display`; `toBeInTheDocument()` does not.

- [ ] **Step 3: Move TabNav's assertions off computed visibility**

In `apps/web/src/components/TabNav.test.tsx`, replace the three `toBeVisible()`
calls with `toBeInTheDocument()`. The `queryBy…().not.toBeInTheDocument()`
assertions and the `toHaveAttribute` ones are unaffected and must not change.

Line 38 (`shows only the ranking tab to anonymous visitors`):

```tsx
    expect(await screen.findByRole('tab', { name: /The Ranking/ })).toBeInTheDocument();
```

Lines 45-46 (`shows all three tabs to an authenticated visitor`):

```tsx
    expect(await screen.findByRole('tab', { name: /Personal Ranking/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Practice Library/ })).toBeInTheDocument();
```

Add this comment directly above the `describe` block so the next reader does not
"restore" the stronger-looking assertion:

```tsx
// These assert presence, not computed visibility. TabNav is display:none below
// 600px, and jsdom does not evaluate the media query that lifts it at 600px, so
// every unit test sees the hidden base rule. Which surface is actually visible
// at which width is verified in e2e/responsive.spec.ts (DESIGN-006 D6).
```

- [ ] **Step 4: Run the file again**

```bash
npm run test --workspace @music-rank/web -- src/components/TabNav.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Reserve the bar's space and lift the snackbar**

In `apps/web/src/shell/AppShellContext.tsx`, import the height:

```tsx
import { bottomNavHeight } from '../navigation';
```

Wrap `{children}` and offset the snackbar. The rendered tree becomes:

```tsx
    {chrome && <Brand action={accountAction} />}
    {chrome && <TabNav />}
    {/* The bar is fixed, so it occupies no layout space. Without this the last
        row of every list renders underneath it — the exact failure DESIGN-006
        §2.1 fixed for row actions. env() clears the home indicator on devices
        that have one and resolves to 0px on those that do not. */}
    <Box sx={{ pb: chrome ? { xs: `calc(${bottomNavHeight}px + env(safe-area-inset-bottom))`, sm: 0 } : 0 }}>{children}</Box>
    {chrome && <BottomNav />}
```

and the snackbar keeps its anchor but floats above the bar:

```tsx
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ bottom: chrome ? { xs: `calc(${bottomNavHeight}px + env(safe-area-inset-bottom) + 8px)`, sm: 24 } : undefined }}><Alert severity={notice?.severity} onClose={() => setNotice(null)} variant="filled">{notice?.message}</Alert></Snackbar>
```

`Box` is already imported in this file only if it is in the MUI import list —
check line 1 and add it if missing.

- [ ] **Step 6: Run the whole web suite**

```bash
npm run test --workspace @music-rank/web
```

Expected: PASS.

- [ ] **Step 7: Add the breakpoint assertions to the e2e suite**

In `e2e/responsive.spec.ts`, add this helper directly below the existing
`horizontalOverflow` function:

```ts
// Which navigation surface is live is a pure media-query outcome, so it can only
// be verified in a real browser. Both directions are asserted at every viewport:
// checking only "the bottom bar is visible below 600px" would pass a breakpoint
// edit that rendered both surfaces at once.
async function navigationSurfaces(page: Page) {
  const bottom = page.getByRole('navigation', { name: 'Primary bottom' });
  const tabs = page.getByRole('navigation', { name: 'Primary' });
  return { bottomVisible: await bottom.isVisible(), tabsVisible: await tabs.isVisible() };
}
```

Inside the existing `for (const viewport of viewports)` loop, within the
`test.step`, immediately after `await page.setViewportSize(...)` and before the
`for (const { path, list } of lists)` loop:

```ts
      await page.goto('/');
      await expect(page.getByRole('list', { name: 'Ranked songs' }).getByRole('listitem').first()).toBeVisible();
      const surfaces = await navigationSurfaces(page);
      const phone = viewport.width < 600;
      expect(surfaces.bottomVisible, `bottom bar visibility is wrong at ${viewport.label}`).toBe(phone);
      expect(surfaces.tabsVisible, `tab bar visibility is wrong at ${viewport.label}`).toBe(!phone);
```

Then, still inside the `for (const { path, list } of lists)` loop, after the
existing `expect(overflow.over, ...)` assertion:

```ts
        if (viewport.width < 600) {
          const bar = page.getByRole('navigation', { name: 'Primary bottom' });
          const barBox = (await bar.boundingBox())!;

          // Scrolling to the end is the property the top tab bar lacks: it leaves
          // the viewport, the fixed bar does not.
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          const afterScroll = (await bar.boundingBox())!;
          expect(Math.round(afterScroll.y), `bottom bar left the viewport after scrolling on ${path} at ${viewport.label}`).toBe(Math.round(barBox.y));

          // The last row must clear the bar. Element boxes are not enough here
          // for the reason stated at the top of this file — measure the glyphs.
          const lastRowIntrusion = await page.getByRole('list', { name: list }).evaluate((root, barTop) => {
            const rows = root.querySelectorAll('li');
            const last = rows[rows.length - 1];
            if (!last) return -1;
            let lowest = -Infinity;
            const walker = document.createTreeWalker(last, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (!node.nodeValue?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const rect of Array.from(range.getClientRects())) {
                if (rect.height > 0) lowest = Math.max(lowest, rect.bottom);
              }
            }
            return lowest === -Infinity ? -1 : lowest - barTop;
          }, barBox.y);
          expect(lastRowIntrusion, `the last row on ${path} runs under the bottom bar at ${viewport.label}`).toBeLessThanOrEqual(1);
          await page.evaluate(() => window.scrollTo(0, 0));
        }
```

- [ ] **Step 8: Run the e2e suite**

```bash
npm run test:e2e
```

Expected: PASS. This is the only check that proves acceptance criteria 1, 2, 6
and 7 — jsdom cannot see any of them.

- [ ] **Step 9: Update the engineering guide**

`docs/ENGINEERING_GUIDE.md` §1.1 requires an update in the same change when
"前端数据流、主要组件职责" changes. Find the section listing web component
responsibilities and add two rows in the style already used there:

- `apps/web/src/navigation.ts` — the destination table shared by both navigation
  surfaces, plus `bottomNavHeight`.
- `apps/web/src/components/BottomNav.tsx` — fixed bottom navigation below 600px;
  guarded destinations render as buttons that open the sign-in dialog.

Then update 「最后更新日期」 and add a row to §18 近期变更记录 describing the
navigation change. Leave the commit column as 当前工作树 until the commit exists.

- [ ] **Step 10: Full verification**

```bash
npm run typecheck && npm run test && npm run build && npm run test:e2e
```

Expected: all four pass. This is acceptance criterion 8. If
`TabNav.test.tsx` > `renders every tab as a real anchor` fails here, re-run it
alone before investigating — see "Known baseline issue" above.

- [ ] **Step 11: Record the plan and design as delivered**

Add a row to the 变更记录 table in both `docs/DESIGN_004_MOBILE_BOTTOM_NAV.md`
and this plan, and set this plan's `status:` to `Completed`.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/components/TabNav.tsx apps/web/src/components/TabNav.test.tsx apps/web/src/components/BottomNav.tsx apps/web/src/shell/AppShellContext.tsx e2e/responsive.spec.ts docs/ENGINEERING_GUIDE.md docs/DESIGN_004_MOBILE_BOTTOM_NAV.md docs/PLAN_004_MOBILE_BOTTOM_NAV.md
git commit -m "feat: move primary navigation to a bottom bar below 600px"
```

---

## Self-Review

**Spec coverage.** Every DESIGN-004 decision maps to a task: D1 → Task 1;
D2 → Task 3 Step 1 (both surfaces, `sx` only, no `useMediaQuery`); D3 → the
single `sm` value used in Tasks 1 and 3; D4 → Task 2 Step 1 test 1; D5 → Task 2
Step 1 test 2 and Step 3's `locked` branch; D6 → no task touches `beforeLoad`,
and Task 2's second test asserts the guard is not reached; D7 → `showLabels` in
Task 2 Step 3; D8 → Task 3 Step 5. Acceptance criteria 1, 2, 6, 7 are Task 3
Steps 7-8; criterion 3 is Task 2 Step 1 tests 1 and 4; criterion 4 is Task 2
Step 1 test 2; criterion 5 is unchanged behavior protected by the untouched
guard and the existing `routing.test.tsx`; criterion 8 is Task 3 Step 10.

**Placeholder scan.** No TBD, no "add error handling", no "similar to Task N".
Every code step carries the literal code. Step 9 names the two rows to add
rather than their final wording, because the guide's section format must be
matched by reading it — the row contents are given.

**Type consistency.** `destinations`, `Destination`, `bottomNavHeight` are
defined in Task 1 and used under those names in Tasks 2 and 3. `BottomNav` takes
no props in both its definition and its two call sites. `openAuth('login')`
matches `AppShell.openAuth: (mode: AuthMode) => void`. The landmark name
`Primary bottom` is used identically in the component, its tests, and the e2e
helper.

**The gap this plan accepted was not real.** The plan claimed DESIGN-004 §6.2
item 4 ("a notification triggered at 320px does not intersect the bar") could
not be automated, because firing a notification needs a mutation and the fixture
user has no action that both triggers a snackbar and leaves the list measurable.
That was wrong: adding a song to the Top 10 does exactly that, and the step runs
last so the mutation cannot disturb the viewport loop that reads the list. The
assertion now exists in `e2e/responsive.spec.ts`, verified by removing the
snackbar offset — it fails with the notification's bottom edge 37.5px below the
bar's top edge.

## 变更记录

| 日期 | 作者 | 变更 | Commit |
| --- | --- | --- | --- |
| 2026-09-14 | chance | 初稿：三个任务 —— 抽目的地表、加底栏、断点切换与避让；记录 jsdom 下 `display:none` 会击穿 TabNav 现有 `toBeVisible` 断言，以及匿名访客在两个导航面看到的目的地集合不一致 | 当前工作树 |
| 2026-09-14 | chance | 执行完成。两处与计划的偏差：`@testing-library/user-event` 未安装，改用项目既有的 `fireEvent`；jsdom 不应用 emotion 样式表，Task 3 Step 2-4 预测的 TabNav 断言失败没有发生，跳过改断言 | 当前工作树 |
| 2026-09-14 | chance | 补上 §6.2 第 4 条的自动化覆盖，此前判断「无法自动化」有误；该用例的 locator 必须带 `disabled: false`，因为 Top 10 满员时按钮文案仍是 Add Top 10 只是不可点 | 当前工作树 |
