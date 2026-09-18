---
plan_id: PLAN-007
title: Default Group Implementation Plan
status: Implemented and verified; local Git commit only
created: 2026-09-17
updated: 2026-09-17
implements: DESIGN_007_DEFAULT_GROUP.md
related:
  - SESSION_HANDOFF.md
  - ENGINEERING_GUIDE.md
  - DATABASE_MIGRATION.md
---

# PLAN-007 — Default Group Implementation Plan

## 1. Authority and Baseline

Product behavior is defined by [DESIGN-007](DESIGN_007_DEFAULT_GROUP.md).
User instructions take precedence. Read this plan and the current session
handoff before implementation; preserve all existing changes.

Planning baseline: synchronized `main` at `83b24f3`. The database-guide commit
`68d8071` and deployment PR #9 are integrated and pushed. The working tree was
clean before planning documents were created. The user subsequently authorized
implementation; the feature is saved locally as `7053051`, with sharing and
PUBLIC-default refinements saved as `83ab826`.

Implementation branch: `codex/default-group`, from `83b24f3`. Planning changes
were preserved, including an unrelated untracked editor swap file.
The user authorized both local commits. Push, PR, merge, and production
operations have not been authorized for this feature.

The group name (`Default Group`) and navigation placement (`Groups` in the
desktop top bar and mobile bottom bar) have been confirmed. The user authorized
implementation with “开始实施吧”. Approved
behavior must not be replaced by older, more elaborate group proposals.

## 2. Startup Checklist

- [x] Read AGENTS.md, DESIGN-007, this plan, and SESSION_HANDOFF completely.
- [x] Confirm the formal group name and navigation placement with the user.
- [x] Inspect branch, HEAD, working-tree diff, and staged diff.
- [x] Read schema, migration metadata, registration transaction, route guards,
  AppShellContext, query keys, navigation, public-profile services, and tests.
- [x] Confirm current database target and migration chain through `0004`.
- [x] Record the implementation branch and actual starting commit in the handoff.
- [x] Preserve all published rankings, unpublished Demo data, and personal data.

## 3. Phase 1 — Database and Membership Foundation

- [x] Add groups and group memberships with stable identity, foreign keys,
  timestamps, and a unique group/user pair. No role enum or invitation table
  is required for this release.
- [x] Define one canonical default-group identity and idempotent initialization.
  Do not tie initialization to a username or a per-request GET side effect.
- [x] Generate a forward-only Drizzle migration and inspect SQL and metadata.
- [x] Verify clean-database and existing-database migration paths, plus repeat
  initialization. Existing data must be preserved.
- [x] Add default membership to the existing registration transaction alongside
  credentials, initial public list settings, and session. Rollback covers all of them.
- [x] Keep ordinary login free of membership writes.
- [x] Implement an idempotent join service using the database unique constraint;
  concurrent joins resolve successfully to one membership.
- [x] Use test-owned accounts for rollback, registration, and concurrent-join
  coverage. Do not use the normal database's TTT/AAA for automated tests.

Phase gate: registration joins once; ordinary login leaves a nonmember outside;
failed registration leaves no partial account or membership; migrations and
initialization preserve all existing data.

## 4. Phase 2 — Contracts and API

The endpoints below are implemented with their access/error tests.

| Endpoint | Purpose | Access |
| --- | --- | --- |
| `GET /api/group-invitations/default` | Safe introduction for the fixed invitation | Anonymous allowed; no member list or writes |
| `POST /api/group-invitations/default/join` | Join or confirm current membership | Authenticated; existing Origin checks |
| `GET /api/me/groups` | Current user's group summary; empty for nonmembers | Authenticated |
| `GET /api/me/groups/:groupId/members` | Safe complete member list | Authenticated member of the requested group |
| `GET /api/me/groups/:groupId/members/:username` | Safe identity/visibility, including private-list empty state | Viewer and target must both be members |

- [x] Define shared Zod contracts and safe member summaries.
- [x] Reject anonymous joins and invalid/mismatched Origin requests.
- [x] Check actual membership before returning member data; login alone is
  insufficient. Empty membership reads never add the caller.
- [x] Return only display name, username, and the minimal safe identifiers needed
  for rendering. Do not expose notes, credentials, sessions, or private lists.
