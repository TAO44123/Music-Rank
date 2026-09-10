# Music Rank Version 1 — Implementation Handoff

## Purpose

This document is the starting context for a new implementation session. It summarizes the approved product decisions and gives explicit instructions for creating Version 1.

The new session should read this file first. The detailed specifications are:

- PROJECT_SPEC_EN.md — primary implementation specification
- PROJECT_SPEC_ZH.md — Chinese reference copy
- PROJECT_MVP.md — original product exploration; useful background, but not the Version 1 source of truth

If this handoff conflicts with PROJECT_SPEC_EN.md, stop and ask the user which document should be updated. Do not silently choose one.

## Working Rules

- Discuss decisions with the user in Chinese.
- Write all project files, source code, identifiers, comments, UI copy, API messages, test names, and documentation in English.
- Chinese song titles and artist names are allowed as proper nouns.
- PROJECT_SPEC_ZH.md is an explicit exception to the English-only file-content rule.
- Do not add user-facing capabilities outside the approved Version 1 scope.
- Ask the user when a material product or architecture decision is unclear. Do not guess.
- Small implementation details that do not change product scope may be decided using conventional defaults.
- Preserve and update both specification files if an approved decision changes.

## Authorization

The user has approved:

- The Version 1 product scope.
- The technology stack.
- The C1 visual direction.
- Local Git initialization.
- Local-only implementation for Version 1.

The implementation session may initialize the project and local Git repository.

The implementation session must not:

- Create or connect a remote Git repository.
- Push code to a remote.
- Deploy to AWS or any other cloud.
- Purchase services or create cloud resources.
- Implement authentication.
- Implement video ingestion or AI extraction.

## Product Summary

Music Rank is a responsive single-page web application for:

1. Browsing and searching one seeded demo song ranking.
2. Building and reordering My Top 10.
3. Maintaining My Singing List with a status and optional note.
4. Persisting all changes through a real Express API and PostgreSQL database.

Version 1 is a focused full-stack demo, not the complete original MVP.

## Approved Version 1 Scope

### Include

- One responsive single-page application.
- One fictional demo ranking named “90s Mainland China Pop Songs.”
- Approximately 30 seeded song records.
- A visible Demo Data label.
- Ranking rows with rank, song title, and artist.
- Search by song title or artist, with additional artist and release-year filters.
- My Top 10 with a maximum of 10 unique songs.
- Add and remove Top 10 entries.
- Drag-and-drop reorder.
- Move-up and move-down reorder buttons.
- Persistent Top 10 order.
- My Singing List.
- One status per singing-list song:
  - Can Sing
  - Regularly Sing
  - Practicing
  - Want to Learn
- Optional plain-text note, maximum 300 characters.
- Filter Singing List by status.
- Real backend API and PostgreSQL persistence.
- Idempotent database seed script.
- Local Docker Compose database.
- Automated tests for critical behavior.

### Exclude

- Registration, login, logout, or multiple accounts.
- Cross-device identity.
- Admin or editorial interface.
- Multiple public rankings.
- Video URL ingestion.
- Subtitle extraction, OCR, AI extraction, or review queues.
- Audio playback, lyrics, downloads, and media hosting.
- Voice input and natural-language commands.
- Sharing, social features, recommendations, and payments.
- Remote Git setup.
- CI/CD, AWS deployment, custom domains, production monitoring, and production backups.

Do not add placeholder screens, disabled controls, or placeholder endpoints for excluded features.

## Single-User Design

Version 1 behaves as one user without pretending that authentication exists.

- Seed one demo User with a stable UUID.
- Define the demo user ID in one server configuration location.
- Use the same ID in the seed script.
- Route all /api/me requests through a centralized current-user resolver.
- Services and repositories receive userId as an argument.
- Never scatter the fixed user ID through business logic.
- Keep user_id columns and per-user constraints in all personal data tables.

Version 2 will replace the current-user resolver with authentication middleware. The personal-list resource model should not require redesign.

## Approved Technology Stack

### Runtime and Workspace

- Node.js 24 LTS
- TypeScript with strict type checking
- ECMAScript modules
- npm
- npm workspaces

