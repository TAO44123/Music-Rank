# Music Rank — Authentication Session Handoff

## 1. Handoff Purpose

This document is the starting point for the next development session. The primary objective of that session is to implement login and authentication for Music Rank.

Authentication is now an approved development direction, superseding the earlier Version 1 scope statement that excluded authentication. However, the exact authentication product requirements and technical design have not yet been approved. The next Agent must clarify the decisions listed in Section 6 before changing the database schema, API, or UI. Do not infer those decisions.

For detailed architecture and API behavior, read [ENGINEERING_GUIDE.md](ENGINEERING_GUIDE.md). For first-time environment setup, read [LOCAL_FIRST_RUN_GUIDE.md](LOCAL_FIRST_RUN_GUIDE.md).

## 2. Repository State at Handoff

| Item | Current state |
| --- | --- |
| Repository | `Music-Rank` |
| Default branch | `main` |
| Upstream | `origin/main` |
| Remote | `https://github.com/TAO44123/Music-Rank.git` |
| Current HEAD | `753fd31` — `docs: add engineering guide` |
| Git identity last verified | `Tao <integrity0588@gmail.com>` from the global Git config |
| Remote synchronization | Local `main` and `origin/main` pointed to the same commit when last checked |

The working tree is intentionally not clean. These documentation changes existed at handoff and must be preserved:

- Modified: `README.md`
- Modified: `docs/ENGINEERING_GUIDE.md`
- Added: `docs/LOCAL_FIRST_RUN_GUIDE.md`
- Modified by this handoff: `docs/SESSION_HANDOFF.md`

The uncommitted changes add the first-local-run guide, link it from existing documentation, standardize clean installation on `npm ci`, and update this handoff. Review them together before committing. Do not reset, discard, or overwrite them.

No commit or push has been made for these documentation changes. The user previously assigned future push work to Codex, but a later session should only commit and push when the user explicitly asks it to do so.

## 3. Current Application Baseline

Music Rank is a local full-stack application with:

- React 19, Vite, Material UI, TanStack Query, and dnd-kit in `apps/web`.
- Express 5 in `apps/api`.
- PostgreSQL 17.6 and Drizzle ORM in `packages/database`.
- Shared Zod contracts in `packages/contracts`.
- Vitest integration/component tests and one Playwright critical-flow test.

Current verified toolchain:

- Node.js 24.21.0
- npm 11.19.0
- Vite 7.2.1
- `@vitejs/plugin-react` 5.1.1
- PostgreSQL 17.6 Alpine through Docker Compose

Vite and the React Vite plugin are deliberately pinned. Do not broaden or upgrade them as part of authentication work unless the user separately approves it and the development server, Vite client, build, tests, and E2E are all reverified.

The most recent complete verification before these documentation-only changes passed:

- `npm run typecheck`
- API integration tests: 4 passing
- Web tests: 5 passing
- `npm run build`
- Playwright E2E: 1 passing

Only documentation has changed since that run. Static checks for the new documentation passed, including local Markdown links, documented npm script names, Docker Compose configuration, and `git diff --check`.

## 4. Current Identity Model

The project does not currently authenticate requests.

- The `users` table contains only `id`, `display_name`, `created_at`, and `updated_at`.
- There are no email, username, password hash, credential, session, verification, recovery, or OAuth tables/columns.
- `packages/database/src/seed.ts` creates one demo user.
- `packages/database/src/config.ts` resolves `DEMO_USER_ID`.
- `apps/api/src/current-user.ts` places that fixed user ID in `response.locals.userId`.
- Every `/api/me/*` route trusts that middleware and therefore reads or writes the same demo user's data.
- Service functions already accept `userId` explicitly. This is a useful boundary: authentication should replace the request-level user resolver without requiring personal-list services to be redesigned.
- API tests inject a dedicated test user through `createApp({ currentUserId })`.
- Playwright uses a separate fixed E2E user ID and clears only that user's personal lists.

Existing personal data is linked to `users.id` through foreign keys:

- `user_top_list_entries.user_id`
- `singing_list_entries.user_id`

Any authentication migration must preserve referential integrity and must not silently delete or reassign existing demo, test, or personal-list data.

## 5. Primary Objective for the Next Session

Design and implement a complete, testable login flow that replaces the fixed demo-current-user behavior for normal application requests.

At minimum, the completed feature will probably need to cover identity storage, credential validation, authenticated request resolution, protected personal endpoints, login/logout UI, client authentication state, database migration, automated tests, environment configuration, and documentation. This list describes the affected capability areas; it does not decide the product behavior or technology.

Public ranking and song behavior should remain unchanged unless the user decides that authentication is required for the entire application. My Top 10 and My Singing List must remain isolated by authenticated user identity.

## 6. Decisions Required Before Coding

The next Agent must ask the user for these decisions before implementation. They materially change the schema, API, security model, and UI.

1. **Login method:** local email/password, username/password, third-party OAuth, magic link, or another method?
2. **Account creation:** should users be able to register, or should login work only for pre-created accounts?
3. **Session model:** server-managed cookie session or token-based authentication? If the user has no preference, explain the tradeoffs and make a recommendation before implementing.
4. **Demo experience:** should anonymous visitors still browse the public ranking, and should a demo mode remain available?
5. **Existing demo data:** should the seeded demo user's Top 10 and Singing List remain demo-only, be migrated to a real account, or be removed only through an explicitly approved data migration?
6. **Login identifier and profile fields:** which fields are required and which must be unique?
7. **Account lifecycle scope:** are logout, persistent login, password reset, email verification, and account deletion required in this iteration?
8. **UI expectations:** dedicated login/register pages, a dialog, or another approved flow? What should users see after login and logout?

Record the approved answers in this file or a dedicated authentication design document before implementation. If an answer remains unresolved, do not guess.

## 7. Security Requirements to Preserve

Regardless of the selected approach:

- Never store plaintext passwords.
- Never return password hashes, session secrets, reset tokens, or sensitive credentials through the API or logs.
- Keep secrets in environment variables and add safe placeholders only to `.env.example`.
- Do not commit `.env` or real credentials.
- Validate all authentication inputs at the API boundary.
- Use generic login failures that do not disclose whether an account exists.
- Apply explicit expiration and revocation behavior to sessions or tokens.
- Protect state-changing authenticated routes against the threats relevant to the selected session model.
- Preserve the existing 32 KB JSON body limit or deliberately document any change.
- Do not use `npm audit fix --force` or introduce unrelated dependency upgrades.
- Add database uniqueness constraints for identity fields rather than relying only on application checks.
- Ensure one user cannot read, modify, reorder, or delete another user's personal lists.

Authentication is security-sensitive. If the implementation depends on current library APIs or security guidance, verify them against primary documentation rather than relying on memory.

## 8. Expected Change Areas After Requirements Are Approved

The precise file list depends on the chosen design, but inspect these areas first:

| Area | Likely responsibility |
| --- | --- |
| `packages/database/src/schema.ts` | Identity, credential, or session schema changes |
| `packages/database/migrations` | Forward-only tracked migration |
| `packages/database/src/seed.ts` | Demo or initial account behavior |
| `packages/contracts` | Login, registration, session, and profile request schemas/types |
| `apps/api/src/current-user.ts` | Replace fixed user resolution with authenticated request resolution |
| `apps/api/src/app.ts` | Authentication endpoints and protected-route middleware |
| `apps/api/src/errors.ts` | Stable authentication/authorization error responses |
| `apps/api/src/app.test.ts` | Authentication and cross-user isolation integration tests |
| `apps/web/src/api.ts` | Credential/cookie/token request behavior and auth errors |
| `apps/web/src/App.tsx` | Authentication state and protected personal-data queries |
| `apps/web/src/components` | Login/logout/register UI selected by the user |
| `e2e/music-rank.spec.ts` | Real login and protected personal-list critical flow |
| `.env.example` | Non-secret authentication configuration placeholders |
| `README.md` and `docs/ENGINEERING_GUIDE.md` | Setup, API, schema, security, and operational updates |