- [x] Reuse existing public-list endpoints and visibility enforcement.
- [x] Define recoverable join errors and distinguish a missing group from an
  unauthenticated or unauthorized request.
- [x] Apply existing protected-response cache policy to group/member responses.
- [x] Test the access matrix, repeated joins, membership isolation, and no GET
  writes. Preserve existing authentication and privacy coverage.

Phase gate: invitation reads are harmless; membership writes are authenticated
and idempotent; protected member lists do not leak to anonymous users or
nonmembers; public-list APIs still enforce their existing visibility rules.

## 5. Phase 3 — Invitation and Authentication Continuation

- [x] Add `/invite/default` and `/groups` to the explicit route tree.
- [x] Introduce the anonymous invitation page without disclosing member data.
- [x] Preserve the invitation URL across auth-mode switching, refresh, and
  validation errors. Closing the dialog does not join a logged-out user.
- [x] Wait for a resolved session; distinguish a session error from signed-out.
- [x] Join automatically for logged-in nonmembers and redirect after success;
  current members enter without duplicate membership.
- [x] Continue invitation login/register success into join and group navigation.
  Scope the continuation to this flow; no global group redirect after login.
- [x] Ordinary registration joins at the backend and finishes on `/`; ordinary
  login retains its existing non-invitation behavior.
- [x] If join fails after login, retain the account/session and allow retry.
- [x] Scope membership/member query keys to the current user under protected
  cache cleanup. Check logout, expired sessions, and account switching.
- [x] Refresh affected group queries after joining; prevent repeated in-flight
  submissions without relying on frontend guards for uniqueness.

Phase gate: cover registration, logged-out existing account, logged-in
nonmember, and current member; ordinary entry points do not inherit stale
invitation intent.

## 6. Phase 4 — Member View, Navigation, and Invitation Sharing

- [x] Use `Default Group` as the display name; add `Groups` to the shared
  primary-destination table for desktop top and mobile bottom navigation.
- [x] Apply existing anonymous guarded-destination behavior without turning an
  ordinary navigation sign-in into an invitation join.
- [x] Render group title, member count, complete members, and share action for
  members; loading/error states must not look like an empty member list.
- [x] For logged-in nonmembers, show not-in-any-groups copy, no member list,
  and no join button. Normal login must not join AAA.
- [x] Link each member to their public personal lists and provide return-to-group
  navigation. Validate internal navigation context; do not accept external URLs.
- [x] Show a clear no-public-lists message for known members with both lists
  private. Do not relabel a network failure as a privacy empty state.
- [x] Implement the user-refined shared in-app dialog for public lists and
  invitations, with explicit Copy, clipboard/selection-based copying, and a
  manual-copy explanation when copying is blocked. Never invoke native sharing.
- [x] Preserve existing PUBLIC/PRIVATE controls and anonymous public links.
- [x] Verify keyboard access, long usernames, member rows, and responsive
  navigation/content/Snackbar clearance from 320px upward.

Phase gate: every member can discover only public list contents; manual-copy
invitation sharing remains usable under HTTP; the approved navigation fits
desktop and mobile.

## 7. Local Acceptance Data

- [x] Read the intended local database and resolve TTT and AAA to real IDs
  using current username normalization. Do not assume their existence or state.
- [x] Apply a narrowly scoped, idempotent membership setup for TTT only.
- [x] Preserve AAA as a nonmember before invitation acceptance testing. If
  already joined unexpectedly, report it rather than deleting membership.
- [x] Keep usernames out of production business logic and schema migrations.
- [x] Ensure rerunning normal initialization/Demo seed does not add AAA or
  undo the test setup. Preserve credentials, lists, visibility, and songs.
- [x] Record that accepting the invitation as AAA changes its local membership;
  subsequent repeat tests should verify idempotence, not silently reset it.

This is explicit local test setup only. Do not apply it to the EC2 database
or broadly backfill all old accounts.

## 8. Final Verification and Documentation

- [x] Run `npm run typecheck`, `npm run test`, `npm run build`, and
  `npm run test:e2e`, and inspect `git diff --check`.
- [x] E2E covers ordinary registration/home landing, invitation registration,
  invitation login, logged-in joining, current-member re-entry, and nonmember
  empty state with no join button.
- [x] Verify member visibility, no-public-lists state, anonymous public access,
  and absence of private lists/notes in responses and UI.
