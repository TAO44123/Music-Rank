---
design_id: DESIGN-006
title: Responsive Panel Layout
status: Approved
author: chance
created: 2026-09-13
updated: 2026-09-14
supersedes: null
related:
  - DESIGN_002_TAB_NAVIGATION.md
  - DESIGN_004_MOBILE_BOTTOM_NAV.md
  - DESIGN_005_USER_DEFINED_LISTS.md
  - ENGINEERING_GUIDE.md
---

# DESIGN-006 — Responsive Panel Layout

## 1. Approved Scope

DESIGN-002 made the navigation bar responsive and turned every destination into
a full-width page. It did not touch the panels those pages render. Two of the
three are still written for a desktop width only, and the third positions its
row actions in a way that puts text underneath them on a phone.

This design makes the three list panels — `RankingPanel`, `TopListPanel`,
`SingingListPanel` — legible and fully operable from 320px up, and fixes the one
piece of shared chrome that broke at the same widths.

Approved behavior:

- No page scrolls horizontally at any width from 320px.
- No text ever renders underneath a control.
- Below 600px, a row that cannot fit its text and its actions side by side puts
  the actions on their own line under the text, indented to the text column.
- At 600px and above, every panel keeps the layout it has today.
- No API, schema, route, or navigation change.

## 2. Problem Statement

### 2.1 Ranking rows put text under the buttons

`RankingPanel` passes its two action buttons to MUI's `secondaryAction` slot.
That slot is positioned absolutely, so the buttons never occupy layout space.
The only thing keeping text clear of them is a hard-coded reserve on the text
column:

```tsx
<ListItemText … sx={{ pr: { xs: 0, sm: 25 } }} />
```

Below 600px the reserve is `0`, so the text runs the full width of the row and
the buttons are painted on top of it. The text has no truncation, so it does not
stop — it continues under the buttons and becomes unreadable.

`sm: 25` (200px) is not sufficient either: the two buttons are 144px and 164px
wide with a gap, which is 314px in a row, or 164px stacked. Both exceed 200px.

`e2e/responsive.spec.ts` measured this against the seeded ranking before the
change. At 320px every one of the 25 visible rows collided with at least one
button; the widest overlap was 99px, on
`糊涂的爱 / 王志文、江珊 · 1994`, whose artist line disappeared almost
entirely under `Add Practice`.

The reserve is a number chasing a layout. The fix is to stop positioning the
actions outside the flow, not to pick a larger number.

### 2.2 The top bar overflows on any long username

The account button holds `@<username>`, which is unbreakable text of arbitrary
length. It is a flex item with the default `min-width: auto`, so it cannot
shrink below its content. At 320px a 28-character username made the button's
content 219px wide inside a 192px box and pushed the page's scroll width to
331px.

This is not a panel bug, but it surfaces as one: the bar is on every page, so
every page scrolled sideways. It was found while verifying the panels.

### 2.3 Two panels have no breakpoints at all

`TopListPanel` and `SingingListPanel` contain no responsive value anywhere:
fixed `p: 2.5` padding, headers locked to `direction="row"`, and rows whose
controls are given unconditional space. They are the entire body of `/personal`
and `/practice`, the two pages DESIGN-002 created.

At 320px the arithmetic does not work:

- `TopListPanel` row: 28px rank + 34px drag handle + three 40px icon buttons
  leaves under 100px for title and artist inside a 320px viewport.
- `SingingListPanel` row: a `4px minmax(0,1fr) auto` grid where the trailing
  `auto` column holds a status chip plus two icon buttons, about 148px, against
  the same budget.

Neither overlaps, because both are real flex/grid layouts — they crush the text
column instead.

## 3. Decisions

| ID | Decision |
| --- | --- |
| D1 | Row actions participate in layout. `secondaryAction` is replaced by an explicit flex row, so overlap becomes structurally impossible rather than avoided by a reserve value. |
| D2 | Below 600px, actions move to a second line under the text, indented to the text column so the row still reads as one unit. At 600px and up the actions return to the right of the text. |
| D3 | Row text wraps; it is never truncated with an ellipsis. Once the actions are in the flow there is no reason to hide a song title. |
| D4 | Narrow-width button labels follow the short/long pattern `TabNav` already uses: a `xs`-only span and a `sm`-and-up span, not a JavaScript width query. |
| D5 | The single breakpoint is MUI's `sm` (600px). No new breakpoint is introduced. |
| D6 | Breakpoint behavior is verified by Playwright, not by unit tests. The unit suite runs in jsdom, which does not evaluate media queries, so a `sx` breakpoint is invisible to it. |

## 4. Layout Specification

### 4.1 RankingPanel row

```
ListItem (display: block, no secondaryAction)
└── Box  flex, direction={{ xs: 'column', sm: 'row' }}, gap 1.5
    ├── Box  flex: 1, minWidth: 0, row        → rank number + ListItemText
    └── Stack  row, flexShrink: 0,            → the two action buttons
               pl={{ xs: '46px', sm: 0 }}
```

`minWidth: 0` on the text column is what allows it to shrink inside a flex
parent; without it the column keeps its content width and pushes the buttons
off-screen. The `46px` indent is the rank column (34px) plus the row gap (12px),
so the buttons line up under the title rather than under the rank.

Buttons below 600px share the line equally (`flex: 1`) instead of using their
fixed 144px/164px widths, and use short labels:

