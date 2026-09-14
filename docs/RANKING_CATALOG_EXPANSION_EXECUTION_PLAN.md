# Ranking Catalog Expansion — Cross-Session Execution Plan

> Status: Approved for implementation, split into three sequential tasks
>
> Last updated: 2026-09-14 (America/New_York)
>
> Base commit: `9717ff3` (`docs: refresh handoff and engineering guide`)
>
> Task 1 branch: `feature/ranking-catalog-expansion`
>
> Project-wide handoff authority: `docs/SESSION_HANDOFF.md`

## 1. Purpose

This document is the self-contained execution playbook for the Ranking Catalog
Expansion feature. It is intended to be read at the start of every session so
that the three tasks can be implemented in separate contexts without losing
approved product decisions, safety constraints, dependencies, or verification
requirements.

The feature has two product outcomes:

1. Replace the single-ranking experience with published rankings organized by
   decade and region, backed by one reviewed YouTube source per ranking.
2. Let authenticated users add a song that is not yet in the catalog directly
   from Personal Ranking or Practice Library. User-submitted songs enter the
   shared catalog but do not enter any public ranking automatically.

Implementation is split into three sequential branches and pull requests:

| Task | Branch | Dependency |
| --- | --- | --- |
| 1. Multi-ranking foundation and navigation | `feature/ranking-catalog-expansion` | Starts at `9717ff3` |
| 2. User-submitted songs | `feature/user-submitted-songs` | Start from `main` after Task 1 is merged |
| 3. YouTube import and production ranking data | `feature/ranking-data-import` | Start from `main` after Tasks 1 and 2 are merged |

Do not combine unfinished work from separate task branches. Do not start Task 2
or Task 3 from a stale `main`. Each task must be independently reviewable and
must pass its own acceptance gate before it is merged.

## 2. Source of Truth and Conflict Resolution

At the beginning of every session, use the following precedence:

1. The user's latest explicit instruction.
2. Live repository state: branch, HEAD, working tree, schema, migrations, and
   tests.
3. This feature execution plan for approved scope and task boundaries.
4. `docs/SESSION_HANDOFF.md` for project-wide status and operating rules.
5. Older design or planning documents.

If these sources conflict, do not discard or overwrite work. Report the exact
conflict to the user and resolve it before changing code.

This plan does not authorize committing, pushing, opening a pull request,
merging, deleting branches, or changing production data unless the user asks
for that action.

## 3. Approved Product Decisions

### 3.1 Ranking taxonomy

- Rankings use two dimensions: `decade × region`.
- The first production set contains exactly four rankings:
  - 80s Hong Kong/Taiwan
  - 80s Mainland China
  - 90s Hong Kong/Taiwan
  - 90s Mainland China
- Each ranking has exactly one YouTube video source.
- The ranking page only needs to display a link to the original video. It does
  not need to display the channel name, video title, publication date, or other
  YouTube metadata.
- The recommended and approved public paths are:
  - `/rankings/80s/hk-tw`
  - `/rankings/80s/mainland`
  - `/rankings/90s/hk-tw`
  - `/rankings/90s/mainland`
- `/` resolves or redirects to `/rankings/90s/mainland`.
- Ranking text, artist, release-year, and pagination state remain URL-backed so
  refresh and browser history preserve the current view.
- When switching decade or region, preserve text search, clear the
  ranking-scoped artist and release-year filters, and reset the result page to
  page 1.
- Artist and release-year filter options must be derived from the selected
  ranking, not from every row in `songs`.

### 3.2 Existing demo ranking

- Preserve the current ranking, ranking entries, and songs.
- Rename the ranking to `90s Demo Ranking`.
- Keep it published while Tasks 1 and 2 are being developed so the local UI has
  usable data.
- The four real rankings are imported as unpublished data first.
- After all four real rankings have been reviewed and verified, publish the four
  real rankings and unpublish the demo ranking in one controlled operation.
- Do not delete the demo ranking or its songs.
- Automated tests must use explicit fixtures and must not depend on whichever
  published ranking happens to be returned first.

