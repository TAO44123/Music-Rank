# Music Rank — Session Handoff

## Session Date

September 10, 2026 (America/New_York)

## Current Status

Music Rank Version 1 is implemented as a local full-stack application. The repository contains a React/Vite frontend, an Express API, PostgreSQL persistence through Drizzle ORM, demo seed data, and automated tests.

The latest work focused on UI refinement. The current interface should be visually reviewed before making additional product changes.

## Resume Tomorrow

From the project root:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open:

- Web application: http://localhost:5173
- API health endpoint: http://localhost:3001/api/health

The PostgreSQL container was healthy at the end of this session. Its name was `musicrank-database-1`, using the pinned `postgres:17.6-alpine` image and the named Docker volume declared in `docker-compose.yml`.

## Environment

- Node.js: 24.21.0
- npm: 11.19.0
- Vite: 7.2.1
- PostgreSQL: 17.6 Alpine through Docker Compose

Vite and `@vitejs/plugin-react` are intentionally pinned to `7.2.1` and `5.1.1`. A newer resolved combination caused the development server to return HTTP 500 with `Missing field moduleType` from the React refresh wrapper, even though production builds succeeded. Do not broaden these versions without verifying `npm run dev` and requesting `/@vite/client` successfully.

## Implemented Product Scope

### Ranking

- One clearly labeled fictional demo ranking with 30 seeded songs.
- Search by song title or artist.
- Exact artist and release-year filters that can be combined with text search.
- A compact `Clear` action for artist and year filters.
- Client-side pagination with 25 songs per page.
- Stable, centered action buttons for adding songs to personal lists.

### My Top 10

- Maximum of 10 unique songs.
- Add and remove actions.
- Persistent ordering through the API and PostgreSQL.
- Drag-and-drop reorder.
- Accessible move-up and move-down controls.
- The drag handle intentionally has no circular border.

### My Singing List

- The latest design follows the approved "Compact Ledger" direction.
- Compact status-filter chips replace the full-width status dropdown.
- Collapsed rows show a status color rail, song, artist, note preview, current status, edit, and remove actions.
- Status and note controls appear only when a row is expanded for editing.
- Expanded editing uses compact status chips and a lightweight underline-style note field.
- Notes remain plain text with a 300-character limit.
- Membership remains independent from My Top 10.

### Visual System

- C1 Warm Archive palette remains the Material UI theme source of truth.
- Headings use a taller system serif stack led by Iowan Old Style and Palatino.
- The application remains light-theme only, responsive, and free of artwork, gradients, photography, and decorative clutter.

## Backend and Data

- REST endpoints cover health, rankings, song search, Top 10, and Singing List workflows.
- `/api/me` uses the centralized demo-current-user resolver.
- The demo user ID remains centralized and shared with the seed script.
- Database constraints prevent duplicate ranking positions, duplicate personal entries, and invalid Top 10 positions.
- Top 10 reorder is transactional and uses a deferred per-user position constraint.
- The seed is idempotent and does not intentionally overwrite personal-list data.

## Documentation Layout

All Markdown documentation is separated from source code under `docs/`:

- `docs/README.md`
- `docs/IMPLEMENTATION_HANDOFF.md`
- `docs/PROJECT_SPEC_EN.md`
- `docs/PROJECT_SPEC_ZH.md`
- `docs/PROJECT_MVP.md`
- `docs/SESSION_HANDOFF.md`

The English and Chinese Version 1 specifications were updated to include artist and release-year filtering.

## Verification Status

Most recent successful checks:

- `npm run typecheck`
- Frontend tests: 5 passing across 2 test files
- Backend integration tests: 4 passing
- Frontend production build
- Database migration from the tracked Drizzle migration
- Idempotent seed execution verified by running the seed twice

The Playwright workflow passed before the latest Compact Ledger redesign. It still targets the previous Singing List status dropdown and should be updated to select a status chip through the expanded editor before treating the current end-to-end suite as passing.

## Known Non-Blocking Issues

- The production frontend bundle is approximately 611 KB before gzip and triggers Vite's 500 KB chunk-size warning. This is acceptable for the current local Version 1 demo but can be revisited if bundle performance becomes a priority.
- Frontend tests emit a Vite compatibility warning about deprecated `esbuild` options supplied by the React plugin. Tests and builds complete successfully with the pinned versions.
- The last dependency audit reported 6 vulnerabilities: 4 moderate and 2 high. They were not automatically changed because `npm audit fix --force` may introduce breaking dependency upgrades. Review them individually before upgrading.

## Git State

- Local Git is initialized on branch `master`.
- There are no commits yet.
- No remote is configured.
- All project files are currently untracked and ready for review.
- Do not create a remote, push, or deploy without explicit user approval.

## Recommended Next Steps

1. Start the application and visually review the Compact Ledger Singing List on desktop and mobile widths.
2. Update the Playwright Singing List interaction to open the compact editor and choose the `Practicing` status chip.
3. Run `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e` together.
4. Address only concrete UI feedback or functional defects found during review.
5. Create the first logical local commit only if the user requests it.

## Scope Guardrails

Version 1 still excludes authentication, multiple accounts, remote repositories, deployment, audio playback, lyrics, social features, video ingestion, OCR, AI extraction, and admin tooling. Do not add placeholders for excluded capabilities.