| State | `xs` | `sm` and up |
| --- | --- | --- |
| Not in Top 10 | Add Top 10 | Add Top 10 |
| In Top 10 | In Top 10 | In Top 10 |
| Not in library | Practice | Add Practice |
| In library | In Library | In Practice Library |

One intended visual change reaches the desktop layout. `secondaryAction` insets
its content 16px from the row's right edge, so the buttons used to stop short of
the right margin while the text started flush against the left one. In the flow
layout they end flush right, matching the text's left alignment. The 16px was an
artifact of the absolute slot, not a decision, and it is not reproduced.

### 4.2 TopListPanel

- `Paper` padding becomes `{ xs: 1.75, sm: 2.5 }`.
- The header stack becomes `direction={{ xs: 'column', sm: 'row' }}` so the
  title is not squeezed by the `n/10` counter and the visibility control.
- A row below 600px becomes two lines: rank, drag handle, title and artist on
  the first; the two move buttons and remove, left-aligned under the text, on
  the second. The drag handle stays beside the title at every width, because it
  is the affordance for the row rather than an action on it. At 600px and up the
  row is unchanged.

### 4.3 SingingListPanel

- Same padding and header treatment.
- The row grid drops to two columns below 600px
  (`4px minmax(0, 1fr)`), with the status chip and the two icon buttons moved to
  a second grid row spanning the text column.
- The expanded editor loses its `ml: 2` indent and tightens its padding below
  600px, where the indent costs more than it communicates.
- The row `List` gains `aria-label="My Practice Library"`, matching the labels
  the other two panels already carry.

### 4.4 Top bar

`Toolbar` height becomes `{ xs: 56, sm: 66 }` and the wordmark
`{ xs: '1.25rem', sm: '1.45rem' }`. The tagline is already hidden below 600px.

The account button caps at `maxWidth: { xs: 150, sm: 320 }` with `minWidth: 0`,
and its label truncates with an ellipsis. A username is arbitrary-length and
unbreakable; as a flex item with the default `min-width: auto` the button could
not shrink, so the bar overflowed the viewport. Because the bar renders on every
page, that made *every* page scroll sideways — this was found on `/` and
`/personal` alike before it was traced to the header. The accessible name still
carries the full username; only the painted text is clipped.

## 5. Out of Scope

- **Bottom navigation.** This is DESIGN-004's subject, and DESIGN-005 §4 blocks
  it: a bottom bar built around today's three fixed tabs would be rebuilt as
  soon as user-defined lists land. The tab bar shipped in DESIGN-002 stays where
  it is.

  **Superseded 2026-09-14 by DESIGN-004.** The blocking analysis above was not
  refuted — DESIGN-005 was deferred instead, which makes the three destinations
  stable enough to build against. DESIGN-004 moves navigation to a fixed bottom
  bar below 600px and leaves the tab bar unchanged at 600px and above. The
  panels this design specifies are untouched by it.
- Touch-target sizing beyond what the layout change already produces.
- Dark mode, orientation-specific layouts, and container queries.
- Any change to the public profile page `/u/:username`.

## 6. Testing

`e2e/responsive.spec.ts` registers a user, puts the seed's widest row
(`纤夫的爱 / 尹相杰、于文华 · 1993`) into both personal lists, adds a long
practice note, then visits `/`, `/personal` and `/practice` at 320, 375, 414,
600 and 900px. At each combination it asserts:

1. `document.documentElement.scrollWidth <= clientWidth`.
2. No text node's glyph box intersects any control's box inside a row.

Two properties of that check matter, and both were established by getting them
wrong first.

**It measures glyph boxes, not element boxes.** Each text node is measured with
`document.createRange()`. A text container that stretches to full row width
reports a clean rectangle while the glyphs inside it sit under a button, so
measuring containers reports a false pass.

**It measures only after the rows have rendered.** `page.goto` resolves while
the SPA has rendered no list at all. Measured there, the collision check sees
zero rows and therefore zero collisions, and the overflow check reports a number
belonging to a transitional state the user never sees — during development that
state produced a spurious 11px overflow on `/personal` that no settled layout
reproduces. The spec waits for the first row, then measures, and additionally
asserts that the row count and the number of measured text boxes are both
greater than zero, so "measured nothing" can no longer masquerade as a pass.

The existing unit suites are unchanged except where D4 renames rendered copy.

## 7. Acceptance Criteria

1. `/`, `/personal` and `/practice` show no horizontal scrollbar at 320, 375,
   414, 600 and 900px.
2. No text intersects a control in any row at any of those widths.
3. At 320px every row action remains reachable and its accessible name still
   states the full action.
4. At 900px all three panels render as they did before this change, except that
   ranking row buttons end flush with the panel's right margin rather than 16px
   short of it.
5. A 28-character username does not widen the page at 320px, and its button
   still exposes the full username as its accessible name.
6. `npm run typecheck`, `npm run test`, `npm run build` and `npm run test:e2e`
   all pass.

## 变更记录

| 日期 | 作者 | 变更 | Commit |
| --- | --- | --- | --- |
| 2026-09-13 | chance | 初稿：三个列表面板的响应式布局；行操作按钮进入正常流，xs 下沉到文字下方；底部导航仍归 DESIGN-004 并被 DESIGN-005 §4 阻塞 | — |
| 2026-09-14 | chance | §5 底部导航条目标注被 DESIGN-004 取代：阻塞分析未被推翻，是 DESIGN-005 改为延后，三个目的地因而足够稳定 | 当前工作树 |