- [x] Cover invitation continuation after refresh/auth-mode switching, join
  retry after authentication, and protected-cache cleanup.
- [x] Desktop and mobile acceptance checks use actual browser layouts; do not
  infer responsive behavior from jsdom.
- [x] Preserve all three formal rankings and the unpublished 30-entry Demo.
- [x] Clean up test-created accounts/data and temporary databases/directories;
  cleanup failures must propagate rather than be silently swallowed.
- [x] Update ENGINEERING_GUIDE with implemented tables, APIs, routes, auth
  continuation, caches, and actual test counts.
- [x] Update DATABASE_MIGRATION with the generated migration and initialization
  workflow. Update DEPLOYMENT only if deployment requirements actually change.
- [x] Update DESIGN-007, this progress log, and SESSION_HANDOFF to match final
  implementation and any explicitly approved scope changes.

No new environment keys, dependencies, or HTTPS deployment are required.
The user-approved sharing refinement now covers both lists and invitations. Any configuration change must follow AGENTS.md's complete
configuration checklist. Do not fabricate validation results.

## 9. Progress Log

### 2026-09-17 — Planning documents prepared

- Baseline: `main` at `83b24f3`, synchronized with `origin/main` before editing.
- Completed: documented approved simplified scope, invitation behavior,
  visibility, local TTT/AAA setup, implementation phases, and acceptance gates.
- Confirmed presentation: `Default Group`; `Groups` in desktop top navigation
  and mobile bottom navigation. No open product decisions in this planning scope.
- Implementation: not started; no application or database changes.
- Validation: diff/whitespace checks, balanced fences, final newlines, and all
  eight local Markdown links across the four affected documents passed. No
  application tests rerun for this documentation-only, uncommitted change.
- Commit/push/PR/merge: none for these planning changes.

### 2026-09-17 — Implementation

- Working branch: `codex/default-group`; starting commit `83b24f3`.
- Database: generated/applied `0005_bizarre_the_stranger.sql` with SQL,
  snapshot, and journal. Initializes the stable default group without backfill.
- API: registration membership shares the account transaction; login unchanged;
  invitation join is authenticated, Origin-protected, and concurrency-safe.
  Directory/profile reads require actual membership and return safe projections.
- Web: Groups primary navigation, member/nonmember views, invitation auth
  continuation/retry, public-profile return context and privacy empty state,
  protected cache cleanup, native/clipboard/manual-copy invitation sharing.
- Local development setup: resolved normalized `ttt`/`aaa` to actual IDs; TTT
  has one membership and AAA remains outside. No production username rules.
- Clean and existing migrations passed; repeat clean migration/seed yielded
  exactly one group with no backfill. An intentionally failing final session
  insert rolled back user, membership, credentials, settings, and session.
- Existing data: formal rankings remain published with 100/100/72 entries;
  Demo remains unpublished with 30. Local setup preserved account/credential/
  session/list/visibility/catalog fingerprints.
- No dependencies, configuration keys, HTTPS changes, or list-share refactor.
- Initial validation found test-selector ambiguity and short async assertion
  waits; corrected selectors/waits and the duplicated identical Groups label.
- Final verification: `npm run typecheck` passed; full `npm run test` passed
  (API 25/25, Web 59/59 in 15 files, config 8/8, database 10/10; contracts
  has no tests). `npm run build` passed, including the production build in the
  final E2E startup. `npm run test:e2e` passed 6/6 on a clean temporary database.
- Browser acceptance: desktop and 390px screenshots inspected; 320/390/600/
  900px layouts passed overflow/navigation checks. Keyboard member navigation,
  public/private profiles, anonymous public access, private-note exclusion, and
  HTTP-style absent APIs/manual invitation copying passed.
- A parallel-test cleanup conflict was traced to choosing another test's
  temporary submitted song. The new group fixture now uses a fixed seeded song;
  the full parallel E2E suite subsequently passed.
- Test accounts/memberships were cleaned; temporary databases and verification
  scripts were removed successfully. Final local check: TTT one membership,
  AAA none; formal/Demo ranking publication and entry counts unchanged.
- Updated DESIGN-007, DATABASE_MIGRATION, ENGINEERING_GUIDE, and SESSION_HANDOFF.
  Deployment configuration/commands did not change. Final diff and document
  checks passed; the unrelated editor swap file remains untouched.