Pin the exact Node.js 24 minor version when scaffolding begins.

### Frontend

- React with TypeScript
- Vite
- Material UI
- Material Icons
- TanStack Query
- dnd-kit
- React Testing Library

Do not add a global state library unless a concrete implementation need is demonstrated.

### Backend

- Express 5
- TypeScript
- Zod
- Drizzle ORM
- PostgreSQL driver
- Structured JSON logging
- Centralized error handling
- Graceful shutdown

### Database

- PostgreSQL
- Docker Compose for local development
- Drizzle migrations
- TypeScript seed script

A PostgreSQL container does not currently exist. The project must declare it in docker-compose.yml. On first use, Docker Compose should pull a pinned PostgreSQL image, create the container, and mount a named volume. Do not require a separate local PostgreSQL installation.

### Tests

- Vitest for unit tests
- Supertest for Express integration tests
- React Testing Library for frontend component tests
- Playwright for the critical end-to-end workflow

## Approved Repository Shape

Use a small npm-workspaces monorepo:

    music-rank/
      apps/
        web/
          src/
        api/
          src/
      packages/
        contracts/
          src/
        database/
          src/
          migrations/
      scripts/
      docker-compose.yml
      package.json
      tsconfig.base.json
      .env.example
      docs/
        README.md
        IMPLEMENTATION_HANDOFF.md
        PROJECT_SPEC_EN.md
        PROJECT_SPEC_ZH.md
        PROJECT_MVP.md

Responsibilities:

- apps/web: React UI and browser behavior.
- apps/api: Express HTTP layer, current-user resolver, and application services.
- packages/contracts: shared Zod schemas and TypeScript API types.
- packages/database: Drizzle schema, client, migrations, and seed data.

Keep the structure small. Do not create speculative packages or abstraction layers.

## Approved Visual Direction

Use the “Concept C layout with the Warm Archive palette,” called the C1 theme.

### Desktop Layout

- Compact application header with Music Rank and Demo Data.
- Wide ranking workspace on the left.
- Narrower personal workspace on the right.
- My Top 10 and My Singing List appear as clear personal-workspace sections.
- Core actions are visible in the first viewport.
- Do not add a marketing hero.

### Mobile Layout

- Ranking, Top 10, and Singing List use touch-friendly navigation.
- Preserve the same information hierarchy and capabilities.
- Reordering must work through buttons even when drag-and-drop is unavailable.

### Theme Tokens

| Token | Value |
| --- | --- |
| Page background | #F6F0E5 |
| Surface | #FFFCF6 |
| Primary | #A63D2F |
| Secondary | #C99A3D |
| Main text | #25221E |
| Border | #D8CCB9 |
| Selected row | #F2E6D5 |

Use the Material UI theme as the single source of truth for:

- Colors
- Typography
- Spacing
- Radii
- Shadows
- Breakpoints
- Singing-status colors

Keep reusable product components inside apps/web. Do not create a separate component package or install Storybook in Version 1.

Visual constraints:

- Light theme only.
- No gradients.
- No album artwork.
- No photography.
- No glassmorphism.
- No excessive decorative elements.
- Small color adjustments are allowed only when needed for accessible contrast.

## Core Data Model

Implement the complete model from PROJECT_SPEC_EN.md:

- User
- Song
- Ranking
- RankingEntry
- UserTopListEntry
- SingingListEntry

Required invariants:

- A ranking cannot contain duplicate ranks.
- A ranking cannot contain the same song twice.
- A user cannot contain the same song twice in My Top 10.
- A user cannot contain duplicate Top 10 positions.
- Top 10 positions are integers from 1 through 10.
- A user cannot have more than 10 Top 10 entries.
- A user cannot contain the same song twice in My Singing List.
- Every singing-list entry has exactly one valid status.
- Top 10 and Singing List membership are independent.
- Top 10 reorder is atomic.

## Required REST API

System:

- GET /api/health

Rankings and songs:

- GET /api/rankings
- GET /api/rankings/:rankingId
- GET /api/songs

My Top 10:

- GET /api/me/top-list
- POST /api/me/top-list/items
- PATCH /api/me/top-list/order
- DELETE /api/me/top-list/items/:songId

