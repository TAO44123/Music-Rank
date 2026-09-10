# Music Rank — Session Handoff

## 1. Current Status

The approved authentication and list-sharing iteration is implemented and fully verified in the working tree. There is no remaining implementation work in the current scope. The next actions are user acceptance review and, only if the user explicitly requests it, commit/push preparation.

The approved behavior is:

- Local username/password registration and login.
- Opaque server-managed cookie sessions that expire after seven days.
- Anonymous access to the global ranking and explicitly public personal lists.
- Independent `private`/`public` settings for My Top 10 and My Singing List; both default to `private`.
- A shareable `/u/:username` page that shows only lists the owner has made public.
- `PUBLIC` currently means accessible through the shareable profile URL. There is no public directory, user search, feed, or other in-app discovery path.
- Public Singing List responses omit private notes.
- Existing demo data remains attached to the credential-free demo user and is private.
- Future SSO is supported by the separation between users, credentials, and sessions, but no SSO provider tables or routes are part of this iteration.

The full decisions and security model are recorded in [AUTHENTICATION_DESIGN.md](AUTHENTICATION_DESIGN.md).

## 2. Repository State

At the time of this update:

- Branch: `main`, one local commit ahead of `origin/main` before the current uncommitted implementation.
- Current HEAD: `a64736f` — `docs: add local setup and authentication handoff`.
- The authentication/list-sharing implementation is intentionally uncommitted.
- No commit or push is authorized by this task.

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
- Authenticated users can edit personal lists and independently publish or privatize each list from its panel header.
- `/u/:username` is the shareable public profile route.
- On logout or an authentication failure, in-flight personal queries are cancelled, cached private data is erased, and personal query entries are removed after observers detach.

## 4. Automated Coverage

The suite currently covers:

- Registration, login, logout, session restoration, invalid credentials, expired sessions, rate limiting, origin checks, and unauthenticated protection.
- Cross-user personal-list isolation, independent visibility settings, public/private enforcement, and public note omission.
- Auth dialog and visibility controls.
- Anonymous, authenticated, logout/cache cleanup, and public-profile application states.
- A Playwright critical path for register, edit, publish, logout, and anonymous public viewing.

The final verification results on September 10, 2026 were:

- API integration tests: 11 passing.
- Web tests: 11 passing.
- Playwright E2E: 1 passing.
- Desktop and mobile manual browser checks: no console errors or warnings.
- Database migration and seed: successful and repeatable.
- Existing demo data check: credential-free demo user preserved with 3 Top 10 entries and 2 Singing List entries; missing visibility rows resolve to private.
- TypeScript typecheck, production build, and `git diff --check`: passing.

The production build retains the previously documented bundle-size warning. It does not fail the build and was not added to this iteration's scope.

## 5. Current TODO

### Current iteration

- User acceptance review of registration, login/logout, independent visibility controls, link sharing, and the anonymous public page.
- No code change is currently pending.
- Do not commit or push unless the user explicitly requests it.

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

- The authentication and direct-link list-sharing iteration is implemented and verified but remains uncommitted.
- The current iteration has no pending code task other than issues found during user acceptance.
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
- Do not terminate an unknown process already using a development port. Confirm ownership first or select an alternate port.
- The production frontend still has the previously documented bundle-size warning; it is not part of this scope.
- Password reset, email verification, account deletion, user/friend discovery, friendship management, unlisted links, and actual SSO providers remain out of the completed scope.

## 9. Separate Future Iteration: SSO

When SSO is approved, add provider-specific external identities keyed to `users.id` and continue issuing the same first-party `auth_sessions`. Do not overload `users.username` or `password_credentials` with provider identifiers. Decide account linking, collision handling, and whether username selection is required before creating provider schema or endpoints.
