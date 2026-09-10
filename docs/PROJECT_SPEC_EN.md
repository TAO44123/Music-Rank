# Music Rank Web App — Version 1 Project Specification

## 1. Document Status

- Status: Approved baseline for Version 1 planning
- Product type: Local-first web application
- Intended usage: One demo user in Version 1; tens to low hundreds of users in later versions
- Deployment status: Local development only in Version 1
- Future cloud target: AWS

This document is the implementation baseline for Version 1. Any material scope or architecture change should update both this English specification and PROJECT_SPEC_ZH.md before implementation continues.

## 2. Product Summary

Music Rank turns a curated song ranking into an interactive list from which a user can build a personal Top 10 and maintain a singing list.

Version 1 is a focused functional demo. It validates this core loop:

1. Browse or search a seeded song ranking.
2. Add songs to My Top 10.
3. Reorder or remove Top 10 entries.
4. Add songs to My Singing List.
5. Assign and update a singing status and note.
6. Reload the application and retain all changes.

## 3. Version 1 Goals

- Deliver a complete local full-stack application.
- Validate that ranking discovery, personal ranking, and singing-list management are useful together.
- Exercise real API and database persistence instead of browser-only mock state.
- Keep the architecture ready for authentication and AWS deployment without implementing either in Version 1.
- Keep the codebase intentionally small and easy to change.

## 4. Version 1 Scope

### 4.1 Included

- One responsive single-page web application.
- One seeded demo ranking: “90s Mainland China Pop Songs.”
- Approximately 30 seeded song records.
- Song and artist names may remain in Chinese.
- English application interface and system messages.
- Ranking browsing in rank order.
- Search by song title or artist, with additional artist and release-year filters.
- My Top 10 with a maximum of 10 unique songs.
- Add, remove, drag-to-reorder, and button-based reorder interactions.
- My Singing List.
- Singing statuses:
  - Can Sing
  - Regularly Sing
  - Practicing
  - Want to Learn
- One optional short note per singing-list entry.
- Filter the singing list by status.
- PostgreSQL persistence through the backend API.
- A seed script for the demo user, ranking, songs, and ranking entries.
- Local development through Node.js and Docker Compose.
- Automated checks for critical backend and frontend behavior.

### 4.2 Excluded

- Registration, login, logout, password recovery, and multiple accounts.
- Cross-device identity or synchronization.
- Public user profiles, sharing, social features, and recommendations.
- Admin or editorial interface.
- Video URL ingestion, subtitle extraction, OCR, AI extraction, or review queues.
- Real or authoritative ranking claims.
- Audio playback, audio hosting, downloads, or lyrics.
- Payments, subscriptions, and advertisements.
- Production deployment, CI/CD, custom domains, production monitoring, and production backups.
- Voice input and natural-language commands.

Video extraction is intentionally removed from Version 1. No placeholder endpoint or disabled user interface control will be implemented for it.

## 5. Content Rules

- The Version 1 ranking is fictional demo content used to exercise the product.
- The seed data must not describe the ranking as official, authoritative, or complete.
- The ranking source type is DEMO.
- The source URL is null in Version 1.
- The interface must visibly label the ranking as demo data.
- Song and artist names are proper nouns and may use their original Chinese writing.
- All source code, identifiers, comments, filenames, interface labels, API messages, and test descriptions must be English.
- PROJECT_SPEC_ZH.md is an explicit documentation exception.

## 6. User Model for Version 1

Version 1 behaves as a single-user application.

- The database contains one seeded demo user with a stable UUID.
- The application does not show a login screen and does not claim that authentication occurred.
- A centralized current-user resolver maps every /api/me request to the seeded demo user.
- Business logic and data access must receive a user ID from the resolver instead of importing or duplicating the fixed ID.
- Personal tables include user_id from the beginning.
- The fixed demo user ID is defined in one server configuration location and mirrored by the seed script.

### 6.1 Version 2 Authentication Migration

Authentication will replace the current-user resolver without changing the personal-list resource model.

Expected migration steps:

1. Add an authentication provider or first-party authentication flow.
2. Resolve the authenticated subject to a User record.
3. Replace the demo resolver with authentication middleware.
4. Decide whether to migrate or discard the seeded demo user's data.
5. Add authorization tests that prevent access to another user's records.

## 7. Primary User Experience

### 7.1 Page Structure

Version 1 uses one application route.

- Header: product name, short description, and a visible “Demo Data” indicator.
- Ranking area: search field, result count, and ranked song list.
- My Top 10 area: selected count, ordered entries, reorder controls, and removal controls.
- My Singing List area: status filters, entries, status controls, notes, and removal controls.

