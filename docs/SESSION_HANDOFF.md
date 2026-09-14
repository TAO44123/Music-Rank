# Music Rank — Session Handoff

> Last updated: 2026-09-14 (America/New_York)
>
> Feature authority: `docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md`
>
> Task 1 design: `docs/RANKING_CATALOG_DESIGN.md`

## 1. Current Status

Task 1 of the approved Ranking Catalog Expansion and its follow-up UI refinement
are implemented, verified, and committed locally. The next approved work is
Task 3A, a single-ranking pilot import that will run before the user decides
whether to import more rankings or proceed to Task 2. No production video data
has been imported yet.

The application now supports published rankings identified by `decade × region`
with stable routes. The existing dataset is preserved as the published `90s Demo
Ranking` at `/rankings/90s/mainland`. The initial supported dimensions are 80s
and 90s with Hong Kong/Taiwan and Mainland China regions. Combinations without a
published ranking are shown as unavailable.

Task 2 (user-submitted songs) and the remaining full Task 3 import have not
started. Their approved scope and acceptance gates are recorded in the feature
execution plan.

## 2. Repository State

- Branch: `feature/ranking-catalog-expansion`.
- Latest implementation commit: `c15efc6` — `feat: refine ranking catalog
  presentation`; it follows Task 1 commit `be345ae`.
- The feature branch started from `9717ff3`, which remains synchronized with
  `origin/main`.
- Both implementation commits are local and unpushed. The Task 3A handoff update
  follows them as documentation-only work. The user has not authorized a push.
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

- Push or merge the Task 1 commits only when the user explicitly asks.
- Merge Task 1 before creating Task 2 from an updated `main`.

### Next approved task: Task 3A — Pilot Ranking Import

Objective: import exactly one user-approved 90s Chinese-language Top 100 source
as a pilot, display it locally, and let the user evaluate the real-data
experience before choosing more imports or Task 2.

Branch: `feature/90s-ranking-pilot`.

Preferred baseline: the latest `feature/ranking-catalog-expansion` HEAD that
contains both `be345ae` and `c15efc6` plus this handoff. If Task 1 is pushed and
merged first, create the pilot branch from updated `main`. If it is not merged,
the pilot may be a clearly documented stacked local branch from the latest Task
1 HEAD; do not start from stale `main` at `9717ff3`.

The next session must obtain or confirm these inputs before changing the data
model or importing data:

1. The exact YouTube source URL.
2. Whether the video explicitly assigns ranks 1–100 or merely presents 100
   songs in playback order.
3. Whether “90s Chinese-language” means Mainland China, Hong Kong/Taiwan, or a
   mixed Greater China selection.

Do not guess any of these answers. Apply this decision boundary:

- If the source has explicit ranks and maps cleanly to `mainland` or `hk-tw`,
  the current `rank` model can be used.
- If it is an unranked collection, stop before import and propose the smallest
  reviewed schema/UI change for ranked versus curated collections. Never turn
  playback order into a claimed rank.
- If it mixes Mainland and Hong Kong/Taiwan, stop before import and ask whether
  to split it or add a third region. Adding a region requires an approved schema,
  contract, route, navigation, and test change.

Required pilot workflow:

1. Inspect the live branch, status, migrations, seed, tests, and this handoff.
2. Create or switch to `feature/90s-ranking-pilot` from the correct Task 1
   baseline.
3. Open and inspect the user-provided video. Extract only source-supported rank,
   title, artist, and optional timestamp. Keep release year `null` unless the
   approved source states it.
4. Present the complete extracted table to the user. Import nothing until the
   user confirms or corrects it.
5. Store the approved data in a version-controlled manifest and use a reusable,
   transactional, idempotent importer. Reuse exact normalized songs instead of
   duplicating them.
6. Validate exactly 100 entries, contiguous unique ranks when ranked, unique
   songs within the pilot, one source URL, and rollback on any invalid row.
7. Import the pilot as unpublished first and verify it directly in the database.
8. Before publication, change the demo seed so rerunning it does not force an
   intentionally unpublished demo back to published. Otherwise it can conflict
   with the partial unique published decade/region index.
