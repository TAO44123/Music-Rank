# Ranking Catalog Expansion — Cross-Session Execution Plan

> Status: Task 1, Task 3A, and the approved Cantonese import are verified, pushed, and merged into `main`; Task 2 is implemented and verified locally on `feature/user-submitted-songs`, awaiting review before commit/push
>
> Last updated: 2026-09-15 (America/New_York)
>
> Original planning base: `9717ff3` (`docs: refresh handoff and engineering guide`)
>
> Task 1 branch: `feature/ranking-catalog-expansion`
>
> Integrated delivery: feature `ecd1e45`, main merge `62292ba`, handoff refresh `3606979`
>
> Project-wide handoff authority: `docs/SESSION_HANDOFF.md`

## 1. Purpose

This document is the self-contained execution playbook for the Ranking Catalog
Expansion feature. It is intended to be read at the start of every session so
that the tasks can be implemented in separate contexts without losing
approved product decisions, safety constraints, dependencies, or verification
requirements.

The feature has two product outcomes:

1. Replace the single-ranking experience with a catalog of independently named
   published rankings, each backed by one reviewed source.
2. Let authenticated users add a song that is not yet in the catalog directly
   from Personal Ranking or Practice Library. User-submitted songs enter the
   shared catalog but do not enter any public ranking automatically.

Implementation uses separate branches with a pilot decision gate before the
remaining feature order is chosen:

| Task | Branch | Dependency |
| --- | --- | --- |
| 1. Multi-ranking foundation and navigation | `feature/ranking-catalog-expansion` | Starts at `9717ff3` |
| 3A. One 90s Top 100 pilot | `feature/90s-ranking-pilot` | Next task; start from the latest Task 1 state or updated `main` after merge |
| 2. User-submitted songs | `feature/user-submitted-songs` | Start only if the user selects Task 2 after reviewing the pilot |
| 3. Remaining YouTube ranking imports | `feature/ranking-data-import` | Continue only if the user selects more rankings after reviewing the pilot |

Do not combine unfinished work from separate task branches. Do not start Task 2,
Task 3A, or the remaining Task 3 work from a stale baseline. Each task must be
independently reviewable and must pass its own acceptance gate before it is
merged.

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

### 3.1 Ranking identity and optional metadata

- Each ranking is a first-class catalog item identified publicly by a stable,
  source-neutral `slug`.
- `decade` and `region` are optional metadata, not routing dimensions or a
  uniqueness key.
- The initially planned source set still contains four rankings:
  - 80s Hong Kong/Taiwan
  - 80s Mainland China
  - 90s Hong Kong/Taiwan
  - 90s Mainland China
- Each ranking currently has one source URL.
- The ranking page only needs to display a link to the original video. It does
  not need to display the channel name, video title, publication date, or other
  platform metadata.
- Public paths use `/rankings/:slug`; source platform names must not appear in
  the slug solely because they host the source.
- `/` resolves or redirects to the first published ranking in deterministic
  display order.
- Ranking text, artist, release-year, and pagination state remain URL-backed so
  refresh and browser history preserve the current view.
- When switching rankings, preserve text search, clear the
  ranking-scoped artist and release-year filters, and reset the result page to
  page 1.
- Artist and release-year filter options must be derived from the selected
  ranking, not from every row in `songs`.

### 3.2 Existing demo ranking

- Preserve the current ranking, ranking entries, and songs.
- Rename the ranking to `90s Demo Ranking`.
- Keep it published while Tasks 1 and 2 are being developed so the local UI has
  usable data.
- Real rankings are imported as unpublished data first.
- The approved pilot may be published while the demo is unpublished in one
  controlled operation.
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

