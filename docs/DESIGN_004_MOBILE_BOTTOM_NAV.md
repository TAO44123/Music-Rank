---
design_id: DESIGN-004
title: Mobile Bottom Navigation
status: Approved
author: chance
created: 2026-09-14
updated: 2026-09-15
supersedes: null
related:
  - DESIGN_002_TAB_NAVIGATION.md
  - DESIGN_006_RESPONSIVE_PANELS.md
  - DESIGN_005_USER_DEFINED_LISTS.md
  - ENGINEERING_GUIDE.md
---

# DESIGN-004 — Mobile Bottom Navigation

## 1. Approved Scope

DESIGN-002 shipped the three top-level destinations as a tab bar directly below
the top bar, at every width. DESIGN-006 then made the panels those destinations
render legible from 320px up, but deliberately left the navigation where it was.

This design moves primary navigation to a fixed bottom bar below 600px. The tab
bar remains exactly as it is at 600px and above.

Approved behavior:

- Below 600px, the three destinations render in a bottom bar fixed to the
  viewport, with an icon and a permanently visible label each.
- Below 600px, the top tab bar is not rendered. The brand bar — wordmark and
  account control — stays where it is.
- At 600px and above, nothing changes: the tab bar renders, the bottom bar does
  not.
- All three destinations are present in the bottom bar whether or not a visitor
  is signed in. Their positions do not move when a session begins or ends.
- An anonymous visitor tapping Personal or Practice opens the sign-in dialog in
  place. No navigation occurs.
- Page content is never obscured by the bottom bar, including on devices with a
  home indicator.
- Transient notifications render above the bottom bar, not underneath it.
- No API, schema, route table, or route guard change.

The resulting anonymous experience intentionally differs by breakpoint: phones
show all three destinations, while the desktop top tab bar continues to show
only Ranking. On 2026-09-15 the user accepted this difference as non-blocking
and chose to retain the implemented behavior.

### 1.1 Why this is no longer blocked

DESIGN-006 §5 listed bottom navigation as out of scope on the grounds that
DESIGN-005 §4 blocks it: a bottom bar built around today's three fixed tabs
would be rebuilt as soon as user-defined lists land, because N user lists cannot
be top-level destinations.

That reasoning still holds, and this design does not resolve it. What changed is
the decision: DESIGN-005 is explicitly deferred, so the three destinations are
stable for the foreseeable term and the bottom bar is built against them now.
If DESIGN-005 is later approved, D1 below is what limits the cost of redoing
this — the destination table is a single module, not a literal inside each
navigation component.

## 2. Problem Statement

### 2.1 Navigation is a desktop control at phone widths

`TabNav` renders MUI `Tabs` in a bordered strip under the brand bar at every
width. DESIGN-002 D5 made it survive 375px by giving the tabs equal width and
shortening their labels (`The Ranking` to `Ranking`), which stops it from
overflowing but does not make it a phone control:

- It sits at the top of the viewport, the least reachable region for a thumb.
- It scrolls away with the page. On `/`, the seeded ranking is 25 rows on the
  first page; once a visitor is a few rows down, there is no visible way to
  change destination without scrolling back up.
- Its targets are 52px tall strips of text with no icon.

### 2.2 The destination table is a literal inside one component

`apps/web/src/components/TabNav.tsx:5` declares the three destinations as a
module-level constant inside the component file that renders them. A second
navigation surface needs the same three destinations, their same short and long
labels, and the same `personal` flag that decides which ones require a session.
Copying that literal into a second component means the next change to the set
has two places to land and one of them will be missed.

### 2.3 Two pieces of shared chrome collide with a fixed bottom bar

Neither is a navigation bug; both are only reachable once a bar is pinned to the
bottom of the viewport, so both are fixed here rather than discovered later.

- `AppShellContext.tsx:144` anchors the notification `Snackbar` to
  `{ vertical: 'bottom', horizontal: 'center' }`. A bar pinned to the same edge
  covers it.
- Every route page supplies its own `<Box component="main" sx={{ py: … }}>`.
  None of them reserve space at the bottom, so the last row of every list would
  render underneath the bar. On devices with a home indicator the reserved space
  must also clear `env(safe-area-inset-bottom)`.

### 2.4 An anonymous tap on a guarded destination cannot be a link

`routes/personal.tsx:13` and `routes/practice.tsx` guard their routes in
`beforeLoad`:

```ts
const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
if (!session.user) throw redirect({ to: '/', search: { signin: true } });
```