Desktop may use a multi-column working layout. Mobile may use Material UI tabs or stacked sections, provided all core actions remain easy to reach.

### 7.2 Ranking Behavior

- Display rank, title, and artist for every result.
- Default ordering follows the seeded ranking position.
- Search is case-insensitive and matches title or artist.
- Artist and release-year filters can be used independently or combined with text search.
- An empty search result shows a clear empty state.
- Each row exposes actions for My Top 10 and My Singing List.
- Already-added states are visible and duplicate additions are prevented.

### 7.3 My Top 10 Behavior

- A user may store zero to ten songs.
- A song may appear only once in the list.
- New entries are appended to the final position.
- When the list contains ten songs, further additions fail with a clear message.
- Both drag-and-drop and accessible move-up/move-down buttons are supported.
- The server is authoritative for the saved order.
- Reordering is persisted as one atomic operation.
- Removing an entry closes the gap and renumbers the remaining positions.
- Removing a song from My Top 10 does not remove it from My Singing List.

### 7.4 My Singing List Behavior

- A song may appear only once per user.
- Each entry has exactly one current status.
- Adding a song requires selecting a status; the default status is Want to Learn.
- The status can be changed at any time.
- The note is optional, plain text, and limited to 300 characters.
- The list can be filtered by status.
- Removing a song from My Singing List does not remove it from My Top 10.

### 7.5 Approved Layout and Visual Direction

Version 1 uses the approved “Concept C layout with the Warm Archive palette,” also referred to as the C1 theme.

Desktop layout:

- A compact application header with the product name and Demo Data indicator.
- A wide ranking workspace on the left.
- A narrower personal workspace on the right.
- My Top 10 and My Singing List remain visible as distinct sections in the personal workspace.
- Core actions are exposed in the first viewport without a marketing hero.

Mobile layout:

- Ranking, Top 10, and Singing List are available through touch-friendly navigation.
- The same information hierarchy and actions are retained.
- Controls must remain usable without relying on drag-and-drop.

Approved visual characteristics:

- Modern Material UI structure with a warm editorial and music-archive character.
- Warm ivory page background and cream surfaces.
- Brick red as the primary action color.
- Muted gold as the secondary accent.
- Dark ink text with restrained tan borders.
- No gradients, album artwork, photography, glassmorphism, or decorative clutter.
- Light theme only in Version 1; token structure must allow a future dark theme.

Approved core color tokens:

| Token | Value |
| --- | --- |
| Page background | #F6F0E5 |
| Surface | #FFFCF6 |
| Primary | #A63D2F |
| Secondary | #C99A3D |
| Main text | #25221E |
| Border | #D8CCB9 |
| Selected row | #F2E6D5 |

The values may receive small accessibility adjustments during implementation, but their visual character must remain unchanged.

## 8. Technical Stack

### 8.1 Runtime and Language

- Node.js 24 LTS
- TypeScript with strict type checking
- ECMAScript modules
- npm and npm workspaces

The exact Node.js 24 minor version is pinned in development and deployment configuration when implementation begins. The package lockfile is committed once a Git repository is created.

### 8.2 Frontend

- React with TypeScript
- Vite
- Material UI as the primary component system
- Material Icons
- React state and hooks for local interface state
- TanStack Query for server-state fetching, caching, mutation, and invalidation
- dnd-kit for pointer, touch, and keyboard-aware drag-and-drop
- Zod-backed shared request and response contracts where useful

No global state library is required for Version 1 unless implementation demonstrates a clear need.

The Material UI theme is the single source of truth for colors, typography, spacing, radii, shadows, breakpoints, and singing-status colors. Product-specific reusable components remain inside apps/web; Version 1 does not create a separate component package or Storybook installation.

### 8.3 Backend

- Express 5
- TypeScript
- Zod for request validation
- Drizzle ORM
- PostgreSQL driver compatible with local and future managed PostgreSQL
- Structured JSON logging
- Centralized error handling
- Graceful shutdown and database connection cleanup

### 8.4 Database

- PostgreSQL
- Docker Compose for local development
- SQL migrations generated and tracked through Drizzle
- Seed script written in TypeScript

PostgreSQL is preferred over MongoDB because the product depends on relationships, ordering, uniqueness constraints, and atomic list updates. It also maps directly to a future managed PostgreSQL service on AWS.

### 8.5 Testing

- Vitest for unit tests
- Supertest for Express API integration tests
- React Testing Library for frontend component behavior
- Playwright for one critical end-to-end workflow

## 9. Repository Structure