- Delivery: the user authorized saving this implementation in a local Git
  commit only. No GitHub push, PR, merge, or deployment.

### 2026-09-17 — Sharing-dialog refinement after local commit

- Baseline feature saved locally as `7053051`; no GitHub push.
- User requested identical in-app sharing for lists and group invitations:
  dimmed background, centered link dialog, adjacent Copy button, and contextual
  hint. This explicitly expands the original invitation-only sharing scope.
- Added ShareLinkDialog and reused it from VisibilityControl and ShareInvitation.
  No copy occurs until a button press. Async clipboard and selection-based
  fallback cover HTTP/rejected permission; blocked copying retains a selectable
  link and clear instructions. Existing public URLs/visibility are unchanged.
- Validation: Web typecheck passed; full Web suite passed 63/63 in 16 files;
  production build passed through E2E startup; full Playwright passed 6/6.
  Clipboard reads confirmed both list URLs and the invitation URL after copying,
  including selection-based copying with navigator.clipboard absent. Native
  sharing was not invoked. Desktop/mobile screenshots were visually inspected
  after the dialog fade completed; 320px copy controls remain usable.
- Final diff and document checks passed. This refinement remains uncommitted;
  no push/deployment, database schema/config changes, or local membership reset.

### 2026-09-17 — Public defaults for new registrations

- User requested PUBLIC as the initial state for every personal list.
  Registration initializes both Top 10 and Practice Library as PUBLIC.
- Generated `0006_panoramic_machine_man.sql`, snapshot, and journal entry.
  The migration changes only the column default; no existing visibility or
  membership rows are updated. Applied to the local development database.
- Missing legacy settings remain PRIVATE, matching public endpoint gates.
  Existing explicit private settings survive logout/login. Notes remain private.
- Updated privacy fixtures to explicitly choose PRIVATE; they still verify
  blocked private access, safe public projections, and all-private member views.
  Added coverage for database defaults and missing legacy settings. Browser
  checks verify both initial PUBLIC states and private/public controls.
- Validation: full typecheck passed; full tests passed 107/107 (API 26, Web 63,
  config 8, database 10). Production build and migration/seed passed through
  E2E startup; Playwright passed 6/6. Migration snapshot comparison confirmed
  the default is the only schema change. Final diff/document checks passed.
- Updated authentication design, DESIGN-007, migration guide, engineering guide,
  and session handoff. Sharing and defaults refinements remain uncommitted.
  No GitHub push, deployment, dependency/config change, or membership reset.

### 2026-09-17 — Local refinement delivery

- User authorized a local Git commit for the sharing-dialog and public-default
  refinements: `feat: add share link dialogs and default lists to public`
  (commit `83ab826`, parent `7053051`, branch `codex/default-group`). Prior full typecheck,
  107 tests, production build, and six E2E tests passed; final diff checked.
- No GitHub push, PR, merge, or deployment. The unrelated editor swap file
  `docs/.ENGINEERING_GUIDE.md.swp` remains untracked and untouched.

### 2026-09-17 — Post-commit documentation refresh

- Verified local HEAD `83ab826` on `codex/default-group`; local `main` and
  cached `origin/main` remain `83b24f3`. No remote fetch or GitHub operation.
- Updated SESSION_HANDOFF and ENGINEERING_GUIDE with exact delivered commits,
  four-destination navigation, protected group discovery, PUBLIC defaults,
  sharing dialogs, migration chain through 0006, and latest verification.
- Updated DESIGN-007/PLAN-007 delivery status and README overview/entry points.
  Authentication design and migration guide already cover the new defaults;
  configuration/deployment commands need no change. Older specifications and
  historical validation records remain historical context.
- This refresh changes documents only. Local links, Markdown fences, and
  `git diff --check` passed; application tests were not rerun. Latest code
  verification remains 107 workspace tests and six E2E cases, all passing.
- Documentation edits remain uncommitted. The unrelated editor swap file is
  untouched. No membership reset, database write, push, PR, merge, or deployment.

### 2026-09-18 - Local documentation delivery

- User authorized saving the documentation refresh in local Git only:
  `docs: refresh group feature handoff and engineering guide`.
- Application baseline remains `83ab826`; no application/API/config changes
  are included. Pre-commit typecheck and full workspace tests passed (107 tests).
- No GitHub push, PR, merge, or deployment. The editor swap file remains
  untracked and untouched.