Objective: implement the database metadata, read APIs, routes, and UI needed to
navigate published rankings. Task 1 originally used decade and region as route
dimensions; the approved 2026-09-15 Task 3A refinement below supersedes that
identity model while preserving the foundation and demo data.

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
- [x] Task 3A refinement: make decade and region nullable metadata, remove the
  published-pair unique index, and resolve rankings by unique slug instead.
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
- [x] Task 3A refinement: replace the dimension lookup with
  `GET /api/rankings/:slug` and return nullable decade/region metadata.
- [x] Return `404 RANKING_NOT_FOUND` for missing or unpublished combinations.
- [x] Return the selected ranking's `sourceUrl` in its detail response.
- [x] Keep title/artist search and exact artist/release-year filtering.
- [x] Derive filter facets from songs joined through the selected ranking's
  `ranking_entries`; do not use the entire song catalog for ranking filters.
- [x] Keep response ordering by `ranking_entries.rank`.

### 6.5 Web routing and UI work

- [x] Add the four decade-and-region route shapes.
- [x] Make `/` resolve or redirect to a published ranking; Task 3A now chooses
  the first catalog item instead of a hard-coded dimension route.
- [x] Keep `The Ranking` as the single primary navigation destination.
- [x] Add a decade selector for `80s` and `90s`.
- [x] Add a region selector for `Hong Kong/Taiwan` and `Mainland China`.
- [x] Derive available/disabled combinations from published ranking metadata.
- [x] Task 3A refinement: replace the two-level selector with one row of direct
  ranking tabs and show optional decade/region values as secondary header chips.
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

### 6.9 Task 3A — Pilot Ranking Import

Branch: `feature/90s-ranking-pilot`.

Objective: import one user-approved 90s Chinese-language Top 100 source and show
it locally so the user can evaluate real-data behavior before deciding whether
to import more rankings or proceed to Task 2.

Baseline rules:

- Prefer updated `main` after Task 1 is pushed and merged.
- If Task 1 remains local, create a documented stacked branch from the latest
  `feature/ranking-catalog-expansion` HEAD containing `be345ae`, `c15efc6`, and
  the Task 3A handoff documentation.
- Never start from stale `main` at `9717ff3`.

Required user inputs before implementation:

- [x] Obtain the exact approved Bilibili video URL: `https://www.bilibili.com/video/BV1hF9mYoEPh/`.
- [x] Confirm whether the source explicitly ranks 1–100 or is an unranked
  collection presented in playback order.
- [x] Confirm whether the source belongs to Mainland China, Hong Kong/Taiwan, or
  mixes both regions.

The user explicitly approved this Bilibili source as a Task 3A variance from
the plan's original YouTube wording. It is an explicit reverse-order (100 to 1)
Mainland China ranking, not an inference from playback order.

Decision boundaries:

- [x] Use the existing rank model only when the source explicitly assigns ranks.
- [ ] If the source is an unranked collection, stop before import and obtain
  approval for a ranked-versus-collection model. Never claim playback order is
  rank.
- [ ] If the source mixes regions, stop before import and ask whether to split
  it or add a new region. Do not silently classify it as Mainland or HK/TW.

Extraction and approval:

- [x] Use the user-provided `1990-1999内地流行歌曲TOP100.json` as the authoritative
  replacement for rank, title, artist, and release year. Per explicit direction,
  do not access the Bilibili link or independently validate content accuracy.
- [x] Store all 100 `releaseYear` values supplied by that JSON without external
  enrichment or correction.
- [x] Present all 100 extracted rows to the user before any database write.
- [x] Apply the user's replacement instruction. Remove the earlier Demo
  canonicalizations at ranks 14, 37, and 79 so the stored title and artist order
  match the replacement JSON exactly.

Importer and data safety:

- [x] Store approved rows in a version-controlled manifest with source URL,
  optional decade/region metadata, and extraction notes.
- [x] Implement a reusable, transactional, idempotent importer; do not rely on
  ad hoc SQL pasted into the database.
- [x] Reuse exact normalized title-and-artist matches from `songs`.
- [x] Reject missing values, duplicate songs, duplicate ranks, non-contiguous
  ranked positions, counts other than 100, and unexpected source metadata.