The project will use a small npm-workspaces monorepo:

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
      docs/
        README.md
        IMPLEMENTATION_HANDOFF.md
        PROJECT_SPEC_EN.md
        PROJECT_SPEC_ZH.md
        PROJECT_MVP.md
      docker-compose.yml
      package.json
      tsconfig.base.json
      .env.example

Responsibilities:

- apps/web: React application and browser-facing behavior.
- apps/api: Express API, current-user resolver, services, and HTTP concerns.
- packages/contracts: shared API schemas and TypeScript types.
- packages/database: Drizzle schema, database client, migrations, and seeds.
- scripts: repository-level development and maintenance scripts.

## 10. Application Architecture

Local request flow:

    Browser
      -> React application
      -> /api REST requests
      -> Express
      -> current-user resolver
      -> application service
      -> Drizzle ORM
      -> PostgreSQL

During development, Vite and Express may run as separate local processes with a Vite proxy for /api. A production build must support Express serving the compiled React assets so the application can later ship as one container and one origin.

## 11. Data Model

### 11.1 User

- id: UUID, primary key
- display_name: text
- created_at: timestamp
- updated_at: timestamp

Version 1 contains one seeded record.

### 11.2 Song

- id: UUID, primary key
- title: text, required
- artist: text, required
- release_year: integer, nullable
- verification_status: enum DEMO, VERIFIED, UNVERIFIED
- created_at: timestamp
- updated_at: timestamp

The initial logical duplicate key is normalized title plus normalized artist. The seed script must not create duplicate songs.

### 11.3 Ranking

- id: UUID, primary key
- title: text, required
- era: text, nullable
- source_type: enum DEMO, OFFICIAL, MEDIA, COMMUNITY
- source_url: text, nullable
- description: text, nullable
- is_published: boolean
- verified_at: timestamp, nullable
- created_at: timestamp
- updated_at: timestamp

### 11.4 RankingEntry

- id: UUID, primary key
- ranking_id: UUID, foreign key
- song_id: UUID, foreign key
- rank: integer greater than zero
- source_timestamp_seconds: integer, nullable
- verification_status: enum DEMO, VERIFIED, UNVERIFIED

Constraints:

- Unique ranking_id plus rank.
- Unique ranking_id plus song_id.

### 11.5 UserTopListEntry

- id: UUID, primary key
- user_id: UUID, foreign key
- song_id: UUID, foreign key
- position: integer from 1 through 10
- created_at: timestamp
- updated_at: timestamp

Constraints:

- Unique user_id plus song_id.
- Unique user_id plus position.
- At most ten entries per user, enforced by transactional service logic and verified by tests.

### 11.6 SingingListEntry

- id: UUID, primary key
- user_id: UUID, foreign key
- song_id: UUID, foreign key
- status: enum CAN_SING, REGULARLY_SING, PRACTICING, WANT_TO_LEARN
- note: text, nullable, maximum 300 characters at the API boundary
- created_at: timestamp
- updated_at: timestamp

Constraint:

- Unique user_id plus song_id.

## 12. REST API

All responses use JSON. Expected client errors use stable English error codes and human-readable English messages.

### 12.1 System

- GET /api/health
  - Returns service and database health.

### 12.2 Rankings and Songs

- GET /api/rankings
  - Returns published rankings.
- GET /api/rankings/:rankingId
  - Returns ranking metadata and entries.
  - Optional query parameter q filters by song title or artist.
  - Optional query parameters artist and releaseYear filter by exact artist and release year.
- GET /api/songs
  - Optional query parameter q searches available songs.

### 12.3 My Top 10

- GET /api/me/top-list
- POST /api/me/top-list/items
  - Body: songId
- PATCH /api/me/top-list/order
  - Body: orderedSongIds
- DELETE /api/me/top-list/items/:songId

### 12.4 My Singing List

- GET /api/me/singing-list
  - Optional query parameter status.
- PUT /api/me/singing-list/items/:songId
  - Body: status and optional note.
- DELETE /api/me/singing-list/items/:songId

### 12.5 API Conventions

- Validate path, query, and body input.
- Return 400 for invalid requests.
- Return 404 for missing resources.
- Return 409 for duplicate or Top 10 capacity conflicts.
- Return a request ID with unexpected server errors.
- Do not expose stack traces or database details in responses.

## 13. Seed Data

The seed process creates:

- One stable demo user.
- One published demo ranking.
- Approximately 30 representative 1990s Mainland China pop song records.
- One RankingEntry for every song.
- No initial Top 10 entries.
- No initial singing-list entries.

The seed must be idempotent. Re-running it must update or preserve the known demo records without duplicating them.

Exact seed titles will be selected during implementation. They are illustrative product fixtures, not a researched or authoritative chart.

