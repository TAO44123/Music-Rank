# Music Rank — Session Handoff

## 1. Current Status

The authentication and list-sharing iteration, the compact visibility-control refinement, and DESIGN-002 tab navigation/client routing are implemented, verified, merged, and pushed to `main`. The production-shaped start command is cross-platform, and the post-merge Web test timing fix is committed and pushed. PR #3 delivers the implemented and freshly verified DESIGN-006 responsive list-panel layouts; use the live GitHub state to determine whether the PR has been merged.

The approved behavior is:

- Local username/password registration and login.
- Opaque server-managed cookie sessions that expire after seven days.
- Anonymous access to the global ranking and explicitly public personal lists.
- Independent `private`/`public` settings for My Top 10 and My Singing List; both default to `private`.
- A shareable `/u/:username` page that shows only lists the owner has made public.
- `PUBLIC` currently means accessible through the shareable profile URL. There is no public directory, user search, feed, or other in-app discovery path.
- Public Singing List responses omit private notes.
- Existing demo data remains attached to the credential-free demo user and is private.
- TanStack Router owns the code-based route tree: `/`, guarded `/personal`, guarded `/practice`, and public `/u/:username`.
- Authenticated users see The Ranking, Personal Ranking, and Practice Library tabs; anonymous users see only The Ranking.
- Ranking filters are validated URL search parameters, so they survive refresh and browser history navigation.
- User-facing copy now says Practice Library; database, API, error-code, and component identifiers retain the existing `singing` terminology.
- DESIGN-006 keeps RankingPanel, TopListPanel, SingingListPanel, and the account header usable without horizontal overflow from 320px upward. Narrow rows move actions below text; desktop layouts remain side by side.
- Future SSO is supported by the separation between users, credentials, and sessions, but no SSO provider tables or routes are part of this iteration.

The full decisions and security model are recorded in [AUTHENTICATION_DESIGN.md](AUTHENTICATION_DESIGN.md).

## 2. Repository State

At the time of this update:

- Branch: `feature/design-006-responsive-panels`, tracking `origin/feature/design-006-responsive-panels`.
- The development branch's pre-sync tip is `6b215be`; its original base was the pushed `main` commit `75424ee`.
- Local and remote `main` are synchronized at documentation refresh `9717ff3`.
- Merge commit `aa479f9` combines PR #3 tip `6b215be` with `main` at `9717ff3`; the latest documentation commit sits on top of that verified merge. Inspect `git status --short --branch` and `git log` for the exact current HEAD and live ahead/behind counts.
- PR #2 was merged as `364cd26`; PR #1 was merged as `91bca4b`; the test-stability follow-up is `75424ee`.
- The pre-merge runnable snapshot remains available locally and remotely as `codex/pre-pr-demo-backup-2026-09-11` at `4dcabdf`.
- On 2026-09-15 the user authorized pushing the synchronized branch and handling PR #3. This does not authorize merging PR #4, PR #5, or the separate ranking-catalog branch.

Preserve all working-tree changes. Do not reset or discard them. Use `git status --short --branch` for the live file list rather than relying on a copied snapshot here.

## 3. Implemented Architecture

### Database

- `users.username` is nullable for legacy/demo identities and unique for login-capable accounts.
- `password_credentials` stores one scrypt hash per local-password account.
- `auth_sessions` stores only SHA-256 hashes of random opaque session tokens with an expiration timestamp; logout revokes a session by deleting its row.
- `user_list_settings` stores one visibility value for each user/list pair.
- Migration `0001_lively_the_watchers.sql` is forward-only and preserves existing users and lists. Missing visibility rows resolve to private; registration creates explicit private rows for new accounts.

### API and security