- [x] Import the pilot as unpublished first and verify it in the database.
- [x] Modify the Demo seed upsert so it does not force an intentionally
  unpublished Demo back to published on later seed runs.
- [x] Make ranking tests own explicit fixtures and remove assumptions that the
  active 90s/Mainland ranking is the 30-song Demo.
- [x] Make the pilot slug source-neutral (`90s-mainland-top-100`), route and
  query by slug, permit published rankings to share optional metadata, and
  refactor the UI to direct ranking tabs.

Publication and acceptance:

- [x] Publish only after extraction and database verification are complete.
- [x] If the pilot occupies 90s/Mainland, publish it and unpublish the Demo in
  one transaction. Never delete the Demo ranking, entries, or songs.
- [x] Verify the manifest's approved entry count, expected song reuse/create
  counts, source URL, `songCount`, scoped facets, search, pagination, and stable
  route behavior.
- [x] Run database migration/seed checks, typecheck, full tests, production
  build, Playwright E2E, and `git diff --check`.
- [x] Desktop and 390 × 844 mobile interactive-browser checks passed on the
  production-shaped local app. The final layout has no Console errors; a mobile
  song-action overlap found during acceptance was fixed and rechecked.
- [x] Update `docs/SESSION_HANDOFF.md`, this progress log, and the engineering
  guide with exact results.
- [ ] Do not commit, push, merge, or expand scope without explicit user
  authorization in the Task 3A session.

Out of scope for Task 3A: user-submitted songs, Admin tools, aggregation across
multiple videos, fuzzy matching, and importing the other three production
rankings.

## 7. Task 2 — User-Submitted Songs

### 7.1 Branch and objective

Branch: `feature/user-submitted-songs`

Create this branch only after Task 1 is merged and the user selects Task 2 after
reviewing the Task 3A pilot.

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

- [x] Add nullable `submittedByUserId` to `songs`.
- [x] Reference `users.id` with behavior that preserves the shared song if the
  submitting account is later removed; clear the attribution instead of
  deleting the song.
- [x] Add an index suitable for future Admin attribution queries.
- [x] Keep the normalized-title-and-artist unique constraint.
- [x] Make production song creation explicitly set a verification status;
  user-submitted rows must be `UNVERIFIED`.
- [x] Centralize the normalization function so seed, imports, duplicate checks,
  and user creation cannot drift.
- [x] Normalization for this task is exact after trimming and case
  normalization. Do not implement fuzzy matching, alias resolution, or
  simplified/traditional Chinese conversion.
- [x] Generate and inspect a forward-only migration.

### 7.4 Contracts and error behavior

- [x] Add trimmed, non-empty `title` and `artist` schemas with bounded lengths.
- [x] Define request variants for an existing `songId` and a new `{ title,
  artist }` submission.
- [x] Define `SONG_ALREADY_EXISTS` as a 409 response containing only the safe
  existing-song summary required for confirmation.
- [x] Keep the existing duplicate-list and Top 10 capacity errors distinct.
- [x] Ensure malformed bodies do not create songs or list entries.

### 7.5 API and transaction work

- [x] Extend the Top 10 add flow to accept either an existing song or a new
  title-and-artist submission.
- [x] Add the corresponding create-and-add flow for Practice Library while
  preserving the current update endpoint for status and note edits.
- [x] Require authentication and the existing unsafe-request Origin checks.
- [x] For a new Top 10 submission, check capacity before leaving any new song
  record behind.
- [x] Resolve the normalized exact duplicate before insertion.
- [x] If a duplicate exists, return 409 and do not alter the user's list.
- [x] After UI confirmation, add the returned existing `songId` through the
  normal existing-song path.
- [x] If no duplicate exists, create the `UNVERIFIED` song and list entry in one
  transaction.
- [x] Handle a concurrent unique-key race by resolving the winning existing song
  and returning the same duplicate-confirmation result.
