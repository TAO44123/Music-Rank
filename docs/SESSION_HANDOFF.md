# Music Rank — Session Handoff

> Last updated: 2026-09-15 (America/New_York)
>
> Feature authority: `docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md`
>
> Task 1 design: `docs/RANKING_CATALOG_DESIGN.md`

## 1. Current Status

Task 1 and its UI refinement are implemented on the Task 1 stack. Task 3A has
also been implemented on a stacked local branch: the user-approved Bilibili
90s Mainland China Top 100 pilot is now locally published. The 90s Demo remains
in the database, with all 30 entries and songs intact, but is intentionally
unpublished. Task 3A is committed locally as `6729972`; no push, merge, Task 2
work, or additional unapproved ranking import has been performed.

The application now treats each published ranking as a first-class catalog item
with a source-neutral `/rankings/:slug` route. The published pilot is available
at `/rankings/90s-mainland-top-100` with 100 entries and its approved Bilibili
source link. `decade` and `region` are nullable display metadata rather than
routing dimensions or a uniqueness key. The UI uses one row of direct ranking
tabs, so future language or dialect rankings can overlap existing metadata.

Task 2 (user-submitted songs) and any further ranking imports have not started.
Task 3A implementation, the approved Cantonese import, and their desktop/mobile
acceptance gates are complete. The user authorized committing the latest local
working tree on 2026-09-15; push and merge authorization have not been given.

The user subsequently approved and imported a second published ranking,
`90s Cantonese Songs Top 70` (`90s-cantonese-top-70`). It has 72 continuous
entries, all with release years, a Bilibili source link, and no `region`
metadata. The generic importer now supports any positive count of contiguous
unique ranks; the original 100-entry pilot constraints remain data-specific,
not importer-wide.

After this addition, `npm run typecheck` passed; `npm test` passed (API 15/15,
Web 35/35 across 11 files, database 8/8); the production build passed with the
existing 821.00 KB bundle warning; and Playwright E2E passed 1/1. Desktop and
390 × 844 browser checks confirmed both direct ranking tabs, the optional 90s
chip without a region chip on the Cantonese ranking, the 72-song count, source
link, and no Console errors. The final dry run reused all 72 songs and entries.

## 2. Repository State

- Branch: `feature/90s-ranking-pilot`.
- The latest local commit is stacked on Task 3A commit `6729972`, Task 3A plan
  commit `2b0a0a3`, and Task 1 commits `be345ae` and `c15efc6`; it was never
  built from stale `9717ff3` alone. Use `git log -5 --oneline --decorate` for
  the exact current HEAD.
- The latest local commit contains the approved Cantonese manifest, generalized
  importer validation/publication, its regression test, and synchronized
  documentation. It has not been pushed or merged.
- Preserve every working-tree change. Do not reset, discard, or overwrite it.
- Use `git status --short --branch` and the live diff for the exact file list.
- Migrations through `0003_red_silver_samurai.sql` have been applied to the
  normal local database. `0003` renames the pilot slug, makes decade/region
  nullable, and removes published decade/region uniqueness.
- PostgreSQL uses 5432; Playwright uses 3101 temporarily. Do not terminate
  unknown development services.
- A 2026-09-15 read-only database check found the Mainland pilot published with
  100 entries, the Cantonese ranking published with 72 entries, and the Demo
  unpublished with all 30 entries retained.

## 3. Task 1 Implementation

### Database

- Added the `ranking_region` enum with `HK_TW` and `MAINLAND`.
- Added unique `slug`, positive `display_order`, and optional `decade_start` and
  `region` metadata to `rankings`.
- Stable slugs are the public identity. Published rankings may share optional
  decade/region metadata.
- Limited the current schema to the approved 1980 and 1990 decade starts.
- Forward migration `0002_bumpy_thor_girl.sql` backfills the known demo ranking
  before making the new fields non-null and fails rather than guessing if an
  unexpected pre-existing ranking needs classification.
- Seed now preserves the same demo ranking UUID, songs, entries, and personal
  data while naming it `90s Demo Ranking` and assigning the 1990/Mainland route.

### Contracts and API

- Shared contracts define a safe ranking slug and optional display mappings for
  `80s | 90s` and `hk-tw | mainland` metadata.
- `GET /api/rankings` returns only published catalog entries in deterministic
  display order, including route metadata and source availability but not the
  source URL itself.
- `GET /api/rankings/:slug` resolves one published ranking and returns
  its source URL, unfiltered `songCount`, entries, and ranking-scoped
  artist/release-year facets.
- Invalid slugs return `400 INVALID_REQUEST`; missing or unpublished rankings
  return `404 RANKING_NOT_FOUND`.
- Entry ordering remains based on the rank stored for that ranking, so one song
  can hold independent ranks in different rankings.

### Web application

- `/` redirects to the first published ranking in deterministic display order
  and preserves valid search state.
- `/rankings/$slug` owns the ranking page. Search text, artist,
  release year, page, and sign-in intent are validated URL search parameters.
- A lightweight page-level navigator uses one scrollable row of direct ranking
  tabs. Optional decade/region metadata appears as secondary header chips.
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

## 5. Task 3A Pilot — Current Implementation State

- Source link: the manifest stores the exact user-provided Bilibili URL,
  including its query string, for the page's `Watch source` action. Per the
  user's replacement instruction, the source page was not accessed or used to
  validate the replacement data.
- Authoritative data: on 2026-09-15 the user supplied
  `1990-1999内地流行歌曲TOP100.json` and directed the application to treat it as
  the sole source of truth. It was moved into the version-controlled manifest at
  `packages/database/manifests/90s-mainland-top-100.json` and wrapped
  with ranking/source metadata without changing its 100 entry values. Every row
  has a `releaseYear`.
