# Music Rank

Music Rank is a full-stack application for browsing published song rankings, maintaining a personal Top 10 and Practice Library, and discovering members’ public lists through Default Group.

The local database currently has three imported rankings: 80s Chinese Songs Top 100 (100 entries), 90s Mainland China Top 100 (100), and 90s Cantonese Songs Top 70 (72). The retained 30-entry **Demo Data** ranking is unpublished. A fresh setup seeds Demo fixtures; importing the formal rankings is a separate step in the [database guide](docs/DATABASE_MIGRATION.md).

## Requirements

- Node.js 24.21.0 (pinned in `.nvmrc`)
- npm 11.19.0
- Docker with Docker Compose

## Local setup

```bash
npm ci
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite development server proxies `/api` requests to the Express server on port 3001.

Create an account from the page header. Usernames contain 3–32 letters, numbers, or underscores; passwords contain 12–128 characters. Anonymous visitors can browse published rankings, while personal-list operations and the group directory require login. New accounts automatically join Default Group and initialize both personal lists as Public. Existing visibility is preserved, and Practice Library notes always remain private.

Open Groups to see members and share `/invite/default`. Invitation registration/login joins the group and lands there; ordinary registration finishes home and ordinary login does not add membership. Public-list sharing and invitations open a centered link dialog with an explicit Copy button and manual-copy fallback.

The seed is idempotent. You can run `npm run db:seed` again without duplicating the credential-free demo user, ranking, songs, or ranking entries. It does not overwrite personal lists or create a login account.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run db:up` | Start the pinned local PostgreSQL container. |
| `npm run db:down` | Stop the local database container. |
| `npm run db:generate` | Generate a Drizzle migration after a schema change. |
| `npm run db:migrate` | Apply tracked database migrations. |
| `npm run db:seed` | Create or update demo fixtures. |
| `npm run dev` | Run Vite and Express for local development. |
| `npm run typecheck` | Type-check every workspace. |
| `npm run test` | Run unit, component, and integration tests. |
| `npm run test:e2e` | Run the Playwright critical workflow. |
| `npm run build` | Build all workspaces. |
| `npm run start` | Run the built API using the development configuration. |
| `npm run build && npm run start:prod` | Run the production-shaped Express server, which serves the built web app and API from one origin. |
| `npm run build:staging && npm run start:staging` | The same, using the staging configuration. |

## Environment

Configuration lives in `config/`, one file per environment, layered as
**real environment variables > `config/.env.<env>.local` > `config/.env.<env>`**.
The tracked files carry no secrets: `DATABASE_URL` is absent from them and comes
from an untracked `.env.<env>.local` or from the real environment. A missing
`DATABASE_URL` or `APP_ORIGIN` aborts startup rather than falling back to a
development default.

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the full key list, the
per-environment build and start commands, how the frontend picks up its
configuration, and which keys must be changed together.

Coming from a checkout that predates 2026-09-16, or merging a branch that does?
See [docs/CONFIG_MIGRATION.md](docs/CONFIG_MIGRATION.md). Rules for AI agents
working in this repository live in [AGENTS.md](AGENTS.md).

## Architecture

- `apps/web`: React, Vite, Material UI, TanStack Query, and dnd-kit UI.
- `apps/api`: Express 5 REST API, password/session authentication, authorization, centralized request errors, structured JSON logs, and graceful shutdown.
- `packages/contracts`: shared Zod request schemas and types.
- `packages/database`: Drizzle schema, PostgreSQL client, SQL migrations, and idempotent seed script.

All `/api/me` requests resolve an opaque database-backed session cookie in one middleware location. Services continue to receive the authenticated user ID explicitly. Each user can independently publish their Top 10 and Singing List at `/u/:username`; Singing List notes are never returned by the public API.

## Documentation

- [First Local Run Guide](docs/LOCAL_FIRST_RUN_GUIDE.md): environment checks, configuration, startup, health checks, full verification, troubleshooting, and Agent handoff rules.
- [Deployment Guide](DEPLOYMENT.md): first-time server setup, routine redeploys, per-environment builds, restarts, verification, rollback, and troubleshooting.
- [Database Migration and Ranking Sync Guide](docs/DATABASE_MIGRATION.md): apply schema migrations, import and publish the three formal ranking manifests, verify counts, and handle controlled replacements.
- [Current Session Handoff](docs/SESSION_HANDOFF.md): repository state and the approved focus, open decisions, implementation sequence, and acceptance checklist for the next development session.
- [Engineering Guide](docs/ENGINEERING_GUIDE.md): current architecture, API reference, data model, testing strategy, operational notes, and maintenance rules.
- [Default Group Design](docs/DESIGN_007_DEFAULT_GROUP.md): approved membership, invitations, public-list discovery, and deferred group management.
- [Default Group Implementation Plan](docs/PLAN_007_DEFAULT_GROUP.md): implementation and validation records, including sharing and PUBLIC-default refinements.
- [Authentication Design](docs/AUTHENTICATION_DESIGN.md): approved login, session, public-list, security, and future SSO boundaries.
- [Chinese Product Specification](docs/PROJECT_SPEC_ZH.md): approved Version 1 product specification in Chinese.
- [English Product Specification](docs/PROJECT_SPEC_EN.md): approved Version 1 product specification in English.

## Scope

Authentication, public/private personal lists, and Default Group invitations/member discovery are approved extensions to the original Version 1 specification. The current scope still excludes group management, multiple groups, group-only visibility, implemented SSO providers, password recovery, email verification, account deletion, anonymous user discovery/follows, audio or lyrics, video ingestion, OCR, AI extraction, and admin tooling. See [AUTHENTICATION_DESIGN.md](docs/AUTHENTICATION_DESIGN.md) for the approved extension and [PROJECT_SPEC_EN.md](docs/PROJECT_SPEC_EN.md) for the original baseline.
