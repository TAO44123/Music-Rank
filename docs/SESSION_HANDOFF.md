# Music Rank — Session Handoff

> Last updated: 2026-09-14 (America/New_York)
>
> Feature authority: `docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md`
>
> Task 1 design: `docs/RANKING_CATALOG_DESIGN.md`

## 1. Current Status

Task 1 of the approved Ranking Catalog Expansion is implemented, verified, and
committed locally. A follow-up UI refinement based on the approved lightweight
editorial-tab concept is implemented and verified in the current working tree.
It does not import the four production video rankings.

The application now supports published rankings identified by `decade × region`
with stable routes. The existing dataset is preserved as the published `90s Demo
Ranking` at `/rankings/90s/mainland`. The initial supported dimensions are 80s
and 90s with Hong Kong/Taiwan and Mainland China regions. Combinations without a
published ranking are shown as unavailable.

Task 2 (user-submitted songs) and Task 3 (reviewed YouTube data import) have not
started. Their approved scope and acceptance gates are recorded in the feature
execution plan.

## 2. Repository State

- Branch: `feature/ranking-catalog-expansion`.
- Committed HEAD: `be345ae` — `feat: add multi-ranking catalog foundation`.
- The feature branch started from `9717ff3`, which remains synchronized with
  `origin/main`.
- Commit `be345ae` is local and unpushed. The subsequent UI refinement is also
  uncommitted. The user has not authorized a push.
- Preserve every working-tree change. Do not reset, discard, or overwrite it.
- Use `git status --short --branch` and the live diff for the exact file list.
- Migration `0002_bumpy_thor_girl.sql` has been applied to the normal local
  database. It was also verified from scratch in a temporary database, which was
  removed after verification.
- Existing project development services were already running on ports 3001 and
  5173 during manual acceptance. Do not terminate them without confirming
  ownership. PostgreSQL uses 5432; Playwright uses 3101 temporarily.

## 3. Task 1 Implementation

### Database

- Added the `ranking_region` enum with `HK_TW` and `MAINLAND`.
- Added non-null `slug`, `decade_start`, `region`, and positive
  `display_order` metadata to `rankings`.
- Added stable-slug uniqueness and a partial unique index that permits at most
  one published ranking for each decade/region pair while retaining unpublished
  history.
- Limited the current schema to the approved 1980 and 1990 decade starts.
- Forward migration `0002_bumpy_thor_girl.sql` backfills the known demo ranking
  before making the new fields non-null and fails rather than guessing if an
  unexpected pre-existing ranking needs classification.
- Seed now preserves the same demo ranking UUID, songs, entries, and personal
  data while naming it `90s Demo Ranking` and assigning the 1990/Mainland route.

### Contracts and API

- Shared contracts define `80s | 90s` and `hk-tw | mainland` path values.
- `GET /api/rankings` returns only published catalog entries in deterministic
  display order, including route metadata and source availability but not the
  source URL itself.
- `GET /api/rankings/:decade/:region` resolves one published ranking and returns
  its source URL, unfiltered `songCount`, entries, and ranking-scoped
  artist/release-year facets.
- Invalid path values return `400 INVALID_REQUEST`; missing or unpublished
  combinations return `404 RANKING_NOT_FOUND`.
- Entry ordering remains based on the rank stored for that ranking, so one song
  can hold independent ranks in different rankings.

### Web application

- `/` redirects to `/rankings/90s/mainland` and preserves valid search state.
- `/rankings/$decade/$region` owns the ranking page. Search text, artist,
  release year, page, and sign-in intent are validated URL search parameters.
- A lightweight page-level navigator uses underlined tabs for 80s/90s and Hong
  Kong/Taiwan/Mainland China, deriving disabled combinations from published API
  metadata without a separate navigation card.
- Changing category preserves text search, clears ranking-scoped artist/year
  filters, and resets pagination. Changing filters also resets pagination.
- The ranking card groups decade/region context, total song count, source badge,
  and source action in one compact header. Search and filters share a responsive
  tinted toolbar. It shows `Watch source` only for safe HTTP(S) URLs and opens
  the link with `noopener,noreferrer` protections.