- `POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/auth/logout` manage local accounts and sessions.
- `GET /api/auth/session` restores the current browser session.
- `/api/me/*` now requires an authenticated session; the fixed demo-user resolver is no longer used at runtime.
- `GET /api/me/list-settings` reads both effective visibility settings.
- `PATCH /api/me/lists/:listType/visibility` changes one authenticated user's list visibility.
- `GET /api/users/:username` returns public profile metadata and visibility.
- `GET /api/users/:username/top-list` and `/singing-list` return only public lists; the Singing List projection never selects or returns notes.
- Unsafe requests require a matching `Origin`; authentication attempts are rate-limited by client address and normalized username.
- Authentication and public-profile/list responses use `Cache-Control: no-store`; personalized responses use `Cache-Control: private, no-store`.

### Web application

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

### Local runtime

- `npm run dev` uses Vite on 5173 and Express on 3001; Vite proxies `/api` to Express.
- `npm run start:prod` loads `NODE_ENV`, `PORT`, and `APP_ORIGIN` from `config/production.env` through Node `--env-file`, avoiding POSIX-only shell prefixes.
- Development API and the default production-shaped server both use 3001 and must not run simultaneously unless production is explicitly moved to another port.
- Playwright owns 3101 for the duration of E2E and sets environment variables through `webServer.env`, which works on Windows and POSIX systems.

## 4. Automated Coverage

The suite currently covers:

- Registration, login, logout, session restoration, invalid credentials, expired sessions, rate limiting, origin checks, and unauthenticated protection.
- Cross-user personal-list isolation, independent visibility settings, public/private enforcement, and public note omission.
- Auth dialog and visibility controls.
- Anonymous, authenticated, logout/cache cleanup, and public-profile application states.
- A Playwright critical path for register, edit, publish, logout, and anonymous public viewing.

The final post-merge verification results on September 11, 2026 were:

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

The Web test configuration now uses a 10-second per-test timeout, and the ranking-loading assertion uses a targeted 5-second async wait. This keeps normal file parallelism while avoiding load-sensitive failures observed with the default limits.

The production build retains a bundle-size warning: the main JavaScript asset is approximately 816.64 KB (254.80 KB gzip). It does not fail the build. The npm audit baseline remains 6 findings (4 moderate, 2 high); the merged PRs did not add findings.

## 5. Current TODO

### Current iteration

- DESIGN-006 is synchronized with `main` through `aa479f9` and has passed its fresh acceptance gate.
- PR #4 and PR #5 remain stacked on the DESIGN-006 branch. Preserve this branch after handling PR #3 so their bases can be retargeted safely.
- Handle PR #4 next. Before PR #5, resolve its documented anonymous desktop-versus-mobile navigation inconsistency.

### Near-term engineering maintenance

- Evaluate and upgrade the vulnerable Drizzle ORM, Vite, and legacy drizzle-kit/esbuild dependency chains without using `npm audit fix --force`.
- Add GitHub Actions that run the supported Node/npm versions on Linux and Windows.
- Add a shared `.gitattributes` policy so text files use LF across contributor environments.
- Investigate route-level lazy loading or deliberate vendor chunking if bundle size becomes a performance goal.
- Remove expected jsdom `window.scrollTo()` and MUI out-of-range warnings from Web test output.
- Consider explicit startup port checks or clearer error messages for the shared development/production 3001 port.

### Candidate next iteration: friends and friend-visible lists

The user has approved keeping the current direct-link public behavior and is considering a later friends feature that lets users view friends' Top 10 and Singing List. This is a future candidate, not authorization to implement it now.

Do not add placeholder friendship tables or speculative endpoints in the current iteration. The existing internal `users.id`, `user_list_settings`, and user-centric resource paths provide a sufficient migration boundary.

Before implementing the friends iteration, ask the user to decide all behavior that remains unresolved:

1. Whether the relationship is mutual friendship or one-way following.
2. The request lifecycle: request, accept, reject, cancel, unfriend, and whether blocking is required.
3. Whether a new `FRIENDS` visibility is required and whether it is configured independently for Top 10 and Singing List.
4. What profile information is visible to friends, non-friends, and anonymous visitors.
5. How users discover or invite one another, and whether usernames are searchable.
6. Whether friend requests need notifications in the first friends release.