My Singing List:

- GET /api/me/singing-list
- PUT /api/me/singing-list/items/:songId
- DELETE /api/me/singing-list/items/:songId

Follow the validation and error conventions in PROJECT_SPEC_EN.md.

## Seed Data

Create an idempotent seed process containing:

- One stable demo user.
- One published demo ranking.
- Approximately 30 representative 1990s Mainland China pop songs.
- One RankingEntry per song.
- Empty personal lists on the first seed.

The songs are product fixtures, not an authoritative chart. The UI must label the ranking as demo data. Source URL should be null and source type should be DEMO.

Use credible song and artist names, but do not claim ranking authority. If online research is used, record source links in implementation notes; do not copy copyrighted lyrics or media.

## Recommended Implementation Order

Work incrementally and verify each stage:

1. Inspect the existing workspace and specifications.
2. Confirm that no unexpected files or user changes would be overwritten.
3. Initialize a local Git repository.
4. Scaffold the npm-workspaces structure.
5. Pin Node.js 24 and configure strict shared TypeScript settings.
6. Add Docker Compose for PostgreSQL.
7. Add environment validation and .env.example.
8. Implement the Drizzle schema and first migration.
9. Implement the idempotent seed script.
10. Implement Express health, ranking, song, Top 10, and Singing List APIs.
11. Add backend integration tests for data constraints and list behavior.
12. Build the first meaningful React screen using the approved C1 theme.
13. Implement ranking browse and search.
14. Implement My Top 10 add, remove, button reorder, and drag reorder.
15. Implement My Singing List status, note, remove, and filtering.
16. Add loading, empty, success, conflict, and error states.
17. Complete responsive and keyboard behavior.
18. Add component tests and the critical Playwright workflow.
19. Run type checks, tests, production builds, and the production-shaped local server.
20. Review the final result against the acceptance criteria.

Do not move to cloud deployment after Version 1 validation.

## Verification Requirements

At minimum, verify:

- The database starts through Docker Compose.
- Migrations apply from a clean database.
- The seed is idempotent.
- The application loads the seeded ranking.
- Search matches title and artist, and artist/year filters work independently and in combination.
- Duplicate Top 10 additions are rejected.
- An eleventh Top 10 entry is rejected.
- Button and drag reordering persist.
- Removing a Top 10 song closes position gaps.
- Singing status and notes persist.
- Singing List status filtering works.
- Removing from one personal list does not affect the other.
- Reloading and restarting the application preserve data.
- Current desktop and mobile layouts are usable.
- Type checks, automated tests, and production builds pass.

## Git Instructions

- Initialize Git locally at the project root.
- Add an appropriate Node, environment, build-output, test-output, and editor .gitignore.
- Do not commit secrets.
- Do not configure a remote.
- Do not push.
- Create logical local commits only if the user asks; otherwise leave the working tree ready for review.

## Environment Notes

The user has confirmed:

- Node.js 24 is installed.
- Docker is installed.
- No PostgreSQL container currently exists.

Before scaffolding, run read-only checks for the exact Node, npm, Docker, and Docker Compose versions. If Docker is installed but unavailable, report the concrete issue. Ask before installing or upgrading system software.

Dependency installation and the first PostgreSQL image pull require network access. Request permission if the environment blocks these operations.

## Definition of Done

Version 1 is complete only when:

- The documented local setup works from a clean environment.
- The single seeded ranking is visible and clearly marked as demo data.
- Search, Top 10, and Singing List workflows work end to end.
- Personal data persists through the API and PostgreSQL.
- Both reorder methods work.
- The C1 layout and theme are implemented consistently.
- Critical automated tests pass.
- The production build succeeds.
- docs/README.md explains local setup, migrations, seeding, development, testing, and production-shaped local execution.
- No excluded capability has been added.

## First Message for the New Session

The user can start the new session with:

> Read docs/IMPLEMENTATION_HANDOFF.md and the specifications it references. Then create Music Rank Version 1 exactly within the approved scope. Begin with read-only environment and workspace checks, initialize local Git, and implement incrementally. Ask me before making any material product or architecture decision that is not already covered.