Do not manually edit an existing migration to represent a new authentication schema. Generate and review a new forward migration.

## 9. Recommended Implementation Sequence

After Section 6 is resolved:

1. Write down the approved authentication behavior and acceptance criteria.
2. Inspect current official documentation for any selected authentication libraries.
3. Design schema changes and data-preservation behavior.
4. Define shared request/response contracts and stable error codes.
5. Implement credential/session services and authenticated request middleware.
6. Protect the appropriate API routes and remove normal runtime dependence on `DEMO_USER_ID` as approved.
7. Add API integration tests, including unauthenticated access and cross-user isolation.
8. Implement frontend authentication state and the approved login/logout/registration UI.
9. Update Playwright to exercise the real login flow with an isolated E2E account.
10. Run migrations and verify existing demo data remains intact.
11. Run the full validation suite and manual authentication checks.
12. Update all affected documentation in the same change.

Keep commits logically separated if practical—for example, authentication foundation/migration, frontend flow, and documentation—but do not commit or push until requested.

## 10. Acceptance Checklist to Finalize With the User

The next Agent should turn the approved requirements into explicit checks. The final checklist should include at least:

- Valid credentials establish the approved authenticated state.
- Invalid credentials receive a stable, non-enumerating error response.
- Logout invalidates the authenticated state according to the approved model.
- Unauthenticated users cannot access protected `/api/me/*` operations.
- User A cannot read or mutate User B's Top 10 or Singing List.
- Refresh/restart behavior matches the approved persistence requirement.
- Authentication secrets and password material do not appear in responses or logs.
- Database migration succeeds against the existing local database.
- Existing data is preserved according to the user's explicit migration decision.
- Public ranking access matches the approved anonymous-access rule.
- Keyboard use, validation messages, loading states, and mobile layout work for the authentication UI.
- API, component, and E2E tests cover the critical authentication path.

## 11. Starting the Next Session

From the repository root:

~~~bash
git status --short --branch
git log -3 --oneline --decorate
git diff -- README.md docs/ENGINEERING_GUIDE.md docs/SESSION_HANDOFF.md
git diff --no-index /dev/null docs/LOCAL_FIRST_RUN_GUIDE.md
~~~

Read, in order:

1. `docs/SESSION_HANDOFF.md`
2. `docs/LOCAL_FIRST_RUN_GUIDE.md`
3. `docs/ENGINEERING_GUIDE.md`

Then check the environment without overwriting `.env` or terminating unknown processes. The detailed safe startup procedure is in the first-local-run guide.

Typical startup after the environment is confirmed:

~~~bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
~~~

Development endpoints:

- Web: http://localhost:5173
- API health: http://localhost:3001/api/health
- PostgreSQL: localhost:5432
- Playwright temporary server: localhost:3101

At the end of implementation, run:

~~~bash
npm run typecheck
npm run test
npm run build
npm run test:e2e
git diff --check
~~~

## 12. Existing Non-Authentication Issues

Do not silently expand the authentication task to include unrelated cleanup:

- When the Singing List is filtered by status, ranking membership is derived only from the filtered entries. Songs in other statuses may therefore appear addable.
- Malformed JSON, oversized request bodies, and unknown API routes do not yet share the normal structured JSON error format.
- The production frontend bundle exceeds Vite's default 500 KB warning threshold.
- Known dependency audit findings remain unresolved and require individual upgrade evaluation.
- Vite/React plugin compatibility and bundle-size warnings are documented in the engineering guide.

Only fix these items if they directly block authentication or the user explicitly adds them to the scope.

## 13. First Action for the Next Agent

Report that the handoff and Git status have been read, summarize the current fixed-demo-user authentication boundary, and ask the Section 6 questions that are still unanswered. Do not begin schema or implementation work until the user answers the decisions that materially affect the design.