## 14. Local Development

### 14.1 Prerequisites

- Node.js 24 LTS
- npm
- Docker with Docker Compose

A pre-existing PostgreSQL container or local PostgreSQL installation is not required. Docker Compose will declare the database service, pull the pinned PostgreSQL image on first use, create the container, and mount a named volume for persistent local data.

### 14.2 Environment Variables

The committed .env.example will document at least:

- NODE_ENV
- PORT
- DATABASE_URL
- DEMO_USER_ID
- LOG_LEVEL

Secrets and machine-specific values must not be committed.

### 14.3 Expected Commands

The root workspace should expose commands equivalent to:

- Install dependencies.
- Start PostgreSQL.
- Apply database migrations.
- Seed the database.
- Start frontend and backend development servers.
- Type-check all workspaces.
- Run tests.
- Build all workspaces.
- Run the production-shaped local server.

The final command names will be documented in the repository README after scaffolding.

## 15. Reliability, Security, and Accessibility

### 15.1 Version 1 Baseline

- Parameterized database queries through the ORM.
- Strict request validation.
- Centralized error handling.
- Same-origin production architecture.
- No secrets in frontend code.
- Health endpoint.
- Graceful server shutdown.
- Database operations for reorder actions use transactions.
- User-visible loading, empty, success, and error states.

### 15.2 Accessibility

- All controls have accessible names.
- Top 10 can be fully reordered without drag-and-drop.
- Keyboard focus remains visible.
- Status is not communicated by color alone.
- Touch targets are suitable for mobile interaction.
- Material UI components are used without removing their accessibility behavior.

## 16. Test Plan

Minimum automated coverage:

- Ranking search by title and artist.
- Adding a unique song to My Top 10.
- Rejecting a duplicate Top 10 song.
- Rejecting an eleventh Top 10 song.
- Reordering Top 10 atomically.
- Removing an entry and closing position gaps.
- Creating and updating a singing-list entry.
- Enforcing one singing status per song.
- Filtering singing-list entries by status.
- Preserving independence between Top 10 and My Singing List.
- One Playwright flow: open the ranking, search, add songs, reorder, add a singing status, reload, and verify persistence.

## 17. Version 1 Acceptance Criteria

- The application starts locally from documented commands.
- PostgreSQL starts through Docker Compose.
- The seed creates one demo ranking with approximately 30 songs.
- The ranking is clearly labeled as demo data.
- Songs can be browsed and searched by title or artist, and filtered by artist or release year.
- A song can be added to or removed from My Top 10.
- Duplicate Top 10 entries are impossible.
- My Top 10 cannot exceed ten songs.
- Top 10 supports drag-and-drop and move buttons.
- Saved Top 10 order survives a reload and server restart.
- Songs can be added to My Singing List.
- Singing status and note can be updated.
- Singing List can be filtered by status.
- Top 10 and Singing List membership remain independent.
- The key automated tests pass.
- The responsive interface supports current desktop and mobile browsers.

## 18. Future Roadmap

### Version 2: Accounts

- Add real authentication.
- Support multiple users.
- Add authorization and data isolation.
- Decide how demo data is migrated.
- Enable cross-device persistence.

### Later Content Operations

- Add multiple rankings and verified source metadata.
- Add an editorial/admin workflow.
- Add import jobs and human review if video extraction is reconsidered.

Video ingestion must be treated as a separate feasibility project. It may require platform-specific access, transcript availability, frame extraction, OCR, AI normalization, asynchronous jobs, and human verification. It is not assumed to be a universal URL-to-ranking feature.

### Later AWS Deployment

The application remains deployable as one container with a managed PostgreSQL database. A future AWS plan may include:

- Container registry.
- Managed container runtime.
- Managed PostgreSQL.
- Secret management.
- HTTPS and custom domain.
- Centralized logs and health monitoring.
- Database backups and restore testing.
- CI/CD from a future Git repository.

The exact AWS services and infrastructure-as-code tool are intentionally undecided until deployment work begins.

## 19. Explicit Non-Decisions

The following choices are intentionally deferred:

- Authentication provider and login method.
- AWS compute service.
- Infrastructure-as-code tool.
- Domain and DNS configuration.
- Production backup retention.
- Production alerting thresholds.
- Video source platforms and extraction method.
- Admin/editorial workflow.

## 20. Change Control

Before implementation, the project owner should confirm this specification. During implementation:

- Small implementation details may change without expanding scope.
- New user-facing capabilities require explicit approval.
- Any database or API contract change must update both language versions of this specification.
- Version 1 must not quietly absorb deferred deployment, authentication, or video-ingestion work.
