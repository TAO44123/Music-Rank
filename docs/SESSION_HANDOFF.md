# Music Rank — Session Handoff

> Last updated: 2026-09-15 (America/New_York)
>
> Feature authority: `docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md`
>
> Task 1 design: `docs/RANKING_CATALOG_DESIGN.md`

## 1. Current Status

The authentication and list-sharing iteration, compact visibility controls,
DESIGN-002 routing, DESIGN-006 responsive panels, the PR #4 account-label
regression guard, and PR #5's DESIGN-004 mobile bottom navigation are merged
and pushed to `main`. The ranking-catalog work is also synchronized, freshly
verified, and merged into `main` through `62292ba`. It adds the user-approved
90s Mainland China Top 100 and 90s Cantonese Songs Top 70 while retaining the
30-entry Demo as unpublished data.

The application now treats each published ranking as a first-class catalog item
with a source-neutral `/rankings/:slug` route. The published pilot is available
at `/rankings/90s-mainland-top-100` with 100 entries and its approved Bilibili
source link. `decade` and `region` are nullable display metadata rather than
routing dimensions or a uniqueness key. The UI uses one row of direct ranking
tabs, so future language or dialect rankings can overlap existing metadata.

Task 2 (user-submitted songs) and any further ranking imports have not started.
Task 3A implementation, the approved Cantonese import, and their desktop/mobile
acceptance gates are complete. On 2026-09-15 the user explicitly authorized
synchronizing, pushing, and merging this ranking branch.

Established application behavior remains:

- Local username/password registration and login.
- Opaque server-managed cookie sessions that expire after seven days.
- Anonymous access to the global ranking and explicitly public personal lists.
- Independent `private`/`public` settings for My Top 10 and My Singing List; both default to `private`.
- A shareable `/u/:username` page that shows only lists the owner has made public.
- `PUBLIC` currently means accessible through the shareable profile URL. There is no public directory, user search, feed, or other in-app discovery path.
- Public Singing List responses omit private notes.
- Existing demo data remains attached to the credential-free demo user and is private.
- TanStack Router owns the code-based route tree: `/`, guarded `/personal`, guarded `/practice`, and public `/u/:username`.
- At 600px and above, authenticated users see The Ranking, Personal Ranking, and Practice Library in the top tab bar; anonymous users see only The Ranking.
- Below 600px, all visitors see the same three fixed bottom-navigation destinations. For an anonymous visitor, Personal and Practice are buttons that open sign-in without changing the URL.
- The anonymous destination-count difference between phone and desktop is intentional for this release: on 2026-09-15 the user accepted it as non-blocking and asked that it remain unchanged.
- Ranking filters are validated URL search parameters, so they survive refresh and browser history navigation.
- User-facing copy now says Practice Library; database, API, error-code, and component identifiers retain the existing `singing` terminology.
- DESIGN-006 keeps RankingPanel, TopListPanel, SingingListPanel, and the account header usable without horizontal overflow from 320px upward. Narrow rows move actions below text; desktop layouts remain side by side.
- Future SSO is supported by the separation between users, credentials, and sessions, but no SSO provider tables or routes are part of this iteration.

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

- Branch: `main`, tracking `origin/main`; the local delivery merge is `62292ba`
  and the final documentation refresh sits on top of it.
- The synchronized feature branch is pushed at `ecd1e45`; its pre-integration
  tip was `d2ef428`.
- PR #3, PR #4, and PR #5 are already merged; the ranking integration preserves
  their responsive panels, account-label guard, and mobile bottom navigation.
- The ranking commits include Task 1 (`be345ae`, `c15efc6`), the Task 3A plan
  (`2b0a0a3`), the Mainland import (`6729972`), and the Cantonese import
  (`d2ef428`).
- The user authorized pushing the synchronized feature branch and merging it
  into `main` on 2026-09-15.
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
- Anonymous visitors see the global ranking and a sign-in/register entry point.
- Authentication uses a dialog with separate login and registration modes.
- Authenticated users can edit personal lists and independently publish or privatize each list from a compact lock button in its panel header. A closed lock means private and an open lock means public; a small label beneath the list title states the current visibility. Publishing still requires confirmation, while returning to private is immediate. Public lists also show a curved-arrow share action, using the native share sheet when available and copying the link as a fallback.
- TanStack Router provides one root layout plus The Ranking (`/`), Personal Ranking (`/personal`), Practice Library (`/practice`), and public profile (`/u/:username`) routes.
- `/personal` and `/practice` use Session-backed route guards; anonymous deep links return to `/` and open the sign-in dialog.
- The ranking page is full-width. Personal Ranking and Practice Library are independent full-width pages rather than side columns.
- Ranking text, artist, and year filters are validated as URL search parameters and update with history replacement.
- `/u/:username` is the shareable public profile route.
- On logout or an authentication failure, in-flight personal queries are cancelled, cached private data is erased, and personal query entries are removed after observers detach.
- DESIGN-006 moves narrow-screen list actions into normal document flow, adds responsive panel padding/header layouts, and truncates only the painted account-button username while preserving its full accessible name.
- DESIGN-004 moves primary navigation to a fixed bottom bar below 600px, reserves content and Snackbar clearance, and keeps the existing top tab bar at 600px and above.

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