### 3.3 Source extraction and release years

- The user will provide one YouTube URL for each ranking.
- Extract rank, song title, artist, and an optional reliable video timestamp.
- Do not invent or infer entries that cannot be read reliably from the video.
- Present an extracted ranking table to the user before importing it.
- Import only after the user confirms or corrects the table.
- If the video does not provide an exact release year, store `releaseYear` as
  `null`. Do not enrich it from an unapproved secondary source in this feature.

### 3.4 User-submitted songs

- The user enters only `title` and `artist`.
- The submitted song is stored in the shared `songs` table.
- Other users may search for and reuse it.
- It may appear in a public Personal Ranking or public Practice Library.
- It receives `verificationStatus = UNVERIFIED`.
- It does not receive a `ranking_entries` row and therefore does not appear in
  any public ranking.
- If an exact normalized title-and-artist match exists, show a confirmation
  dialog. Add the existing song only after the user confirms.
- A normal user may remove a song from their own list but may not edit or delete
  the shared song record.
- A future Admin feature will handle verification, correction, duplicate
  merging, and global deletion. Admin accounts and UI are not part of this
  feature.
- User-submitted songs may be shown on public personal-list pages, but Practice
  Library notes must remain private.

## 4. Technical Invariants That Must Not Regress

- `main` must remain runnable and should receive only reviewed work.
- Existing authentication, seven-day server sessions, Origin validation, and
  private cache behavior must continue to work.
- Anonymous visitors may read published rankings and explicitly public personal
  lists, but may not create songs or modify lists.
- Top 10 remains capped at ten entries and retains contiguous positions.
- Practice Library remains unbounded and retains its existing statuses and
  private notes.
- The same song may appear in several rankings with a different rank in each.
- The same song may be present in both of one user's personal lists.
- Existing demo-user data and registered-user data must survive forward
  migrations.
- Public Practice Library APIs must never select or return private notes.
- Do not run `npm audit fix --force` as part of this feature.
- Do not add speculative Admin, friends, SSO, or user-defined-list schema.

## 5. Standard Session Startup Checklist

Every implementation session must begin with this checklist before editing:

- [ ] Read this document completely.
- [ ] Read `docs/SESSION_HANDOFF.md` completely.
- [ ] Read the task-specific files listed in the relevant task section below.
- [ ] Run `git status --short --branch`.
- [ ] Run `git log -5 --oneline --decorate`.
- [ ] Inspect the working-tree and staged diffs.
- [ ] Confirm that the current branch matches the task.
- [ ] Confirm that the branch started from the required merged baseline.
- [ ] Preserve all pre-existing changes; do not reset or discard them.
- [ ] Report branch, HEAD, existing changes, and the current task scope to the
  user before implementation.
- [ ] If the working tree contains unexpected overlapping changes, stop and ask
  the user how to proceed.

Do not rerun the entire historical test suite merely to restate the old handoff.
Run checks in proportion to the current change, then run the task's required
acceptance gate before declaring the task complete.

## 6. Task 1 — Multi-Ranking Foundation and Navigation

### 6.1 Branch and objective

Branch: `feature/ranking-catalog-expansion`

Objective: implement the database metadata, read APIs, routes, and two-level UI
needed to navigate published rankings by decade and region. Keep the demo data
usable. Do not import the four production video rankings in this task.

### 6.2 Read before editing

- `packages/database/src/schema.ts`
- `packages/database/src/seed.ts`
- `packages/database/migrations/`
- `packages/contracts/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/src/services.ts`
- `apps/api/src/app.test.ts`
- `apps/web/src/api.ts`
- `apps/web/src/queries.ts`
- `apps/web/src/router.tsx`
- `apps/web/src/routes/index.tsx`
- `apps/web/src/components/RankingPanel.tsx`
- Ranking route and component tests
- `docs/ENGINEERING_GUIDE.md`

### 6.3 Database work

- [x] Add a controlled ranking-region representation for `HK_TW` and
  `MAINLAND`.
- [x] Add `decadeStart` to `rankings`; initial supported values are `1980` and
  `1990`.
