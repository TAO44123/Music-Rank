---
design_id: DESIGN-005
title: User-Defined Lists
status: Proposed
author: chance
created: 2026-09-11
updated: 2026-09-11
supersedes: null
related:
  - DESIGN_002_TAB_NAVIGATION.md
  - DESIGN_004_MOBILE_SHELL.md
  - AUTHENTICATION_DESIGN.md
  - ENGINEERING_GUIDE.md
---

# DESIGN-005 — User-Defined Lists

> **Status: Proposed, not approved.** This document captures a requested
> feature and the constraints found in the current codebase. Section 6 blocks
> approval. Section 4 conflicts with an already-approved design and must be
> settled before either proceeds.

## 1. Requested Behavior

A user keeps more than the two built-in lists. Two are created by default —
My Top 10 and Practice Library — and the user can add further lists afterwards.

## 2. Why This Is Not a Small Change

The two current lists are not two instances of one concept. They have
different shapes, different rules, and different tables:

| | `user_top_list_entries` | `singing_list_entries` |
| --- | --- | --- |
| Ordering | `position`, `CHECK position BETWEEN 1 AND 10` | none |
| Per-item data | none | `status` enum, `note` text |
| Capacity | hard cap of 10 | unbounded |
| Uniqueness | `(user_id, song_id)` | `(user_id, song_id)` |

Generalizing them into "a list" means deciding what a list *is*. An ordered
top-N and a status-tagged working set are different objects that happen to
both hold songs.

Three further places hard-code exactly two lists:

- `list_type` is a two-value enum (`TOP_LIST`, `SINGING_LIST`), and
  `user_list_settings` uses `(user_id, list_type)` as its primary key. Per-list
  visibility therefore cannot express a seventh list.
- The API paths `/api/me/top-list`, `/api/me/singing-list`,
  `/api/me/lists/:listType/visibility`, and both
  `/api/users/:username/*-list` endpoints name the two lists in the URL.
- Both uniqueness constraints are `(user_id, song_id)`, which must become
  `(list_id, song_id)` — the same song in two user lists is currently
  impossible to express within one list type and trivially possible across
  many.

## 3. Proposed Shape

```
user_lists
  id           uuid primary key
  user_id      uuid not null references users(id) on delete cascade
  name         text not null
  kind         list_kind not null      -- RANKED | TAGGED, see section 6.1
  visibility   list_visibility not null default 'PRIVATE'
  position     integer not null        -- user's own ordering of their lists
  capacity     integer                 -- null = unbounded; 10 for the default top list
  created_at   timestamptz not null default now()
  updated_at   timestamptz not null default now()

user_list_items
  id           uuid primary key
  list_id      uuid not null references user_lists(id) on delete cascade
  song_id      uuid not null references songs(id) on delete cascade
  position     integer                 -- null for TAGGED lists
  status       singing_status          -- null for RANKED lists
  note         text                    -- null for RANKED lists
  unique (list_id, song_id)
```

`user_list_settings` is absorbed into `user_lists.visibility` and dropped.
`list_type` survives only if something still needs to identify the two
defaults; otherwise it is dropped too.

## 4. Conflict With Approved Navigation

**This is the part to settle first.**

DESIGN-002 shipped a navigation bar with exactly three fixed destinations:
The Ranking, Personal Ranking, Practice Library. DESIGN-004 moves that bar to
the bottom of the screen on mobile, where platform conventions cap a bottom
navigation at roughly five items and expect a fixed set.

N user-defined lists cannot be top-level tabs. Something has to give:

| Option | Consequence |
| --- | --- |
| Collapse both personal lists into one "My Lists" destination holding an index, with each list as a detail page | Navigation stays at three fixed items and survives any number of lists. But it changes DESIGN-002's tab set and adds a tap to reach either default list. |
| Keep the two defaults as tabs, put custom lists somewhere else | Two classes of list with different reachability. The user's own list is harder to reach than the built-in one, which contradicts the point of the feature. |
| Let the tab bar grow | Breaks at four or five lists on mobile, and a scrollable bottom navigation is not a pattern any platform uses. |

The first option is the only one that scales, and it means **DESIGN-004 should
not be implemented with today's three-tab set until this is decided** —
otherwise the bottom navigation is built twice.

## 5. Surfaces Affected

| Surface | Change |
| --- | --- |
| Schema | Two new tables, one dropped, data migration for every existing user |
| API | Every personal-list endpoint is re-pathed around `:listId` |
| Public profile | `/u/:username` currently renders two known sections; it becomes a list of published lists |
| `TopListPanel` / `SingingListPanel` | Either generalized into one component parameterized by `kind`, or kept and joined by a third for user lists |
| Navigation | See section 4 |
| Seed | The demo fixture's lists must be created through the new model |

## 6. Open Questions

1. **What kinds of list exist?** If a user list can be either ranked or
   tagged, the creation flow must ask, and the UI needs both renderings. If
   every user list is a plain ordered collection, the two defaults stay
   special-cased and the generalization is partial.
2. **Is the 10-item cap a property of the list or of the product?** A
   `capacity` column makes it per-list and lets a user make a Top 20. Dropping
   the cap entirely changes what "Top 10" means.
3. **Can the defaults be renamed or deleted?** If yes, nothing can reference
   them by name or type, including the public profile. If no, they need a flag
   and the UI needs to explain why two lists behave differently.
4. **How many lists per user?** Unbounded invites abuse on a shared songs
   table; a cap needs a number and an error path.
5. **Do public list URLs need stable slugs?** `/u/:username` currently exposes
   two fixed sections. Named lists want `/u/:username/:slug`, which introduces
   slug generation, collisions, and renames breaking shared links.
6. **What happens to existing data?** Every current user's two lists must
   migrate into `user_lists` rows without losing positions, statuses, or notes.
   The migration is not reversible without keeping the old tables around.

## 7. Not In Scope

Sharing a list with specific people, collaborative lists, list templates,
importing from external services, and reordering songs across lists.

## 变更记录

| 日期 | 作者 | 变更 | Commit |
| --- | --- | --- | --- |
| 2026-09-11 | chance | 初稿：记录自定义歌单需求、两个列表结构不同的事实、与 DESIGN-002/004 导航形态的冲突，以及 6 个待决问题 | — |