9. Remove test dependence on the seeded Demo title or 30-song count before
   switching publication. Tests must own explicit ranking fixtures.
10. After user/data approval, publish the pilot in one transaction. If it uses
    90s/Mainland, unpublish the Demo in the same transaction; preserve the Demo,
    its entries, and songs.
11. Verify catalog discovery, source link, `songCount`, scoped facets, search,
    pagination, desktop/mobile layout, database counts, and the full acceptance
    suite.

Do not implement user-submitted songs, Admin tooling, multiple-source
aggregation, fuzzy matching, or the remaining three rankings in Task 3A.

### Task 2 — User-submitted songs

- Planned branch: `feature/user-submitted-songs`, created from updated `main`
  only if the user selects Task 2 after reviewing the pilot.
- Add title/artist submission from Personal Ranking and Practice Library.
- Store shared songs as `UNVERIFIED`, support exact duplicate confirmation and
  reuse, and never create public ranking entries through this flow.
- Normal users may remove songs from their own lists but cannot edit or delete
  global song records.

### Task 3 — Ranking data import

- Planned branch: `feature/ranking-data-import`, used only if the user selects
  more rankings after reviewing the pilot.
- Requires the remaining user-selected YouTube URLs and user approval of every
  extracted ranking table before import.
- Import real rankings unpublished, validate them, then atomically publish all
  four and unpublish—but do not delete—the demo ranking.

Friends, SSO, Admin tools, and broader dependency/performance maintenance remain
outside this feature scope.

## 6. Instructions for the Next Session

1. Read this document and
   `docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md` completely.
2. Inspect `git status --short --branch`, recent commits, staged changes, and the
   full working-tree diff before editing.
3. Confirm the Task 3A source URL, ranking-versus-collection semantics, and
   region with the user; do not infer them.
4. Create `feature/90s-ranking-pilot` from the latest Task 1 state, or from
   updated `main` if Task 1 has already been merged.
5. Extract and present the complete table before any import. Do not fabricate
   ranks, release years, or unreadable entries.
6. Do not start Task 2 or the remaining Task 3 imports until the user reviews
   the pilot and chooses the next direction.
7. Do not run destructive Git or database commands and do not terminate unknown
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

## 9. Copy-Paste Prompt for the Task 3A Session

```text
Continue the Music Rank project with Task 3A — Pilot Ranking Import. Read
docs/SESSION_HANDOFF.md and
docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md completely before making any
change. Then inspect the current branch, HEAD, git status, diffs, schema,
migrations, seed behavior, and ranking tests. Preserve all existing work.

Use feature/90s-ranking-pilot. Base it on the latest Task 1 branch state that
contains commits be345ae and c15efc6 plus the Task 3A handoff, unless Task 1 has
already been merged; in that case start from updated main. Do not start from the
stale 9717ff3 main baseline.

The objective is to import one user-approved 90s Chinese-language Top 100 source
as a pilot and display it locally. Before implementation, ask me for the exact
YouTube URL and confirm: (1) whether the source explicitly ranks 1–100 or is only
an unranked collection, and (2) whether its region is Mainland China, Hong
Kong/Taiwan, or mixed. Do not infer these decisions.

Inspect the source and extract only supported rank, title, artist, and optional
timestamp. Do not invent rankings or release years. Present the complete table
for my approval before any database import. If the video is unranked or the
region is mixed, stop and propose the necessary model decision before importing.

After approval, use a version-controlled manifest and reusable transactional,
idempotent importer. Import unpublished first, validate exactly 100 entries and
all uniqueness/contiguity rules, isolate tests from Demo seed assumptions, and
make the seed preserve an intentionally unpublished Demo. Publish only after
validation; if the pilot occupies 90s/mainland, atomically unpublish the Demo
without deleting it. Run migration/seed checks, typecheck, full tests, build,
E2E, and desktop/mobile browser acceptance. Update both handoff documents with
exact results. Do not commit, push, merge, or broaden scope without my explicit
authorization.

Communicate with me in Chinese; keep code, identifiers, commit messages, and
English project documents in English. If any required product decision is
unclear, ask instead of guessing.
```
