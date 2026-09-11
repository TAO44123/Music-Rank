---
design_id: DESIGN-003
title: Song Platform Links
status: Proposed
author: chance
created: 2026-09-11
updated: 2026-09-11
supersedes: null
related:
  - DESIGN_002_TAB_NAVIGATION.md
  - PROJECT_SPEC_EN.md
  - ENGINEERING_GUIDE.md
---

# DESIGN-003 — Song Platform Links

> **Status: Proposed, not approved.** This document captures a requested
> feature and the constraints discovered while checking it against the current
> codebase. The open questions in section 6 must be answered before it becomes
> an approved design with an implementation plan.

## 1. Requested Behavior

Each song can carry one or more links to an external music platform. The song
row shows a small icon per available platform, and activating it opens that
platform in a new tab. Two platforms are in scope: Spotify and YouTube.

## 2. Why This Fits the Product

`PROJECT_MVP.md` already names linking out as the product's answer to
copyright: "用户可通过原始视频链接回到来源平台；产品不托管受版权保护的音视频内容",
and lists it as the mitigation for the audio-rights risk. Version 1 excludes
audio playback, lyrics, and audio hosting; an outbound link is none of those.
This feature extends an existing product principle rather than introducing a
new one.

## 3. What Exists Today

| Fact | Location |
| --- | --- |
| `songs` has no URL column of any kind | `packages/database/src/schema.ts`, migration `0000_fast_nemesis.sql` |
| `source_url` exists but belongs to `rankings`, describing the ranking's source video | `ENGINEERING_GUIDE.md:294`, `PROJECT_SPEC_EN.md:329` |
| `RankingDetail.sourceUrl` surfaces that ranking-level URL to the client | `ENGINEERING_GUIDE.md:413` |
| Song payloads are `{ id, title, artist, releaseYear }` everywhere | `apps/web/src/api.ts:1` |

So this is additive: a new table, a new payload field, and new UI. Nothing
existing needs to change shape, though every surface that renders a song row
gains an element.

## 4. Proposed Shape

**Data.** A `song_links` table rather than two columns on `songs`, because the
requirement is explicitly "one or more" and a column pair cannot grow to a
third platform without another migration.

```
song_links
  id            uuid primary key
  song_id       uuid not null references songs(id) on delete cascade
  platform      song_link_platform not null    -- enum: SPOTIFY, YOUTUBE
  url           text not null
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
```

**API.** Song payloads gain `links: Array<{ platform: 'SPOTIFY' | 'YOUTUBE'; url: string }>`.
This affects `/api/songs`, ranking entries, `/api/me/top-list`,
`/api/me/singing-list`, and both public list endpoints — every endpoint that
returns a song shape today.

**UI.** A small icon button per link, placed in the song row. `@mui/icons-material`
ships a `YouTube` icon; it has no Spotify icon, so Spotify needs an inline SVG.
Links open with `target="_blank"` and `rel="noopener noreferrer"`.

**Validation.** URLs are validated against an allowlist of hostnames per
platform (`open.spotify.com` for Spotify; `youtube.com`, `www.youtube.com`,
`youtu.be` for YouTube). Without this, the field is an open redirect that
renders as a trusted platform icon.

## 5. Surfaces Affected

| Surface | Change |
| --- | --- |
| `RankingPanel` | Row already holds two buttons (Add Top 10, Add Practice). Adding icons needs a layout decision at mobile width. |
| `TopListPanel` | Rows are drag-to-reorder; an added click target inside a drag handle area needs care. |
| `SingingListPanel` | Row already has an edit control and a status chip. |
| Public profile `/u/$username` | Links are song metadata, not personal data, so they are public. |
| Seed script | Demo songs need link data, or the feature ships invisible. |

## 6. Open Questions

These block approval; none has an obvious default.

1. **Where do links come from?** There is no admin tooling and the spec
   excludes it. Three options: seeded fixtures only (invisible for any song a
   user adds later), user-editable per song (but songs are global, shared
   records — one user's edit changes every user's view), or fetched from the
   platform APIs (new external dependency, new credentials).
2. **Multiple links per platform?** The table allows it. If not wanted, a
   unique constraint on `(song_id, platform)` should exist from the first
   migration. "One or more links" suggests yes; "two kinds" suggests one each.
3. **Whole row clickable, or icon only?** A clickable row conflicts with the
   existing action buttons and the drag handle in `TopListPanel`. Icon-only is
   safer but less discoverable.
4. **Spotify trademark.** Using the Spotify logo requires following their brand
   guidelines. Worth confirming before drawing the SVG.
5. **Songs with no links.** Render nothing, or a disabled placeholder that
   keeps the row heights aligned?

## 7. Rough Sequencing

Assuming the questions above resolve, the work splits into four reviewable
steps: migration and schema; API payload and validation; a `PlatformLinks`
component plus the three panels that host it; seed data and tests.

## 8. Not In Scope

Playback, embedded players, lyrics, platform search, OAuth to any platform,
and link health checking.

## 变更记录

| 日期 | 作者 | 变更 | Commit |
| --- | --- | --- | --- |
| 2026-09-11 | chance | 初稿：记录每首歌外链到 Spotify / YouTube 的需求、现状核查结果与待决问题 | — |
