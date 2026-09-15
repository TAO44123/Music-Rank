# Ranking Catalog Design

> Status: Refined during Task 3A
> Approved: 2026-09-15
> Execution plan: [RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md](RANKING_CATALOG_EXPANSION_EXECUTION_PLAN.md)

## Goal

Model each published ranking as a first-class catalog item. A ranking's stable
slug is its public identity; decade, region, language, platform, or other
descriptors must not determine routing or uniqueness.

This refinement replaces Task 1's original `decade × region` navigation model.
It allows future catalogs such as Cantonese or Minnan rankings to overlap with
regional or decade rankings without forcing them into one taxonomy.

## Public identity and navigation

Published rankings use source-neutral paths:

```text
/rankings/:slug
```

For example, the pilot is `/rankings/90s-mainland-top-100`. The Bilibili
platform remains source metadata and is not part of its slug or API identity.

`/` loads the published catalog in deterministic display order and redirects to
the first item. The UI renders one scrollable row of direct ranking tabs. It
does not synthesize or disable decade-and-region combinations.

Search, artist, release-year, and page state use validated URL search
parameters. Changing rankings preserves text search, clears ranking-scoped
artist and release-year filters, and resets the page to 1.

## Data model

`rankings` contains:

- `slug`: stable, unique, source-neutral public identifier.
- `display_order`: positive deterministic catalog order.
- `decade_start`: optional metadata, currently supporting 1980 or 1990 when
  present.
- `region`: optional `HK_TW` or `MAINLAND` metadata when applicable.
- source and publication metadata.

There is no uniqueness constraint on `decade_start + region`. Multiple
published rankings may share either or both values, and a ranking may omit
both. UUIDs remain the relational identifiers.

Membership is represented only by `ranking_entries`. A single shared `songs`
row may belong to any number of rankings and has an independent rank in each
one. This supports overlap between, for example, a Cantonese ranking and a Hong
Kong/Taiwan ranking without duplicating the song.

## Optional metadata presentation

The detail API may return nullable `decade`, `decadeStart`, `region`, and `era`
metadata. When present, the ranking header displays it as secondary chips. The
ranking title and slug remain authoritative; missing taxonomy metadata never
prevents routing, publication, import, or display.

Each ranking currently has one optional source URL. The catalog list exposes
only `hasSource`; the detail endpoint exposes the URL for a safe external
`Watch source` action. Source platform names are not part of public routing.

## API

```http
GET /api/rankings
GET /api/rankings/:slug?q=&artist=&releaseYear=
```

The list endpoint returns published rankings in display order. The detail
endpoint resolves a published ranking by slug and returns its source URL,
ranking-scoped facets, and filtered entries in rank order. Missing or
unpublished slugs return `404 RANKING_NOT_FOUND`; invalid slugs return
`400 INVALID_REQUEST`.

## Demo and pilot

The 30-entry `90s-demo-ranking` remains stored and intentionally unpublished.
The 100-entry pilot is published as `90s-mainland-top-100`; its approved
Bilibili URL is display metadata only. Publication does not delete the Demo,
its entries, or its songs.

## Non-goals

- User-submitted songs or Admin catalog management
- Fuzzy matching or automatic duplicate merging
- Multiple-source aggregation
- Importing the remaining rankings
- A universal taxonomy for language, dialect, geography, genre, or era

## Acceptance criteria

- Public routes and detail lookups use source-neutral ranking slugs.
- Decade and region are nullable metadata and are not a uniqueness key.
- The UI selects rankings directly and renders optional metadata only when
  present.
- Multiple published rankings may share metadata.
- The same song can have different ranks in different rankings.
- Filter facets remain scoped to the selected ranking.
- The Demo and all existing user data survive migration.