That guard is correct for a typed URL and stays unchanged. But if the bottom bar
rendered those destinations as links for anonymous visitors, a tap would
navigate, hit the guard, redirect back, and open the dialog — a visible flash
through a page the visitor never asked for. The bar must not start that
navigation in the first place.

## 3. Decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| D1 | The destination table moves to `apps/web/src/navigation.ts` and both navigation components consume it. | One place to change the set. This is also what bounds the cost if DESIGN-005 later reshapes the destinations. |
| D2 | Two components, `TabNav` and `BottomNav`, each shown or hidden by an `sx` breakpoint. Not one component branching on `useMediaQuery`. | Follows DESIGN-006 D4 (`xs`/`sm` spans, not a JavaScript width query) and avoids DESIGN-006 D6's trap: jsdom does not evaluate media queries, so a `useMediaQuery` branch makes the unit suite silently cover one side only. It also avoids a first-paint flash of the desktop layout. |
| D3 | The breakpoint is MUI's `sm` (600px). No new breakpoint. | Matches DESIGN-006 D5. The whole responsive system has exactly one breakpoint. |
| D4 | All three destinations render for anonymous visitors. | Positions are stable across sign-in, and the bar states what the product offers. A one-item bottom bar — which is what filtering by session would produce — reads as a button, not as navigation. |
| D5 | For an anonymous visitor, a guarded destination renders as a `button` that opens the sign-in dialog, not as a link. | Avoids the redirect flash in §2.4. It is also the correct semantics: the control does not navigate, so it is not a link. |
| D6 | The route guards in `beforeLoad` are unchanged. | They cover the case the bar cannot: a typed or shared URL. Navigation chrome and route guards defend different entrances. |
| D7 | Labels are permanently visible on all three items (`showLabels`). | MUI's default hides the label of every unselected item. At three destinations there is room for all three labels at 320px, and an unlabelled icon is a guess. |
| D8 | The bottom bar reserves its own space by padding the content, not by `position: sticky` or a layout wrapper. | A single `padding-bottom` on the content container is the smallest change that satisfies DESIGN-006's "no text under a control" criterion, and it is applied in one place rather than in each route page. |

## 4. Layout Specification

### 4.1 `apps/web/src/navigation.ts` (new)

```ts
export const destinations = [
  { to: '/',         short: 'Ranking',  full: 'The Ranking',      icon: FormatListNumberedOutlined, personal: false },
  { to: '/personal', short: 'Personal', full: 'Personal Ranking', icon: StarOutline,                personal: true  },
  { to: '/practice', short: 'Practice', full: 'Practice Library', icon: MicNone,                    personal: true  }
] as const;

export const bottomNavHeight = 56;
```

`short`, `full` and `personal` are lifted verbatim from `TabNav.tsx:5` — this is
a move, not a redefinition. `icon` is new and used only by `BottomNav`.

`bottomNavHeight` is MUI's `BottomNavigation` height. It lives here because §4.4
spends it in three separate expressions, and a bar whose height and whose
reserved space disagree is exactly the class of bug DESIGN-006 §2.1 traced to a
hard-coded reserve chasing a layout.

`MicNone` is already the icon on the ranking row's practice action, so the
bottom bar names Practice with the icon the visitor has already been tapping.

### 4.2 `apps/web/src/components/BottomNav.tsx` (new)

```
Paper  elevation 3, position: fixed, bottom 0, left 0, right 0
       zIndex: theme.zIndex.appBar
       display: { xs: 'block', sm: 'none' }
       paddingBottom: env(safe-area-inset-bottom)
└── BottomNavigation  showLabels, value={current}
    └── BottomNavigationAction × 3   icon + label={short}
```

Selected state resolves exactly as `TabNav` does today: `useRouterState` reads
the pathname, and a pathname matching no destination falls back to `/`.

Each action renders one of two ways:

| Visitor | Destination | Renders as |
| --- | --- | --- |
| Signed in | any | `component={Link} to={destination.to}` |
| Anonymous | `personal: false` | `component={Link} to={destination.to}` |
| Anonymous | `personal: true` | `button`, `onClick` opens the sign-in dialog |

The accessible name is the full label (`Personal Ranking`), not the short one,
so the shortened visual label does not shorten what a screen reader announces.

### 4.3 `TabNav`

Unchanged except that its destination list now comes from `navigation.ts`, and
its root `Box` gains `display: { xs: 'none', sm: 'block' }`.