- [x] Add a unique, stable `slug` to `rankings`.
- [x] Add positive `displayOrder` to `rankings`.
- [x] Keep the internal UUID as the relationship key.
- [x] Add indexes needed to resolve published rankings by decade and region.
- [x] Enforce at most one published ranking per decade-and-region combination.
  Archived or unpublished historical rows may share a combination.
- [x] Generate a forward-only Drizzle migration and inspect both SQL and
  migration metadata.
- [x] Backfill the existing demo ranking as decade `1990`, region `MAINLAND`,
  with a stable demo slug and display order.
- [x] Rename it to `90s Demo Ranking` without deleting entries or songs.
- [x] Keep the demo ranking published in Task 1.
- [x] Verify that existing personal-list and demo-user rows are preserved.

### 6.4 Contracts and API work

- [x] Add shared decade and region schemas.
- [x] Return decade, region, slug, display order, and source availability from
  `GET /api/rankings`.
- [x] Sort published rankings deterministically by display order.
- [x] Resolve a published ranking through decade and region path parameters.
- [x] Return `404 RANKING_NOT_FOUND` for missing or unpublished combinations.
- [x] Return the selected ranking's `sourceUrl` in its detail response.
- [x] Keep title/artist search and exact artist/release-year filtering.
- [x] Derive filter facets from songs joined through the selected ranking's
  `ranking_entries`; do not use the entire song catalog for ranking filters.
- [x] Keep response ordering by `ranking_entries.rank`.

### 6.5 Web routing and UI work

- [x] Add the four decade-and-region route shapes.
- [x] Make `/` resolve or redirect to `/rankings/90s/mainland`.
- [x] Keep `The Ranking` as the single primary navigation destination.
- [x] Add a decade selector for `80s` and `90s`.
- [x] Add a region selector for `Hong Kong/Taiwan` and `Mainland China`.
- [x] Derive available/disabled combinations from published ranking metadata.
- [x] Keep search, artist, release-year, and page state in validated URL search
  parameters.
- [x] Reset `page` to 1 when the ranking or any filter changes.
- [x] Remove the hard-coded `Demo Data` badge and derive presentation from the
  current ranking.
- [x] Show a `Watch original video` link only when `sourceUrl` is present.
- [x] Open external source links safely with `noopener` and `noreferrer`.
- [x] Preserve anonymous ranking access and authenticated add-to-list actions.
- [x] Preserve guarded `/personal` and `/practice` behavior.

### 6.6 Task 1 tests

- [x] Migration preserves all existing records.
- [x] Four explicit test fixtures cover the supported combinations.
- [x] Only published rankings appear in the list API.
- [x] Published rankings have deterministic order.
- [x] The same song can have independent ranks in different rankings.
- [x] Missing and unpublished combinations return 404.
- [x] Ranking filter facets exclude catalog-only songs.
- [x] `/` reaches the approved default ranking.
- [x] Decade and region controls navigate to stable URLs.
- [x] Refresh and browser history restore the selected ranking and filters.
- [x] Switching ranking or filters resets the result page.
- [x] Source links render only when available.
- [x] Anonymous users still make no `/api/me/*` requests.
- [x] Existing authentication and tab-navigation tests remain green.

### 6.7 Task 1 acceptance gate

Run from the repository root:

```bash
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run build
npm run test:e2e
git diff --check
```

Before reporting completion:

- [x] Inspect the final diff and generated migration.
- [x] Confirm that no production ranking data was fabricated or imported.
- [x] Confirm that the demo ranking remains published and usable.
- [x] Update this document's progress log.
- [x] Update `docs/SESSION_HANDOFF.md` with the live branch, commits, tests, and
  remaining work.
- [x] Do not commit or push without user authorization.

### 6.8 Suggested Task 1 commit groups

1. `docs: define ranking catalog expansion`
2. `feat(db): add ranking taxonomy metadata`
3. `feat(api): serve rankings by decade and region`
4. `feat(web): add ranking category navigation`
5. `test: cover multi-ranking navigation`

## 7. Task 2 — User-Submitted Songs

