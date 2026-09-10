# Music Rank

Music Rank is a local, full-stack demo for browsing a fictional ranking of 1990s Mainland China pop songs, building a persistent Top 10, and maintaining a personal singing list.

The ranking is explicitly **Demo Data**. It is a set of product fixtures, not an official, authoritative, or complete chart.

## Requirements

- Node.js 24.21.0 (pinned in `.nvmrc`)
- npm 11.19.0
- Docker with Docker Compose

## Local setup

```bash
cp .env.example .env
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite development server proxies `/api` requests to the Express server on port 3001.

The seed is idempotent. You can run `npm run db:seed` again without duplicating the demo user, ranking, songs, or ranking entries. It does not overwrite personal lists.

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
| `NODE_ENV=production PORT=3001 npm run start` | Run the production-shaped Express server, which serves the built web app and API from one origin. |

## Environment

Use `.env.example` as the template. `DEMO_USER_ID` is centrally configured in `packages/database/src/config.ts` and is shared by the seed script and current-user resolver. Version 1 does not implement authentication.

## Architecture

- `apps/web`: React, Vite, Material UI, TanStack Query, and dnd-kit UI.
- `apps/api`: Express 5 REST API, centralized request errors, structured JSON logs, current-user resolver, and graceful shutdown.
- `packages/contracts`: shared Zod request schemas and types.
- `packages/database`: Drizzle schema, PostgreSQL client, SQL migrations, and idempotent seed script.

All `/api/me` requests are resolved to the seeded demo user in one middleware location. Services receive the user ID as an argument so authentication can replace the resolver later without changing personal-list data models.

## Documentation

- [Engineering Guide](docs/ENGINEERING_GUIDE.md): current architecture, API reference, data model, testing strategy, operational notes, and maintenance rules.
- [Chinese Product Specification](docs/PROJECT_SPEC_ZH.md): approved Version 1 product specification in Chinese.
- [English Product Specification](docs/PROJECT_SPEC_EN.md): approved Version 1 product specification in English.

## Scope

Version 1 intentionally excludes accounts, multiple users, remote deployment, social features, audio or lyrics, video ingestion, OCR, AI extraction, and admin tooling. See [PROJECT_SPEC_EN.md](docs/PROJECT_SPEC_EN.md) for the approved baseline.