- [x] Never create a `ranking_entries` row from this flow.
- [x] Do not add user-facing edit or global-delete endpoints.
- [x] Keep public-list projections unchanged except that submitted songs may now
  naturally appear through the existing joins.

### 7.6 Web work

- [x] Add an `Add a song not listed` action to Personal Ranking.
- [x] Add the same action to Practice Library.
- [x] Collect only title and artist.
- [x] Apply client validation but treat the API as authoritative.
- [x] Disable or clearly block Top 10 submission at capacity.
- [x] Prevent duplicate form submissions while a request is pending.
- [x] On 409, show the existing title and artist in a confirmation dialog.
- [x] On confirm, add the existing song by ID.
- [x] On cancel, make no mutation.
- [x] Add a new Top 10 song at the final position.
- [x] Add a new Practice Library song with `WANT_TO_LEARN` and no note.
- [x] Preserve the existing status/note editor after creation.
- [x] Invalidate only the authenticated user's relevant private queries.
- [x] Preserve logout and unauthorized-response cache cleanup.
- [x] Provide accessible labels, focus return, pending state, and error text for
  both dialogs.

### 7.7 Task 2 tests

- [x] Anonymous submission is rejected.
- [x] A new submission creates one `UNVERIFIED` song with submitter attribution.
- [x] It atomically creates the correct personal-list entry.
- [x] It creates no ranking entry.
- [x] An exact duplicate returns 409 and does not modify the list.
- [x] Confirmation reuses the existing shared song.
- [x] Concurrent duplicate creation produces one shared song record.
- [x] A full Top 10 produces no orphan song.
- [x] A song already in the target list is not duplicated.
- [x] Another user can search for and reuse a submitted song.
- [x] A submitted song may appear on a public personal page.
- [x] Public Practice Library output still omits notes.
- [x] Both forms cover validation, pending, cancel, confirm, success, and error
  states.
- [x] Authentication loss still clears private queries and redirects guarded
  routes.
- [x] E2E covers creation in both personal pages and absence from public
  rankings.

### 7.8 Task 2 acceptance gate

Run the same full command set listed in Task 1. In addition:

- [x] Query the database or assert through integration tests that submitted
  songs have zero ranking entries.
- [x] Confirm that no global song edit/delete UI or route was added.
- [x] Confirm that the two existing list types and their visibility behavior
  remain unchanged.
- [x] Update this document's progress log and `docs/SESSION_HANDOFF.md`.
- [ ] Do not commit or push without user authorization.

### 7.9 Suggested Task 2 commit groups

1. `feat(db): track user-submitted songs`
2. `feat(api): create or reuse personal-list songs`
3. `feat(web): add unlisted-song forms`
4. `test: cover user-submitted song flows`

## 8. Task 3 — YouTube Import and Production Ranking Data

### 8.1 Branch and objective

Branch: `feature/ranking-data-import`

Continue this branch only if the user chooses more ranking imports after the
Task 3A pilot. Prefer updated `main` after relevant completed work is merged;
otherwise preserve and document the pilot branch dependency. Task 2 is not an
automatic prerequisite after the user changed the execution order.