### 7.1 Branch and objective

Branch: `feature/user-submitted-songs`

Create this branch from updated `main` only after Task 1 has been merged.

Objective: let authenticated users submit a title and artist from Personal
Ranking or Practice Library, reuse exact existing matches after confirmation,
and add the resolved song to the selected personal list atomically.

### 7.2 Read before editing

- This entire document, including the completed Task 1 progress entry
- `packages/database/src/schema.ts`
- The Task 1 migration and current migration metadata
- `packages/database/src/seed.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/app.ts`
- `apps/api/src/services.ts`
- `apps/api/src/errors.ts`
- `apps/api/src/app.test.ts`
- `apps/web/src/api.ts`
- `apps/web/src/queries.ts`
- `apps/web/src/shell/AppShellContext.tsx`
- `apps/web/src/components/TopListPanel.tsx`
- `apps/web/src/components/SingingListPanel.tsx`
- `apps/web/src/routes/personal.tsx`
- `apps/web/src/routes/practice.tsx`
- `apps/web/src/routes/u.$username.tsx`
- Relevant Web tests and `e2e/music-rank.spec.ts`

### 7.3 Database and normalization work

- [ ] Add nullable `submittedByUserId` to `songs`.
- [ ] Reference `users.id` with behavior that preserves the shared song if the
  submitting account is later removed; clear the attribution instead of
  deleting the song.
- [ ] Add an index suitable for future Admin attribution queries.
- [ ] Keep the normalized-title-and-artist unique constraint.
- [ ] Make production song creation explicitly set a verification status;
  user-submitted rows must be `UNVERIFIED`.
- [ ] Centralize the normalization function so seed, imports, duplicate checks,
  and user creation cannot drift.
- [ ] Normalization for this task is exact after trimming and case
  normalization. Do not implement fuzzy matching, alias resolution, or
  simplified/traditional Chinese conversion.
- [ ] Generate and inspect a forward-only migration.

### 7.4 Contracts and error behavior

- [ ] Add trimmed, non-empty `title` and `artist` schemas with bounded lengths.
- [ ] Define request variants for an existing `songId` and a new `{ title,
  artist }` submission.
- [ ] Define `SONG_ALREADY_EXISTS` as a 409 response containing only the safe
  existing-song summary required for confirmation.
- [ ] Keep the existing duplicate-list and Top 10 capacity errors distinct.
- [ ] Ensure malformed bodies do not create songs or list entries.

### 7.5 API and transaction work

- [ ] Extend the Top 10 add flow to accept either an existing song or a new
  title-and-artist submission.
- [ ] Add the corresponding create-and-add flow for Practice Library while
  preserving the current update endpoint for status and note edits.
- [ ] Require authentication and the existing unsafe-request Origin checks.
- [ ] For a new Top 10 submission, check capacity before leaving any new song
  record behind.
- [ ] Resolve the normalized exact duplicate before insertion.
- [ ] If a duplicate exists, return 409 and do not alter the user's list.
- [ ] After UI confirmation, add the returned existing `songId` through the
  normal existing-song path.
- [ ] If no duplicate exists, create the `UNVERIFIED` song and list entry in one
  transaction.
- [ ] Handle a concurrent unique-key race by resolving the winning existing song
  and returning the same duplicate-confirmation result.
- [ ] Never create a `ranking_entries` row from this flow.
- [ ] Do not add user-facing edit or global-delete endpoints.
- [ ] Keep public-list projections unchanged except that submitted songs may now
  naturally appear through the existing joins.

### 7.6 Web work

- [ ] Add an `Add a song not listed` action to Personal Ranking.
- [ ] Add the same action to Practice Library.
- [ ] Collect only title and artist.
- [ ] Apply client validation but treat the API as authoritative.
- [ ] Disable or clearly block Top 10 submission at capacity.
- [ ] Prevent duplicate form submissions while a request is pending.
- [ ] On 409, show the existing title and artist in a confirmation dialog.
- [ ] On confirm, add the existing song by ID.
- [ ] On cancel, make no mutation.
- [ ] Add a new Top 10 song at the final position.
- [ ] Add a new Practice Library song with `WANT_TO_LEARN` and no note.
- [ ] Preserve the existing status/note editor after creation.
- [ ] Invalidate only the authenticated user's relevant private queries.
- [ ] Preserve logout and unauthorized-response cache cleanup.
- [ ] Provide accessible labels, focus return, pending state, and error text for
  both dialogs.