### Integration baseline verification

- API integration tests: 11 passing.
- Web tests: 10 files and 28 tests passing; the complete Web suite passed three consecutive parallel runs after the timing fix.
- Playwright E2E on `main`: 1 passing. The DESIGN-006 branch adds `e2e/responsive.spec.ts`, bringing the development branch to 2 E2E cases.
- TypeScript typecheck and production build: passing.
- Production-shaped startup, `/api/health`, database health, and history fallback for `/personal`: passing.
- PR #2 and PR #1 merge simulation and actual merge: no conflicts.
- No CRLF, Windows-only path, or executable-mode pollution was found in either PR.

Fresh PR #3 verification on September 15, 2026 used an isolated temporary database because the normal local database and ignored build artifacts belong to the newer ranking-catalog branch:

- `npm run typecheck`: passed.
- API integration tests: 11/11 passed.
- Web tests: 10 files and 28/28 passed.
- Database workspace: no source tests in this branch; ignored `dist/**` artifacts were excluded.
- Production build: passed; the main asset was 818.17 KB (255.26 KB gzip).
- Playwright E2E: 2/2 passed, including the 320–900px responsive regression.
- The first normal-database run was invalidated by the newer local schema/data and ignored artifacts; it was not treated as a product failure.

Fresh PR #4 and PR #5 verification on September 15, 2026 used the same isolated-database approach:

- PR #4: typecheck passed and Playwright passed 3/3, covering the account-label pixel guard, the primary flow, and responsive behavior.
- PR #5: typecheck passed; API integration tests passed 11/11; Web tests passed 33/33 across 11 files; the database workspace had no source tests; and the production build passed.
- PR #5 Playwright passed 3/3, including the DESIGN-004 bottom-bar breakpoint, fixed positioning, content clearance, and notification-clearance assertions.
- The PR #5 main asset was 822.18 KB (256.41 KB gzip). The existing bundle-size warning remains non-blocking.

The Web test configuration now uses a 10-second per-test timeout, and the ranking-loading assertion uses a targeted 5-second async wait. This keeps normal file parallelism while avoiding load-sensitive failures observed with the default limits.

Fresh synchronized-branch verification on September 15, 2026 passed:

- `npm run typecheck`: passed for every workspace.
- API integration tests: 15/15 passed.
- Web tests: 12 files and 40/40 passed.
- Database importer integration tests: 8/8 passed; Contracts has no source tests.
- Production build: passed; the main asset was 826.41 KB (258.01 KB gzip).
- Playwright on a clean temporary database: 3/3 passed, covering the catalog
  critical path, account-label pixel guard, and 320–900px responsive/bottom-nav
  behavior.
- Clean migration and Seed produced the expected published 30-entry Demo.
- The normal database remained intact: Mainland 100 and Cantonese 72 are
  published, while the 30-entry Demo is retained and unpublished.
- The first all-workspace test attempt was blocked only by sandbox database
  access (`EPERM`); the identical command passed with local PostgreSQL access.

### Completed delivery

- The Task 3A and Cantonese implementations are synchronized, freshly verified,
  pushed, and merged into `main`.
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

## 10. Copy-Paste Prompt for the Next Follow-up

```text
Continue Music Rank from the integrated main branch. Read docs/SESSION_HANDOFF.md
and docs/RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md completely, then inspect
and preserve the working tree. The ranking catalog was merged through 62292ba;
use the live Git log for the final documentation commit and remote state.

The approved Bilibili 90s Mainland Top 100 pilot is already imported and
published as 90s-mainland-top-100. Its 100-entry manifest and reusable
importer are in packages/database. The Demo is intentionally unpublished but
still has its 30 entries. The user-provided JSON is the authoritative data set;
all 100 release years are populated, and the Bilibili URL is only the displayed
source link. Do not access the video to revalidate the data or alter publication
state unless I explicitly request it.

The approved 90s Cantonese Top 70 is also imported and published with 72 entries;
its region metadata is intentionally null. Desktop and mobile acceptance have
passed for both rankings, including the integrated bottom navigation and
responsive panels. Do not start Task 2, further ranking imports, Admin work,
fuzzy matching, or aggregation without explicit user direction.

Communicate with me in Chinese; keep code, identifiers, commit messages, and
English project documents in English. If any required product decision is
unclear, ask instead of guessing.
```