After those decisions are approved, the intended technical direction is:

- Add relationship tables keyed by stable internal user IDs, with constraints and indexes matching the approved relationship model.
- Extend list visibility through a forward migration only if `FRIENDS` is approved.
- Keep `GET /api/users/:username`, `/top-list`, and `/singing-list` as the list-reading resources; make authentication optional there and resolve access from viewer, owner, relationship, and list visibility.
- Add separate endpoints only for relationship management, such as friend requests and the current user's friend list.
- Continue returning `404` for nonexistent and unauthorized lists so private-resource existence is not disclosed.
- Add cross-user authorization, relationship lifecycle, UI, and E2E coverage before release.

## 6. Instructions for the Next Agent

Start by reading this document, [AUTHENTICATION_DESIGN.md](AUTHENTICATION_DESIGN.md), and the relevant sections of [ENGINEERING_GUIDE.md](ENGINEERING_GUIDE.md). Then inspect `git status --short --branch` and the working-tree diff without discarding or overwriting any existing change.

Report these facts to the user before taking further action:

- Authentication, direct-link list sharing, compact visibility controls, and DESIGN-002 routing are implemented and merged to `main`.
- Local and remote `main` were synchronized at `9717ff3` before PR #3 delivery. The pre-merge demo fallback is `codex/pre-pr-demo-backup-2026-09-11` at `4dcabdf`.
- The development branch `feature/design-006-responsive-panels` adds responsive panels and a second Playwright regression test on top of main; `aa479f9` records its main synchronization.
- PR #3 passed fresh typecheck, API 11/11, Web 28/28, build, and Playwright 2/2 verification on 2026-09-15. Use live Git/GitHub state for its current merge status.
- Friends and SSO are future candidates only and are not authorized implementation work.

Ask the user which next action they want: investigate acceptance feedback, prepare a commit/push, discuss the next version, or another explicitly scoped task. If a requirement, target, or authorization is unclear, ask the user instead of guessing. Do not create friendship schema, endpoints, or UI until the unresolved decisions in Section 5 have been answered and implementation has been explicitly approved.

Do not rerun the entire verification suite merely to restate the existing handoff result. Rerun checks in proportion to any new changes, or when the user explicitly requests fresh verification.

## 7. Verification Commands

From the repository root:

~~~bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run typecheck
npm run test
npm run build
npm run test:e2e
git diff --check
~~~

When changes resume, also inspect:

- `git status --short --branch`
- the generated SQL and migration metadata
- documentation for stale fixed-demo-user or unauthenticated-application descriptions
- preservation of the seeded demo user's personal data

## 8. Operational Notes

- `APP_ORIGIN` is the exact allowed browser origin and controls the secure cookie name when HTTPS is used.
- The normal local web origin is `http://localhost:5173`; Playwright uses `http://127.0.0.1:3101`.
- The default production-shaped origin is `http://localhost:3001`. Stop `npm run dev` before `npm run start:prod`, or override both `PORT` and `APP_ORIGIN` together. Do not use 3101 for a long-running manual server.
- Do not terminate an unknown process already using a development port. Confirm ownership first or select an alternate port.
- The production frontend still has the previously documented bundle-size warning; it is not part of this scope.
- Test output may include jsdom `scrollTo()` and MUI select warnings even when the suite passes; treat new failures separately from these known warnings.
- Password reset, email verification, account deletion, user/friend discovery, friendship management, unlisted links, and actual SSO providers remain out of the completed scope.

## 9. Separate Future Iteration: SSO

When SSO is approved, add provider-specific external identities keyed to `users.id` and continue issuing the same first-party `auth_sessions`. Do not overload `users.username` or `password_credentials` with provider identifiers. Decide account linking, collision handling, and whether username selection is required before creating provider schema or endpoints.