### 7.7 Task 2 tests

- [ ] Anonymous submission is rejected.
- [ ] A new submission creates one `UNVERIFIED` song with submitter attribution.
- [ ] It atomically creates the correct personal-list entry.
- [ ] It creates no ranking entry.
- [ ] An exact duplicate returns 409 and does not modify the list.
- [ ] Confirmation reuses the existing shared song.
- [ ] Concurrent duplicate creation produces one shared song record.
- [ ] A full Top 10 produces no orphan song.
- [ ] A song already in the target list is not duplicated.
- [ ] Another user can search for and reuse a submitted song.
- [ ] A submitted song may appear on a public personal page.
- [ ] Public Practice Library output still omits notes.
- [ ] Both forms cover validation, pending, cancel, confirm, success, and error
  states.
- [ ] Authentication loss still clears private queries and redirects guarded
  routes.
- [ ] E2E covers creation in both personal pages and absence from public
  rankings.

### 7.8 Task 2 acceptance gate

Run the same full command set listed in Task 1. In addition:

- [ ] Query the database or assert through integration tests that submitted
  songs have zero ranking entries.
- [ ] Confirm that no global song edit/delete UI or route was added.
- [ ] Confirm that the two existing list types and their visibility behavior
  remain unchanged.
- [ ] Update this document's progress log and `docs/SESSION_HANDOFF.md`.
- [ ] Do not commit or push without user authorization.

### 7.9 Suggested Task 2 commit groups

1. `feat(db): track user-submitted songs`
2. `feat(api): create or reuse personal-list songs`
3. `feat(web): add unlisted-song forms`
4. `test: cover user-submitted song flows`

## 8. Task 3 — YouTube Import and Production Ranking Data

### 8.1 Branch and objective

Branch: `feature/ranking-data-import`

Create this branch from updated `main` only after Tasks 1 and 2 have been
merged.

Objective: build a reviewable and idempotent import process, extract and obtain
approval for four source videos, import the production rankings, switch
publication from the demo ranking to the real rankings, and complete end-to-end
verification.

### 8.2 Required user inputs

The task cannot finish without one user-approved URL for each item:

| Ranking | YouTube URL | Extraction approved | Imported |
| --- | --- | --- | --- |
| 80s Hong Kong/Taiwan | TBD | [ ] | [ ] |
| 80s Mainland China | TBD | [ ] | [ ] |
| 90s Hong Kong/Taiwan | TBD | [ ] | [ ] |
| 90s Mainland China | TBD | [ ] | [ ] |

Do not substitute a different video without explicit user approval.

### 8.3 Import tooling

- [ ] Define a version-controlled ranking manifest format containing ranking
  identity, source URL, ordered title/artist pairs, and optional video
  timestamps.
- [ ] Validate the manifest with a schema shared by dry-run and import modes.
- [ ] Add a repository script that accepts one explicit manifest path.
- [ ] Add `--dry-run` support that performs no database writes.
- [ ] Report rows to create, rows to reuse, exact duplicates, invalid ranks,
  missing fields, and source metadata errors.
- [ ] Require positive, contiguous, unique ranks.
- [ ] Reject duplicate normalized songs within one ranking.
- [ ] Reuse existing shared songs by normalized title and artist.
- [ ] Create reviewed source songs as `VERIFIED`.
- [ ] Leave `releaseYear = null` unless the approved video explicitly provides
  an exact year.
- [ ] Import the ranking and entries in one transaction.
- [ ] Keep imported rankings unpublished until the final publication gate.
- [ ] Make repeat execution idempotent and test it explicitly.
- [ ] Never use `rank` or array position alone as a permanent entry identity.

### 8.4 Per-video extraction gate

