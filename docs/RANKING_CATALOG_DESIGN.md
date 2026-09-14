# Ranking Catalog Design

> Status: Approved for Task 1 implementation
> Approved: 2026-09-14
> Execution plan: [RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md](RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md)

## Goal

Replace the single implicit ranking with a catalog of published rankings that
users navigate by decade and region. Task 1 establishes the model, read API,
routes, and interface; production YouTube data is imported later in Task 3.

## Approved first catalog

The initial production catalog has four combinations:

| Decade | Region | Public path |
| --- | --- | --- |
| 80s | Hong Kong/Taiwan | `/rankings/80s/hk-tw` |
| 80s | Mainland China | `/rankings/80s/mainland` |
| 90s | Hong Kong/Taiwan | `/rankings/90s/hk-tw` |
| 90s | Mainland China | `/rankings/90s/mainland` |

`/` redirects to `/rankings/90s/mainland`. Search, artist, release-year, and
page state use validated URL search parameters. Changing ranking clears the
ranking-scoped artist and release-year filters and resets the page to 1. Text
search is preserved. Changing a filter also resets the page to 1.

Each ranking has one source URL. The UI shows only a safe external link to the
original video. Filter facets are scoped to the selected ranking.

## Data model

`rankings` gains:

- `slug`: stable unique identifier for imports and administration.
- `decade_start`: numeric decade boundary, initially 1980 or 1990.
- `region`: controlled `HK_TW` or `MAINLAND` value.
- `display_order`: positive deterministic catalog order.

At most one published ranking may occupy a decade-and-region combination.
Unpublished rows can preserve historical or demo rankings for the same
combination. UUIDs remain the relational identifiers.

Membership in a ranking remains represented only by `ranking_entries`. A song
may be reused across rankings and have an independent rank in each one.

## Demo transition

The existing fixture is renamed `90s Demo Ranking`, classified as 1990s
Mainland, and remains published through Tasks 1 and 2. Task 3 imports the four
reviewed source rankings as unpublished rows, then atomically publishes them
while unpublishing the demo. No demo songs or entries are deleted.

## API

```http
GET /api/rankings
GET /api/rankings/:decade/:region?q=&artist=&releaseYear=
```

The list endpoint returns published catalog metadata in display order. The
detail endpoint resolves the one published ranking for the requested
combination and returns its source URL, ranking-scoped filter facets, and
filtered entries in rank order. Missing or unpublished combinations return
`404 RANKING_NOT_FOUND`.

## Non-goals for Task 1

- Importing or inventing production ranking data
- User-submitted songs
- Admin roles or catalog management UI
- Multiple sources or aggregation for one ranking
- More decades or regions than the approved initial catalog
- User-defined personal lists, friends, or SSO

## Acceptance criteria

- Explicit fixtures cover all four supported combinations.
- Published catalog ordering is deterministic.
- Stable paths, refresh, and browser history preserve selection and filters.
- The same song can have different ranks in different rankings.
- Catalog-only songs do not appear in selected-ranking filter facets.
- The demo ranking and all existing user data survive the migration.
- Anonymous ranking access and authenticated personal-list actions do not
  regress.
