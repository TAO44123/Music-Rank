# Music Rank Authentication and List Visibility Design

## 1. Approved Scope

This iteration replaces the fixed demo-current-user behavior with local username/password authentication and database-backed sessions. It also lets each authenticated user independently publish or keep private their Top 10 and Singing List.

Approved behavior:

- Anonymous visitors can browse published rankings and songs.
- Users can register with a username, display name, and password.
- Sessions use an opaque token in an HTTP-only cookie and expire after seven days.
- `/api/me/*` endpoints require an authenticated session.
- Top 10 and Singing List visibility is configured independently and defaults to `PUBLIC` for new registrations (updated 2026-09-17). Existing stored visibility is preserved.
- A public Top 10 exposes songs and ordering.
- A public Singing List exposes songs and singing statuses, but never notes.
- Public lists are available without authentication at `/u/:username`.
- The seeded demo user and all existing personal data remain intact and private.

Not included in this iteration:

- SSO provider integration, provider callbacks, or third-party token storage.
- Email addresses, email verification, password reset, or account deletion.
- User search, a public directory, follows, or unlisted sharing.
- Publishing Singing List notes.

## 2. Account and Future SSO Boundary

`users` represents the Music Rank account and profile. Password material is stored separately in `password_credentials`; sessions reference only the internal user ID. Authentication code establishes a session through a provider-neutral `createSession(userId)` boundary.

When SSO is implemented, add an `external_auth_identities` table rather than adding provider columns to `users`:

| Column | Purpose |
| --- | --- |
| `id` | Internal identity ID |
| `user_id` | Music Rank account |
| `issuer` | Canonical OIDC issuer |
| `subject` | Provider's stable `sub` claim |
| `provider_key` | Local configuration key such as `google` |
| `email_snapshot` | Optional non-authoritative profile snapshot |
| `email_verified` | Snapshot of the provider claim |

The future table must uniquely constrain `(issuer, subject)`. Email must not be used as the stable external identity or as an automatic account-linking key. A user who wants to attach SSO to an existing account must first authenticate that account and explicitly link the provider.

SSO should use OIDC Authorization Code Flow with PKCE and exchange a successful provider response for the same Music Rank session cookie used by password login. Provider access or refresh tokens should not be retained unless a later feature explicitly needs provider APIs.

## 3. Input Rules

| Field | Rule |
| --- | --- |
| Username | Trimmed, lowercased, 3–32 ASCII lowercase letters, digits, or underscores |
| Display name | Trimmed, 1–80 Unicode characters |
| Password | 12–128 Unicode characters; no composition rule |

Username uniqueness is enforced in PostgreSQL. Login failures do not distinguish a missing username from an incorrect password.

## 4. Database Model

### 4.1 `users`

Add nullable `username`. It remains nullable so existing demo and test fixtures are preserved. All newly registered accounts require it.

### 4.2 `password_credentials`

One row per local-password account:

- `user_id`, primary key and cascading foreign key to `users`.
- `password_hash`, a versioned scrypt representation containing parameters, salt, and derived key.
- `created_at` and `updated_at`.

### 4.3 `auth_sessions`

- `id`, UUID primary key.
- `user_id`, cascading foreign key to `users`.
- `token_hash`, unique SHA-256 hash of the opaque cookie token.
- `expires_at`, absolute seven-day expiration.
- `created_at` and `updated_at`.

The raw token is never persisted. Expired sessions are rejected and deleted opportunistically.

### 4.4 `user_list_settings`

- `user_id`, cascading foreign key to `users`.
- `list_type`, `TOP_LIST` or `SINGING_LIST`.
- `visibility`, `PRIVATE` or `PUBLIC`, defaulting to `PUBLIC`.
- `created_at` and `updated_at`.
- Composite primary key `(user_id, list_type)`.

Missing settings always resolve to `PRIVATE`. Registration creates both public settings in the same transaction as the user and password credential.

## 5. Session and Request Security

- Passwords are hashed with asynchronous Node.js scrypt, a unique random salt, versioned parameters, and timing-safe comparison.
- A missing-user login performs a dummy scrypt verification to reduce account-enumeration timing differences.
- Session tokens contain at least 256 random bits and are encoded with base64url.
- Cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, host-only, and `Secure` in production HTTPS.
- Authentication, personalized, and public-profile/list responses use `Cache-Control: no-store` so a visibility change is not masked by an HTTP cache.
- Unsafe requests require a matching configured application Origin and reject cross-site Fetch Metadata.
- Login and registration are rate-limited per process. A distributed deployment must replace this with a shared limiter.
- Passwords, password hashes, cookies, and session tokens must never be logged or returned.
- The existing 32 KB JSON body limit remains unchanged.

## 6. API Contract

### Authentication

| Method | Path | Behavior |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account, initial public list settings, and session |
| `POST` | `/api/auth/login` | Validate password and create session |
| `POST` | `/api/auth/logout` | Revoke current session and clear cookie |
| `GET` | `/api/auth/session` | Return `{ user }`, where `user` may be `null` |

### Authenticated lists

Existing `/api/me/*` routes retain their data behavior but require authentication.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/me/list-settings` | Return both effective visibility settings |
| `PATCH` | `/api/me/lists/:listType/visibility` | Update one list's visibility |

### Public profiles and lists

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/users/:username` | Return a profile only when at least one list is public |
| `GET` | `/api/users/:username/top-list` | Return a public Top 10; otherwise `404` |
| `GET` | `/api/users/:username/singing-list` | Return public songs/statuses without notes; otherwise `404` |

Private and nonexistent public resources intentionally share a `404` response.

## 7. Stable Error Codes

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Contract validation failed |
| 401 | `AUTH_REQUIRED` | A protected route has no valid session |
| 401 | `INVALID_CREDENTIALS` | Username/password validation failed |
| 409 | `USERNAME_TAKEN` | Registration username conflicts |
| 429 | `AUTH_RATE_LIMITED` | Too many authentication attempts |
| 404 | `PUBLIC_PROFILE_NOT_FOUND` | No public profile is available |
| 404 | `PUBLIC_LIST_NOT_FOUND` | Requested list is not public |

## 8. Frontend Behavior

- `/` remains the public ranking page.
- `/u/:username` displays only the user's public lists.
- Anonymous visitors see a sign-in invitation instead of personal panels.
- Login and registration use an accessible dialog.
- Each personal card has a visibility selector. Publishing requires confirmation.
- Public cards provide a copy-link action.
- Authentication-aware query keys contain the current user ID.
- Logout, session loss, and account switching cancel and remove all private query data before rendering the next state.

## 9. Acceptance Criteria

- Valid registration/login establishes a persistent session; invalid credentials return a generic error.
- Logout, expiration, and revoked tokens cannot access `/api/me/*`.
- User A cannot read or mutate User B's private resources.
- New registrations default both lists public; existing private settings and demo data remain private. Missing legacy settings stay private.
- Public Top 10 order is preserved.
- Public Singing Lists never include the `note` property.
- Anonymous public ranking behavior remains unchanged.
- Refresh restores an unexpired session.
- Mobile layout, keyboard interaction, validation, and loading/error states work.
- API, component, and Playwright tests cover the critical authentication and publication flow.