- Exact source values: the previous canonicalizations at ranks 14, 37, and 79
  were removed. Titles, artist order, ranks, and years now match the supplied
  JSON exactly. Matching remains normalized exact matching; no fuzzy matching
  was added.
- Import tooling: `ranking-importer.ts` validates a versioned manifest, exactly
  100 contiguous unique ranks, unique normalized songs, metadata, source URL,
  and release-year shape. It exposes a dry run, transactional/idempotent import,
  atomic `--replace`, and a reusable publish operation that atomically
  unpublishes the retained Demo.
  `import-ranking.ts` and `publish-ranking.ts` are reusable CLI entry points.
- Replacement results: the old pilot ranking and its entries were deleted and
  recreated in one transaction. The replacement created 3 source-form songs,
  reused 97 exact songs, created 100 entries, preserved publication, and deleted
  no orphaned songs because every previous song remains referenced. A normal
  repeat import then reported 0 creates and 100 song/entry reuses.
- Publication: the pilot was then published and `90s-demo-ranking` was
  unpublished in the same transaction. A direct database check shows the pilot
  has 100 entries with ranks 1 through 100, 100 unique ranks, and 100 unique
  songs; the Demo remains with its 30 entries. Rerunning `npm run db:seed`
  retained the Demo's unpublished state.
- Seed behavior: rerunning the Demo seed preserves imported release years and
  verification status on shared songs as well as the Demo's unpublished state.
- Catalog identity refinement: the pilot slug is now
  `90s-mainland-top-100`; the API and Web route resolve rankings by slug.
  `decade` and `region` are nullable metadata, multiple published rankings may
  share them, and the UI presents direct ranking tabs rather than a two-level
  dimension selector.
- Tests: API fixtures own explicit rankings and no longer assume the Demo is
  published or has 30 songs. Database importer tests cover invalid
  continuity, dry run/no writes, idempotence, duplicate normalized songs,
  rollback after a late conflict, atomic replacement/orphan cleanup, and
  publication without deletion.
- Final verification: `npm run typecheck` passed; `npm test` passed (API 15/15,
  Web 35/35 across 11 files, database 8/8; contracts has no tests). The renamed
  manifest dry-run reused all 100 songs and 100 entries. Direct database checks
  show the pilot published with 100 entries, the Demo unpublished with 30,
  nullable decade/region columns, and no published-pair unique index. Full
  production build passed with the existing warning (821.00 KB, 256.48 KB
  gzip), Playwright E2E passed 1/1, and final `git diff --check` passed.
- Browser acceptance passed on the production-shaped local app at desktop and
  390 × 844 mobile sizes. The direct ranking tab, optional metadata chips,
  100-song count, full source link, responsive filters, and song actions were
  checked with no Console errors. This check found and fixed a mobile overlap
  between song metadata and action buttons; the final layout was rechecked.

## 6. Remaining Work

### Finish Task 1 delivery

- Push or merge the Task 1 commits only when the user explicitly asks.
- Merge Task 1 before creating Task 2 from an updated `main`.

### Finish current delivery

- The Task 3A and Cantonese implementations are committed locally. Do not push,
  open a PR, or merge without explicit authorization.
- Keep the approved manifest values unchanged unless the user supplies a new
  authoritative replacement and explicitly requests it.
- Ask the user to choose Task 2 or further Task 3 imports before creating
  another feature branch.

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
- Requires user-selected source URLs or authoritative data and explicit approval
  of every additional ranking table before import.
- Import each real ranking unpublished, validate it, and publish it only after
  its acceptance gate; preserve the unpublished Demo ranking and its entries.

Friends, SSO, Admin tools, and broader dependency/performance maintenance remain
outside this feature scope.

## 7. Instructions for the Next Session

1. Read this document and
   `docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md` completely.
2. Inspect `git status --short --branch`, recent commits, staged changes, and the
   full working-tree diff before editing.
3. Preserve both imported rankings and their current publication state; verify
   that `90s-mainland-top-100` and `90s-cantonese-top-70` are published and
   `90s-demo-ranking` is not.
4. Do not repeat completed desktop/mobile acceptance unless later UI changes
   require it; rerun the final diff check after edits.
5. Do not start Task 2 or the remaining Task 3 imports until the user reviews
   the pilot and chooses the next direction.
6. Do not run destructive Git or database commands and do not terminate unknown
   processes.

## 8. Verification Commands

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

## 9. Established Security and Runtime Invariants

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

## 10. Copy-Paste Prompt for the Task 3A Follow-up

```text
Continue the Music Rank ranking-catalog follow-up. Read docs/SESSION_HANDOFF.md and
docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md completely, then inspect and
preserve the working tree. The active branch is feature/90s-ranking-pilot at
the latest local commit, stacked on Task 3A commit 6729972 and Task 1 commits
be345ae and c15efc6. Use the live Git log for the exact HEAD.

The approved Bilibili 90s Mainland Top 100 pilot is already imported and
published as 90s-mainland-top-100. Its 100-entry manifest and reusable
importer are in packages/database. The Demo is intentionally unpublished but
still has its 30 entries. The user-provided JSON is the authoritative data set;
all 100 release years are populated, and the Bilibili URL is only the displayed
source link. Do not access the video to revalidate the data or alter publication
state unless I explicitly request it.

The approved 90s Cantonese Top 70 is also imported and published with 72 entries;
its region metadata is intentionally null. Desktop and 390 × 844 mobile
acceptance have passed for both rankings. Do not push or merge, and do not start
Task 2, further ranking imports, Admin work, fuzzy matching, or aggregation
without explicit user direction.

Communicate with me in Chinese; keep code, identifiers, commit messages, and
English project documents in English. If any required product decision is
unclear, ask instead of guessing.
```