Repeat this exact sequence for each of the four videos:

1. Record the user-provided URL in the table above.
2. Extract the visible ranking without filling unreadable gaps by guesswork.
3. Preserve video timestamps when reliably available.
4. Compare normalized title-and-artist pairs with the current database.
5. Present a numbered review table to the user with:
   - rank
   - song title
   - artist
   - existing/new status
   - timestamp when available
   - any uncertainty
6. Wait for explicit user approval or corrections.
7. Update the manifest with the approved values.
8. Run dry-run and show the summary.
9. Import the approved manifest.
10. Verify the stored order, source URL, song reuse, and unpublished state.
11. Mark the extraction and import checkboxes in this document.

### 8.5 Final publication switch

Perform this only after all four imports and their tests pass:

- [ ] Confirm all four real rankings are complete and still unpublished.
- [ ] Confirm every source URL matches the user-approved URL.
- [ ] Confirm no unresolved extraction uncertainty remains.
- [ ] In one controlled transaction, publish all four real rankings and
  unpublish `90s Demo Ranking`.
- [ ] Confirm `/` now resolves to the real 90s Mainland ranking.
- [ ] Confirm the demo ranking, entries, and songs still exist.
- [ ] Confirm the demo ranking is absent from public ranking discovery.

### 8.6 Task 3 tests and final verification

- [ ] Manifest validation rejects gaps, duplicate ranks, and duplicate songs.
- [ ] Dry-run performs zero writes.
- [ ] Repeating an import creates no duplicate records.
- [ ] Existing songs are reused correctly.
- [ ] All four routes show the approved order and source link.
- [ ] User-submitted catalog-only songs remain absent from all rankings.
- [ ] Ranking filters remain scoped to the selected ranking.
- [ ] Full E2E covers all four ranking combinations.
- [ ] Full E2E covers user submission, duplicate confirmation, public personal
  display, and private-note omission.
- [ ] Production build and production-shaped startup succeed.
- [ ] `/api/health` reports both application and database healthy.
- [ ] History fallback works for ranking, personal, and practice routes.
- [ ] `git diff --check` reports no whitespace errors.
- [ ] No CRLF, path, or executable-mode pollution is introduced.

Run the full acceptance command set from Task 1, plus the production-shaped
startup checks documented in `docs/LOCAL_DEVELOPMENT_NOTES.md`.

### 8.7 Suggested Task 3 commit groups

1. `feat(db): add idempotent ranking importer`
2. `data: add reviewed 80s rankings`
3. `data: add reviewed 90s rankings`
4. `data: publish sourced rankings`
5. `test: verify production ranking catalog`
6. `docs: refresh ranking catalog handoff`

## 9. Cross-Task API Contract Target

The exact implementation may evolve during review, but any deviation from this
target must be documented before code and tests diverge.

### 9.1 Ranking reads

```http
GET /api/rankings
GET /api/rankings/:decade/:region?q=&artist=&releaseYear=
```

Expected properties:

- List responses expose enough data to render the two-level selector.
- Detail responses include the ranking identity, source URL, filter facets, and
  ordered entries.
- Only published data is anonymously readable through these endpoints.

### 9.2 Personal-list song creation

```http
POST /api/me/top-list/items
POST /api/me/singing-list/items
```

Expected input modes:

```json
{ "songId": "existing-uuid" }
```

or:

```json
{ "song": { "title": "Song title", "artist": "Artist" } }
```

Expected duplicate response shape:

```json
{
  "code": "SONG_ALREADY_EXISTS",
  "message": "This song already exists. Confirm that you want to use it.",
  "existingSong": {
    "id": "existing-uuid",
    "title": "Song title",
    "artist": "Artist"
  }
}
```

Do not return submitter identity or other private metadata in the duplicate
response.

## 10. Scope Exclusions

The following are explicitly outside all three tasks:

- Admin authentication, roles, routes, or UI
- Editing or deleting shared songs by normal users
- Automatic duplicate merging
- Fuzzy title, artist alias, or simplified/traditional Chinese matching
- More decades or regions than the approved first four rankings
- Multiple sources or an aggregation algorithm for one ranking
- Automatic metadata enrichment from secondary sources
- User-created arbitrary lists from `DESIGN_005_USER_DEFINED_LISTS.md`
- Friends, followers, notifications, or `FRIENDS` visibility
- SSO, password reset, email verification, or account deletion
- Playlist import from Spotify, Apple Music, or other services

If any excluded item becomes necessary, stop and request an explicit scope
change instead of silently adding it.

## 11. Standard End-of-Session Handoff

Every session that changes the repository must leave a handoff entry with the
following information. Update both the progress log below and the project-wide
handoff when the change is material.

```markdown
### Session handoff — YYYY-MM-DD

- Task: 1 / 2 / 3
- Branch:
- HEAD:
- Working tree:
- Completed:
- Files/migrations added or changed:
- Decisions made:
- Tests run and exact results:
- Known warnings:
- Remaining checklist items:
- Current blocker or required user input:
- Safe next command/action:
- Commit/push/PR status:
```

Before ending a session:

- [ ] Record exact test counts, not only "tests passed."
- [ ] Record any test not run and why.
- [ ] Record pending migrations and whether they were applied locally.
- [ ] Record any running dev, production, database, or E2E processes and ports.
- [ ] Record uncommitted files and preserve them.
- [ ] Do not describe a task as complete if a required acceptance item remains.

## 12. Progress Log

### 2026-09-14 — Planning and branch setup

- Task: Preparation before Task 1
- Branch: `feature/ranking-catalog-expansion`
- HEAD: `9717ff3`
- Working tree before this document: clean
- Completed:
  - Pushed `9717ff3` to `origin/main`.
  - Created the feature branch from synchronized `main`.
  - Renamed the branch to `feature/ranking-catalog-expansion`.
  - Approved the three-task split and product decisions recorded above.
- Tests run: none; this session changed planning documentation only.
- Remaining: all implementation work in Tasks 1–3.
- External dependency: four user-selected YouTube source URLs are required for
  Task 3.
- Commit/push/PR status: this document is not yet committed or pushed.

### 2026-09-14 — Task 1 implementation complete

- Task: 1 — Multi-Ranking Foundation and Navigation
- Branch: `feature/ranking-catalog-expansion`
- HEAD: `9717ff3` (Task 1 remains in the uncommitted working tree)
- Completed:
  - Added ranking decade/region/slug/display-order metadata and forward migration
    `0002_bumpy_thor_girl.sql`.
  - Preserved and renamed the published demo ranking as `90s Demo Ranking` at
    the 90s/Mainland route.
  - Added shared path contracts, deterministic catalog discovery, dimension-
    based detail lookup, and ranking-scoped filter facets.
  - Added stable ranking routes, two-level category navigation, validated URL
    state including pagination, and a safe original-video link.
  - Updated Task 1 design, engineering guide, execution plan, and session
    handoff documentation.
- Data safety:
  - Existing local-table counts were unchanged across migration.
  - A separate clean temporary database completed migrations and seed, then was
    removed.
  - No production ranking or YouTube-derived data was imported.
- Tests and checks:
  - `npm run typecheck`: passed.
  - `npm test`: API 15/15; Web 11 files and 34/34; other workspaces had no test
    files and exited successfully.
  - `npm run build`: passed with the known bundle-size warning.
  - `npm run test:e2e`: Playwright 1/1 passed.
  - Manual in-app browser checks passed on desktop and 390 × 844 mobile, with no
    console errors.
  - Final whitespace and diff checks passed after documentation updates.
- Known warnings: existing Vite bundle-size warning, third-party Zod annotation
  warnings, Playwright color warnings, and jsdom `scrollTo()` test notices.
- Remaining: user review and explicit authorization before commit/push; then
  merge Task 1 before branching Task 2 from updated `main`.
- Blocker: none for Task 1 implementation. Task 3 still requires four
  user-selected YouTube source URLs and approval of extracted tables.
- Commit/push/PR status: Task 1 is not committed, pushed, or opened as a PR.