Objective: reuse the reviewed Task 3A import process, obtain approval for the
remaining source videos, complete the production ranking set, switch publication
from the demo ranking to the real rankings, and complete end-to-end verification.

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
GET /api/rankings/:slug?q=&artist=&releaseYear=
```

Expected properties:

- List responses expose enough data to render direct ranking tabs, including
  nullable decade and region display metadata.
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
- A universal or exhaustive decade, region, language, or dialect taxonomy
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

### 2026-09-14 — Task 1 UI refinement

- Task: Task 1 follow-up, requested after visual review
- Branch: `feature/ranking-catalog-expansion`
- HEAD: `be345ae` (`feat: add multi-ranking catalog foundation`)
- Completed:
  - Replaced the separate category card with lightweight page-level underlined
    decade and region tabs.
  - Consolidated ranking context, total song count, source badge, and source
    action in the ranking-card header.
  - Consolidated search, artist, release year, and Clear into a responsive tinted
    toolbar.
  - Added an unfiltered `songCount` to ranking detail responses so header
    metadata remains stable while results are filtered.
- Verification:
  - Typecheck passed.
  - Full tests passed: API 15/15 and Web 34/34.
  - Production build passed with the known bundle warning.
  - Playwright E2E passed 1/1.
  - Desktop and 390 × 844 mobile browser checks passed; URL search and responsive
    layout were verified.
- Commit/push/PR status: this follow-up is uncommitted and unpushed; `be345ae`
  also remains local and unpushed.

### 2026-09-14 — Task 3A pilot import implementation

- Task: 3A — One 90s Top 100 pilot
- Branch: `feature/90s-ranking-pilot`
- HEAD: `2b0a0a3` (`docs: plan pilot ranking import`), stacked on Task 1 commits
  `be345ae` and `c15efc6`; no commit was created in this session.
- Source and approval:
  - User approved Bilibili `BV1hF9mYoEPh`, titled `1990-1999年内地流行歌曲总榜TOP100，“血洗”你的童年记忆！`.
  - The user confirmed an explicit 100-to-1 ranking and Mainland China scope.
  - The complete 100-row table was presented and approved before database write.
  - Ranks 14, 37, and 79 reuse exact existing Demo songs; source values remain in
    manifest audit metadata. `releaseYear` is null for all rows because the user
    withdrew the separate online-year research request.
- Completed:
  - Added the pilot manifest, now named
    `packages/database/manifests/90s-mainland-top-100.json`, with 100 entries and
    source metadata.
  - Added manifest validation, dry-run, transactional/idempotent import, and a
    90s/Mainland publication operation in `ranking-importer.ts`; malformed
    manifests and an injected late conflict are covered by rollback tests.
  - Imported unpublished first: 75 songs created, 25 exact songs reused, and
    100 entries created. The repeat import reused all 100 songs and entries.
  - Published the pilot (now slugged `90s-mainland-top-100`) and unpublished
    `90s-demo-ranking` in one transaction. The Demo and its 30 entries remain.
  - Updated the seed so its upsert preserves an intentionally unpublished Demo,
    and updated API fixtures so they do not depend on the 30-song Demo.
- Database checks:
  - Pilot: published, 100 entries, rank range 1–100, 100 unique ranks, and 100
    unique songs.
  - Demo: unpublished, 30 entries. A subsequent `npm run db:seed` kept that
    status unchanged.
- Verification:
  - `npm run typecheck`: passed.
  - `npm test`: API 15/15, Web 34/34 across 11 files, database importer 5/5;
    contracts has no tests and exits successfully.
  - `npm run build`: passed.
  - `npm run test:e2e`: Playwright 1/1 passed.
  - `git diff --check`: passed after this documentation entry.
- Known warnings: existing Vite bundle-size and third-party Zod annotation
  warnings, Playwright color warnings, and jsdom `scrollTo()` notices.
- Remaining: interactive desktop and mobile acceptance cannot be recorded yet;
  the in-app browser policy blocked navigation to `127.0.0.1`, and no bypass was
  attempted. User review and explicit authorization are still required before
  any commit, push, or merge.

### 2026-09-15 — Task 3A authoritative JSON replacement

- The user supplied `1990-1999内地流行歌曲TOP100.json` and explicitly made it
  authoritative; the Bilibili page was not accessed or used for validation.
- Moved the supplied entries into the version-controlled pilot manifest without
  changing their rank, title, artist, or release-year values. The exact supplied
  Bilibili URL is stored as `sourceUrl` for the UI's `Watch source` link.
- Removed the previous rank 14, 37, and 79 canonicalizations. All 100 entries
  now follow the replacement JSON verbatim and all have release years.
- Added atomic `--replace` support. It validates structure before writing,
  replaces the old ranking and entries in one transaction, preserves its prior
  publication state, updates exact shared songs from the authoritative manifest,
  and deletes only old songs with no ranking or personal-list references.
- Replacement result: 3 songs created, 97 reused, 100 entries created, 0
  orphaned songs deleted, and published state restored. The old ranking UUID was
  replaced; the Demo remains unpublished with 30 entries.
- Rerunning the normal importer was idempotent: 0 creates, 100 song reuses, and
  100 entry reuses. Rerunning Demo seed preserved imported year/status values and
  the Demo's unpublished state.
- Verification: typecheck passed; API 15/15, Web 34/34 across 11 files, and
  database 6/6 passed; production build passed; Playwright E2E 1/1 passed; and
  final `git diff --check` passed after documentation edits.
- No commit, push, or merge was performed.

### 2026-09-15 — Cantonese Top 70 import

- The user supplied `1990年代粤语歌曲排行榜.json`, approved its 72 entries as the
  source of truth, chose the title `90s Cantonese Songs Top 70`, the
  source-neutral slug `90s-cantonese-top-70`, and a Bilibili source URL.
- Added `packages/database/manifests/90s-cantonese-top-70.json`. It keeps the
  supplied rank/title/artist/release-year values, stores 1990s as optional
  decade metadata, and leaves `region` null because Cantonese is not a region.
- Generalized manifest validation and publication from a fixed 100 entries to
  any positive count of ranks that are unique and contiguous from 1. The
  100-entry requirement remains specific to the original Mainland pilot, not a
  global importer rule.
- Dry run reported 72 new songs and 72 entries. The unpublished import and
  transactional publication both succeeded; direct database checks found 72
  entries, ranks 1–72, 72 unique ranks, no missing release years, the exact
  Bilibili source URL, and published state. The 100-entry Mainland pilot stayed
  published and the 30-entry Demo stayed unpublished.
- Verification: typecheck passed; full tests passed (database 8/8, API 15/15,
  Web 35/35 across 11 files, contracts no tests); production build passed with
  the existing 821.00 KB bundle warning; Playwright E2E passed 1/1; desktop and
  390 × 844 browser acceptance passed without Console errors. A final dry run
  reused all 72 songs and entries. Final `git diff --check` passed.
- The user authorized committing the latest working tree on 2026-09-15. The
  Cantonese manifest, importer generalization, regression test, and synchronized
  documentation are included in the latest local commit; nothing was pushed or
  merged.

### 2026-09-15 — Source-neutral ranking identity refinement

- Replaced the public `decade × region` identity with stable
  `/rankings/:slug` routes and `GET /api/rankings/:slug` reads.
- Renamed the pilot slug and manifest to `90s-mainland-top-100`; Bilibili is
  retained only in source/audit metadata and the `Watch source` URL.
- Made `decade_start` and `region` nullable metadata, removed the partial
  published-pair unique index, and verified that multiple published rankings
  may share metadata.
- Replaced the two-level decade/region selector with direct, scrollable ranking
  tabs. Optional decade and region values render as secondary header chips and
  metadata-free rankings remain fully routable and displayable.
- Preserved shared-song overlap: `ranking_entries` continues to assign an
  independent rank per ranking while reusing the same `songs` row.
- Applied migration `0003_red_silver_samurai.sql`. Direct database checks found
  the published pilot with 100 entries, the unpublished Demo with 30 entries,
  nullable decade/region columns, and only primary-key/slug indexes on
  `rankings`. The renamed manifest dry-run reused all 100 songs and entries.
- Final verification: typecheck passed; full tests passed (database 8/8, API
  15/15, Web 35/35 across 11 files, contracts no tests); production build passed
  with the existing 821.00 KB bundle warning; Playwright E2E passed 1/1; desktop
  and 390 × 844 browser acceptance passed without Console errors. Rerunning the
  Demo seed preserved publication state and the final manifest dry-run reused
  all 100 songs and entries. Final `git diff --check` passed.
- No commit, push, or merge was performed.

### 2026-09-15 — Final integration and delivery

- Synchronized `feature/90s-ranking-pilot` with the latest `main`, preserving
  DESIGN-006 responsive list rows, the PR #4 account-label regression guard,
  and DESIGN-004 mobile bottom navigation alongside the ranking catalog.
- Resolved the integration points in `RankingPanel`, `TabNav`, the engineering
  guide, and the session handoff. Updated the BottomNav fixture for the catalog
  API shape and made the Snackbar E2E wait for Session restoration before
  mutating a personal list.
- Pushed the synchronized feature branch at `ecd1e45`, merged it into `main` at
  `62292ba`, and pushed the final handoff refresh at `3606979`.
- Final verification passed: typecheck; API 15/15; Web 40/40 across 12 files;
  database importer 8/8; production build; and Playwright 3/3 on a clean
  temporary database.
- The production build retained the known non-blocking bundle warning; the main
  asset was 826.41 KB (258.01 KB gzip). The existing Zod annotation,
  Playwright color, and jsdom `scrollTo()` warnings also remain non-blocking.
- The normal database was preserved with `90s-mainland-top-100` published at
  100 entries, `90s-cantonese-top-70` published at 72 entries, and the Demo
  retained unpublished at 30 entries. The temporary integration database was
  removed after verification.
- Repository state after delivery: local and remote `main` synchronized and the
  working tree clean. No Task 2, further ranking import, Admin, friends, SSO,
  fuzzy matching, or aggregation work was started.
- Remaining decision gate: create `feature/user-submitted-songs` from the latest
  `main` only when the user explicitly starts Task 2.

### 2026-09-15 — Task 2 implementation complete locally

- Task: 2 — User-submitted songs
- Branch: `feature/user-submitted-songs`, created from synchronized `main` at
  `67a0ba6`.
- Completed:
  - Added nullable `songs.submitted_by_user_id` with `ON DELETE SET NULL` and
    an attribution index through forward migration
    `0004_abnormal_butterfly.sql`.
  - Centralized exact trim-and-case normalization in the database package and
    applied it consistently to the seed, ranking importer, and submission flow.
  - Extended the Top 10 add endpoint and added a Practice Library creation
    endpoint. Both accept either an existing `songId` or `{ song: { title,
    artist } }`.
  - New songs are inserted with `UNVERIFIED`, submitter attribution, and their
    target list entry in one transaction; they never create ranking entries.
  - Exact normalized matches return safe `SONG_ALREADY_EXISTS` confirmation
    data. `ON CONFLICT DO NOTHING` resolves concurrent creation to that same
    confirmation path.
  - Added accessible title/artist dialogs plus existing-song confirmation in
    Personal Ranking and Practice Library. Top 10 submission is disabled at
    capacity; new Practice Library rows begin as `WANT_TO_LEARN` with no note.
  - Scoped post-mutation cache invalidation to the authenticated user's affected
    personal list while retaining the established logout/401 cleanup.
- Verification:
  - Applied the migration successfully to the normal local database.
  - `npm run typecheck`: passed.
  - `npm test`: API 22/22, Web 44/44 across 13 files, database importer 8/8;
    contracts has no source tests.
  - `npm run build`: passed with the existing bundle-size and third-party Zod
    annotation warnings.
  - `npm run test:e2e`: 3/3 passed, including the two new personal-list
    submission flows, public personal-list display, and the absence of a
    submitted song from a public ranking search.
  - `git diff --check`: passed.
- Scope checks: no shared-song edit/delete endpoint or UI was added; published
  list behavior and private Practice Library notes remain unchanged.
- Remaining: inspect the final diff and obtain explicit user authorization
  before committing, pushing, opening a PR, or merging.