- Anonymous ranking access, authenticated list actions, guarded personal routes,
  authentication cache isolation, and public-list privacy behavior remain
  intact. Anonymous personal/practice deep links now return to the default
  ranking route with the sign-in dialog.

## 4. Verification on 2026-09-14

All required Task 1 gates passed:

- Existing-database migration: passed; users, songs, rankings, ranking entries,
  Top 10 entries, and Practice Library entry counts were unchanged.
- Clean-database migration and seed: passed in a temporary database; 30 seeded
  songs and the expected demo metadata were verified.
- `npm run typecheck`: passed for all workspaces.
- `npm test`: API 15/15; Web 11 files and 34/34; contracts/database had no test
  files and exited successfully with `--passWithNoTests`.
- `npm run build`: passed. The existing large-bundle warning remains; the latest
  main asset was 821.19 KB (256.59 KB gzip).
- `npm run test:e2e`: Playwright 1/1 passed.
- Manual browser acceptance: desktop and 390 × 844 mobile layouts checked;
  category availability, responsive filter layout, URL search, and the stable
  unfiltered song count were verified.
- Final whitespace/diff inspection must remain green after any later edit.

Known non-blocking output remains the Vite bundle-size warning, the third-party
Zod comment warning during bundling, Node color warnings in Playwright, and
jsdom's unimplemented `window.scrollTo()` notices during Web tests.

## 5. Remaining Work

### Finish Task 1 delivery

- Review and locally commit the uncommitted UI refinement when the user asks.
- Push commit `be345ae` and any follow-up only when the user explicitly asks.
- Merge Task 1 before creating Task 2 from an updated `main`.

### Task 2 — User-submitted songs

- Planned branch: `feature/user-submitted-songs`, created from `main` after Task
  1 is merged.
- Add title/artist submission from Personal Ranking and Practice Library.
- Store shared songs as `UNVERIFIED`, support exact duplicate confirmation and
  reuse, and never create public ranking entries through this flow.
- Normal users may remove songs from their own lists but cannot edit or delete
  global song records.

### Task 3 — Ranking data import

- Planned branch: `feature/ranking-data-import`, created from `main` after Tasks
  1 and 2 are merged.
- Requires four user-selected YouTube URLs and user approval of every extracted
  ranking table before import.
- Import real rankings unpublished, validate them, then atomically publish all
  four and unpublish—but do not delete—the demo ranking.

Friends, SSO, Admin tools, and broader dependency/performance maintenance remain
outside this feature scope.

## 6. Instructions for the Next Session

1. Read this document and
   `docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md` completely.
2. Inspect `git status --short --branch`, recent commits, staged changes, and the
   full working-tree diff before editing.
3. Confirm whether the user wants Task 1 reviewed, committed/pushed, or amended.
4. Do not start Task 2 until Task 1 is merged and the new branch is created from
   the updated `main`.
5. Do not import or fabricate ranking data. Task 3 requires user-provided videos
   and explicit approval of extracted tables.
6. Do not run destructive Git or database commands and do not terminate unknown
   processes.

## 7. Verification Commands

Run from the repository root after any material change:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run build
npm run test:e2e
git diff --check
```

When migration behavior changes, verify both the existing local database and a
clean temporary database. Record exact test counts and any skipped check.

## 8. Established Security and Runtime Invariants

- Local password credentials use scrypt; opaque server sessions expire after
  seven days and only token hashes are stored.
- Unsafe requests require the expected Origin, and authentication attempts are
  rate-limited.
- `/api/me/*` is authenticated and user-scoped. Logout/authentication failure
  cancels and removes private query data.
- Public Practice Library projections never select or return private notes.
- Top 10 remains capped at ten contiguous positions; Practice Library remains
  unbounded with its existing status and note semantics.
- `npm run dev` uses Vite 5173 and Express 3001. Production also defaults to
  3001, so development and production-shaped servers cannot use defaults at the
  same time.
- Do not use `npm audit fix --force`.
