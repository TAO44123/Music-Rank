---
design_id: DESIGN-008
title: Username-only Transitional Login and Registration
status: Implemented and verified; GitHub delivery authorized
created: 2026-09-18
updated: 2026-09-18
related:
  - AUTHENTICATION_DESIGN.md
  - DESIGN_007_DEFAULT_GROUP.md
  - SESSION_HANDOFF.md
---

# DESIGN-008 — Username-only Transitional Login and Registration

## 1. Purpose and Status

Provide an intermediate release before stronger authentication is introduced.
The user confirmed username-only login and explicit username-only registration.
The user requested discussion/documentation first and subsequently authorized
implementation with “开始实施吧”. The feature is implemented in the local
working tree and verified locally. The user subsequently requested GitHub
delivery with “推送github吧”, authorizing commit and push to `origin/main`.
No deployment was requested.

Repository baseline: clean `main` at `be0efd9`, matching cached `origin/main`.
The owner-profile fix, tests, and documents were pushed in that commit.
Pre-delivery `git fetch origin` confirmed that `origin/main` still matched.
Use live Git log/status for the delivery commit and final remote state.
No deployment operation was performed for this feature.

## 2. Entry Behavior

Keep distinct login and registration modes. Each requires only username; neither
mode displays or submits password or requires a display-name field.

| Entry | Account state | Result |
| --- | --- | --- |
| Login | Username exists | Establish a normal Music Rank session |
| Login | Username does not exist | Explain that registration is needed and offer the registration mode; do not create an account |
| Registration | Username is available | Create the account transactionally and establish its session |
| Registration | Username already exists | Explain that the username is already registered and offer login; do not replace or reset the account |

Preserve the typed username when switching modes, including after the
not-registered message. Registration still requires an explicit submission;
typing an unknown username or submitting login never creates an account.

Username rules remain trimmed, lowercased, 3–32 ASCII letters, digits, or
underscores, with database-enforced uniqueness. New display names default to
the normalized username. Existing display names remain unchanged. Nullable
username Demo/test fixtures do not become login accounts.

## 3. Password Storage

Retain the existing `password_credentials` table, its relationships, and the
`password_hash` field. No password UI or password verification is active in this
transitional release.

- Existing accounts retain their current hashes; no bulk password overwrite.
- New registrations store the canonical unusable marker
  `DISABLED_USERNAME_ONLY_V1` in the
  existing password field as part of the account-creation transaction.
- The marker is not a valid password hash or a usable shared password and is
  never returned to clients or displayed.
- Later password authentication must require real password setup for accounts
  with a placeholder. Enabling password verification must not make a universal
  password usable across those accounts.

The placeholder is storage compatibility, not an authentication mechanism.

## 4. Preserved Application Behavior

Only account entry and password requirements change. Keep existing account IDs,
data relationships, sessions, permissions, routes, and navigation.

- Continue opaque server sessions, HTTP-only cookies, seven-day expiration,
  logout, Origin checks, rate limiting, and private-cache cleanup/isolation.
- Ordinary registration automatically joins Default Group, initializes both
  lists PUBLIC, and finishes on home. Creation remains transactional across
  account, placeholder credential, group membership, settings, and session.
- Ordinary login preserves its existing destination behavior and never
  backfills membership for existing nonmembers.
- Invitation login/registration preserves invitation intent, joins if needed,
  and finishes on Groups. Repeated joins remain idempotent.
- Preserve existing list contents, notes, visibility choices, member data,
  rankings, Demo data, and publication states.
- Your own profile still shows both lists with Public / Private labels; other
  viewers and public preview still use public-only projections. Share URLs and
  profile note omission remain unchanged.
- Do not reset TTT/AAA memberships or broadly backfill existing accounts.

## 5. Transitional Account Access Limitation

The user explicitly accepted on 2026-09-18 that knowing a username is sufficient
to log in as that account, read its private lists and notes, and modify its
data. Username-only login does not verify account ownership. This is solely an
accepted usage model for the intermediate release, not a permanent security
design or a basis for future SSO account-ownership verification.

Private lists remain hidden from public-profile views, but anyone who logs in
using the owner's username receives that account's owner access. HTTP-only
sessions and visibility labels do not change this limitation.

Before restoring password login or introducing Google account linking, define
the transition to verified account ownership. A username-only session must not
be treated as proof of ownership for that later transition. Google SSO itself
is outside this release and has not been authorized for implementation.

## 6. Implementation Acceptance

1. Login and registration forms require only username and contain no password
   or required display-name controls.
2. Existing usernames log in; missing usernames show a registration prompt
   without creating users, credentials, memberships, or sessions.
3. Explicit registration creates the expected account, placeholder, public
   settings, membership, and session together; failures roll back completely.
4. Duplicate/concurrent registration cannot replace accounts or modify their
   passwords, lists, settings, or membership. Username input survives mode
   switching and invitation continuation.
5. Existing hashes, account IDs, data, and normal/invitation landing behavior
   are preserved. The placeholder cannot authenticate as a shared password.
6. Profile privacy projections, owner views, logout/account-switch cleanup,
   and ranking behavior still pass their regression checks.

## 7. Implementation and Verification

- Shared login/register contracts accept username only. Backend login reads
  `users` by normalized username, with `404 USERNAME_NOT_REGISTERED` for missing
  accounts. Duplicate registration remains `409 USERNAME_TAKEN`.
- Registration creates normalized username/display name and placeholder within
  the existing account/membership/settings/session transaction. No schema,
  migration, environment, or dependency change is needed. Existing rows are not
  backfilled or rewritten.
- AuthDialog and AppShell submit username only; mode switching retains input and
  resets errors. Unknown names require a separate explicit registration action.
- API tests cover placeholders, legacy hashes/display names/private data,
  validation, normalized names, no implicit registration, duplicate/concurrent
  registration, and rollback after an injected final-session-insert failure.
- Frontend/E2E coverage uses username-only entry and preserves group/profile,
  privacy, account switching, rankings, and responsive regression checks.
- Initial full Web runs exposed default one-second
  async waits in different route-loading/dialog transitions under parallel load.
  Testing Library now uses the existing five-second waiting convention by
  default; file-level parallelism and the ten-second test timeout remain intact.
- Faster API tests exposed per-request ephemeral-port/HTTP-connection reuse
  between test app instances (wrong-app status responses). Test servers now
  listen independently throughout the suite and close during teardown; runtime
  server behavior is unchanged.
- Final `npm run typecheck` and `npm run test` passed: API 32, Web 73 across
  17 files, config 8, and database 10 (123 workspace tests; contracts has no
  tests). After the async-wait adjustment, four consecutive complete Web runs
  passed. After separate live test ports, two complete API runs passed.
- Production build and `npm run test:e2e` passed (7/7). Browser acceptance
  includes unknown-name prompts without creation, explicit registration,
  duplicate registration followed by login, username-only request bodies,
  invitation continuation, owner/public profiles, and responsive list flows.
  Inspected 320px/1280px login screenshots and checked overflow. E2E hooks
  removed test-owned accounts. Local PostgreSQL access required sandbox
  escalation; no production operation was performed.
- Updated README, authentication/engineering guides, and session handoff;
  checked document links/code fences and `git diff --check`.
- After GitHub delivery was requested, pre-commit typecheck and all 123 workspace
  tests passed again; the production build and 7-case E2E results above still
  apply to the same application code.