Because `display: none` removes a subtree from the accessibility tree, exactly
one navigation is exposed at any width. Both keep `aria-label="Primary"` without
ever presenting two primary navigations at once.

### 4.4 `AppShellContext`

Three changes inside the existing `chrome &&` guards, so the public profile page
at `/u/:username` — which renders with `chrome={false}` — is unaffected and
needs no special case:

1. `{children}` is wrapped in a `Box` with
   `pb: { xs: 'calc(56px + env(safe-area-inset-bottom))', sm: 0 }`.
2. `<BottomNav />` renders after that wrapper.
3. The `Snackbar` gains
   `sx={{ bottom: { xs: 'calc(56px + env(safe-area-inset-bottom) + 8px)', sm: 24 } }}`,
   keeping its `bottom center` anchor but floating it above the bar.

The `56px` in all three expressions is `bottomNavHeight` from §4.1, not a
repeated literal.

## 5. Out of Scope

- **Row action gestures.** The swipe-to-reveal interaction once sketched for
  DESIGN-004 is not part of this design. Row actions stay as DESIGN-006 built
  them: always-visible controls, no gesture-only functionality.
- **User-defined lists.** DESIGN-005 stays deferred. See §1.1.
- Hiding the bar on scroll, badges or counts on items, and any transition
  animation between the two navigation surfaces.
- The brand bar's contents, the account menu, and the public profile page.
- Any change to the route table, route guards, API, or schema.

## 6. Testing

### 6.1 Unit (`apps/web/src/components/BottomNav.test.tsx`)

jsdom does not evaluate media queries (DESIGN-006 D6), so the unit suite asserts
behavior that does not depend on the breakpoint:

1. All three destinations render for an anonymous visitor.
2. An anonymous tap on Personal opens the sign-in dialog and leaves the pathname
   unchanged — this is the regression guard for §2.4.
3. A signed-in visitor gets real links whose `href` matches the destination.
4. The accessible name of each action is the full label.

`TabNav.test.tsx` is unchanged in intent; it is updated only where importing the
destination table replaces its local literal.

### 6.2 End-to-end (`e2e/responsive.spec.ts`)

The existing spec already visits `/`, `/personal` and `/practice` at 320, 375,
414, 600 and 900px with a registered user and the seed's widest rows. It is
extended at those same viewports:

1. Below 600px the bottom bar is visible and the top tab bar is not; at 600px
   and above the reverse. Asserting both directions is what keeps a future
   breakpoint edit from silently rendering both or neither.
2. The bar stays at the bottom edge after scrolling to the end of the ranking —
   the property §2.1 says the tab bar lacks.
3. No glyph box of any row intersects the bottom bar's box, reusing the spec's
   existing `Range`-based measurement rather than measuring element boxes.
4. A notification triggered at 320px does not intersect the bar.

## 7. Acceptance Criteria

1. At 320, 375 and 414px, `/`, `/personal` and `/practice` render the bottom bar
   fixed to the viewport and render no top tab bar.
2. At 600 and 900px, all three render the top tab bar and no bottom bar.
3. The bottom bar shows three items with both an icon and a visible label at
   320px, and the items do not change position when a session begins or ends.
4. An anonymous visitor tapping Personal or Practice sees the sign-in dialog,
   and the URL does not change.
5. Typing `/personal` while signed out still redirects to `/` and opens the
   dialog, exactly as before this change.
6. Scrolling to the last row of the ranking at 320px leaves that row fully
   visible, and a notification shown at that moment is fully visible.
7. `/u/:username` renders neither navigation surface at any width.
8. `npm run typecheck`, `npm run test`, `npm run build` and `npm run test:e2e`
   all pass.

## 变更记录

| 日期 | 作者 | 变更 | Commit |
| --- | --- | --- | --- |
| 2026-09-14 | chance | 初稿：xs 下导航下沉为固定底栏，sm 及以上保持顶部 tab；目的地表抽到 `navigation.ts`；匿名访客三项常驻且受限项点击弹登录框而不导航；DESIGN-005 明确延后，解除 DESIGN-006 §5 记录的阻塞 | 137211c |
| 2026-09-14 | chance | 按 PLAN-004 实现完毕，§6.1 与 §6.2 四条断言全部落地并逐条做过破坏性验证 | 当前工作树 |
| 2026-09-15 | chance | 确认匿名导航在手机显示三项、桌面仅显示 Ranking 的差异为本次发布可接受的非阻塞行为，保留现有实现 | 当前工作树 |
