---
design_id: DESIGN-009
title: Personal List Item Reactions
status: Implemented and locally verified
created: 2026-09-19
updated: 2026-09-19
related:
  - DESIGN_007_DEFAULT_GROUP.md
  - DESIGN_008_USERNAME_ONLY_TRANSITION.md
  - AUTHENTICATION_DESIGN.md
  - SESSION_HANDOFF.md
---

# DESIGN-009 — Personal List Item Reactions

## 1. Purpose and Status

Allow people viewing a personal song list to react to each concrete list item.
My Top 10 uses a Like reaction represented by a thumbs-up icon. Practice
Library uses a Cheer reaction represented by the locally adapted
outlined/filled party-popper icon. Counts are visible without exposing a roster
of reactors.

The user approved the product decisions in this document on 2026-09-19, then
explicitly authorized implementation. The feature is implemented in the current
working tree based on `main` at `3110600`. It includes migration `0007`, shared
contracts, server authorization and projections, responsive controls on every
supported list surface, and automated coverage. On 2026-09-19, the user
authorized committing the complete implementation and pushing it to
`origin/main`. No deployment was requested.

## 2. Reaction Identity

A reaction belongs to one concrete personal-list entry, not to the global song.
The target identity includes the list owner, list type, and song through that
specific entry.

- A song in two different users' Top 10 lists has independent Like counts.
- A song in one user's Top 10 and Practice Library has independent reactions.
- Top 10 entries support only `LIKE`.
- Practice Library entries support only `CHEER`.
- One account contributes at most one reaction to one target entry.
- The owner may react to their own entries, including entries in a Private list.
- Repeating the action toggles the current account's reaction on or off.

Reaction types are fixed by list type in this feature. Users do not choose among
multiple emoji or reaction types.

## 3. Visibility and Authorization

### 3.1 Public lists

- Anyone, including an anonymous visitor, may see the aggregate reaction count
  on a Public list entry.
- Any authenticated account may add or remove its own reaction on a Public list
  entry, including the list owner.
- Anonymous visitors cannot create or remove reactions.
- The server must re-check the target entry and current list visibility on every
  write. A previously loaded Public page is not authorization.

### 3.2 Private lists

- Only the list owner may see and react to entries in their Private list.
- Existing reactions remain stored when a list changes from Public to Private.
- Non-owners cannot read the Private list, its counts, or their prior reaction
  state, and cannot add or remove a reaction while it is Private.
- The owner may continue to see the retained count and add or remove their own
  reaction through authenticated owner views.
- If the list becomes Public again, the retained count and authenticated
  viewers' prior reaction state become visible again.

This feature must preserve the existing fail-closed visibility rules. It must
not create a count endpoint that reveals whether a Private list or entry exists.

### 3.3 Future group visibility

`GROUP` visibility does not exist in the current product and its reaction rules
are deliberately deferred. Future work must authorize both reads and writes
against current group membership rather than assuming that authentication or a
hidden page is sufficient. This design does not decide whether reactions from
former members remain counted after membership or visibility changes.

## 4. Lifecycle

- Top 10 reordering does not change the entry's Likes.
- Practice status and note edits do not change the entry's Cheers.
- Changing Public/Private visibility does not delete reactions.
- Removing a song from a list permanently deletes every reaction attached to
  that list entry.
- Adding the same song again later creates a new entry with a zero count.
- Deleting a reacting account should remove its reaction records with the
  account when account deletion is introduced.

The list-entry deletion and reaction deletion must be one consistent database
operation. A failed delete must not leave orphaned reactions or partially remove
the list entry.

## 5. Stored Data and Privacy

Each reaction record retains enough information to identify:

- the reacting internal user;
- the exact target list entry;
- the reaction type implied by that list;
- the creation time.

The storage layer must enforce the one-reaction-per-account-and-entry rule. If a
reaction is removed and later re-added, the new record receives a new creation
time.

The current feature exposes only:

- the aggregate count for a visible entry; and
- whether the current authenticated viewer has reacted.

It does not expose user IDs, usernames, display names, timestamps, or a reactor
roster through the API or UI. Reactor identity is retained in the database so a
future, separately designed feature can add an appropriately authorized roster.

The username-only transition remains an important limitation: a stored reactor
identifies the Music Rank account used for the action, but it does not prove
real-world account ownership. A future people list or social feature must
revisit this limitation alongside stronger authentication.

## 6. Surfaces

Show the appropriate reaction control everywhere the corresponding list entry
is rendered and the viewer is allowed to see it:

- another user's public `/u/:username` profile;
- a member profile opened from Default Group;
- the owner's normal profile, including Private lists;
- the owner's `?view=public` preview for lists that are Public;
- the authenticated `/personal` editing page;
- the authenticated `/practice` editing page.

Ranking rows and global song-search results do not receive reactions. Reactions
belong only to personal-list entries.

All surfaces showing the same entry must show the same count and selected state.
A successful toggle must refresh or update every cached representation of that
entry so owner, public-preview, group-origin, and editing views do not disagree.

## 7. Interaction and Presentation

### 7.1 Top 10 Like

- Use a thumbs-up icon without a visible `Like` text label.
- Use the outlined icon when the viewer has not liked the entry.
- Use the filled, emphasized icon when the viewer has liked the entry.
- Tooltip text is `Like` or `Remove like`, matching the current state.

### 7.2 Practice Library Cheer

- Use the locally adapted party-popper icon without a visible `Cheer` text
  label.
- Use the outlined icon when the viewer has not cheered the entry.
- Use the filled, emphasized icon when the viewer has cheered the entry.
- Tooltip text is `Cheer` or `Remove cheer`, matching the current state.

### 7.3 Counts and feedback

- A zero count is not painted; the button contains only the icon.
- A positive exact integer appears to the right of the icon inside the same
  button. Do not abbreviate it as `99+`, `1K`, or similar text.
- Accessible names include the action, selected state, and current count even
  when zero is not visually painted.
- Tooltips work on mouse hover, keyboard focus, and supported touch/long-press
  interaction.
- A successful action shows local Snackbar feedback: `Liked`, `Cheered`,
  `Like removed`, or `Cheer removed`.
- Snackbar feedback is local UI confirmation, not a notification to the owner.

On read-only profile rows, place the reaction control at the row end. On
`/personal`, keep it in the action area but visually separate it from reorder
and remove controls. On `/practice`, place Cheer immediately to the left of the
displayed practice status while keeping edit/delete controls distinct. At
narrow widths, Like and Cheer remain on the same row as the song text; only the
remaining reorder/edit/delete/status controls move below when necessary. Notes
occupy their own row so they cannot run underneath the reaction control.

## 8. Authentication Continuation

An anonymous visitor sees Public counts and the same reaction icons. Selecting
one opens the existing login/registration dialog but performs no reaction.

- Preserve the current profile URL and username through authentication.
- Successful login or registration returns to the same page.
- Registration retains its existing transactional Default Group membership and
  Public-list initialization behavior.
- Do not automatically replay the attempted reaction after authentication.
- The newly authenticated user must deliberately select the icon again.
- Closing or failing authentication leaves reaction data unchanged.

This continuation is scoped to the page that opened the dialog. It must not
change ordinary authentication destinations elsewhere in the application.

## 9. Concurrent Changes and Errors

The server is authoritative. It must reject a reaction when the entry was
deleted or became inaccessible after the page loaded. The client then refreshes
the affected list and reports `This list item is no longer available.` rather
than leaving an optimistic count or selected state on screen.

Disable repeated submission while one toggle for the same entry is pending.
Database uniqueness remains the final protection against duplicate reactions
from concurrent requests. A failed request must restore the last confirmed
count and selected state.

## 10. Explicitly Out of Scope

- Reactor names, profiles, timestamps, or a people-list API/UI.
- Notifications to list owners or reactors.
- Sorting, filtering, or ranking by reaction count.
- Per-profile, per-song, or application-wide reaction totals.
- Trending, popularity, recommendation, feed, or activity history features.
- Reactions on public ranking entries or global catalog search results.
- Additional emoji, downvotes, comments, or free-form reactions.
- Group-only visibility behavior.
- Changes to username-only authentication or proof of account ownership.

## 11. Acceptance Criteria

1. Every visible personal-list entry uses the reaction assigned to its list
   type, with consistent count and viewer state across all supported surfaces.
2. Anonymous visitors can read Public counts but cannot mutate them; selecting
   an icon opens authentication and never auto-reacts after success.
3. Authenticated users can toggle one reaction per Public entry, including their
   own, while only owners can react to their Private entries.
4. Zero counts are visually omitted; positive counts are exact and remain inside
   the icon button. Icon state, Tooltip, accessible name, and Snackbar feedback
   communicate the action without a permanent text label.
5. Visibility changes retain reactions. Reordering, status changes, and note
   changes retain reactions. Removing the list entry deletes them, and re-adding
   the song starts at zero.
6. Backend authorization prevents stale pages or direct requests from reacting
   to deleted, Private, or otherwise inaccessible entries.
7. Responses expose aggregate counts and current-viewer state only. No current
   API or UI exposes the stored reactor identities or timestamps.
8. No notification, popularity, aggregation, ranking-reaction, or group-level
   feature is introduced.

## 12. Implementation Record

- `top_list_entry_reactions` and `singing_list_entry_reactions` store the exact
  list-entry ID, reacting user ID, and creation time. Composite primary keys
  enforce one reaction per account and entry; both foreign keys cascade.
- Personal and public list projections return `reactionCount` and
  `viewerHasReacted`. Public reads resolve an optional Session, expose no
  reactor roster, and use `Cache-Control: no-store` because viewer state is
  personalized.
- Authenticated `PUT` and `DELETE` reaction endpoints are idempotent state
  setters. Their transactions lock the visibility setting for non-owners and
  the target entry before writing; stale, deleted, or newly inaccessible
  targets return `404 LIST_ITEM_NOT_AVAILABLE` with the approved message.
- `ListReactionButton` provides the icon, exact count, Tooltip, selected state,
  and accessible name. `useListReaction` owns authentication continuation,
  writes, cache invalidation, pending state, Snackbar feedback, and stale-item
  recovery. Public-list query keys include the viewer ID or `anonymous` so
  selected state cannot leak across account changes.
- The registration flow keeps an anonymous visitor on the current profile and
  never replays the attempted reaction; the user must select the icon again.
- Cheer uses the locally adapted outlined/filled party-popper SVG pair. Both
  use `currentColor`; the selected state therefore follows the same theme color
  behavior as Like. Mobile rows keep the reaction beside the song, with Cheer
  preceding the status label on wider rows. Practice notes occupy their own row
  so they cannot run under the reaction control.
- Local acceptance passed on 2026-09-19: `npm run typecheck`, 128 workspace
  tests (API 34, Web 76, Config 8, Database 10), the production build exercised
  by Playwright, and all 7 Playwright cases. Migration `0007` was applied
  successfully to the local development database, and the complete 8-migration
  chain was verified from empty in an isolated database that was then removed.
- After the icon and responsive-layout refinement, Web typecheck and related
  component/route tests passed. The responsive Playwright case passed at 320,
  375, 414, 600, and 900 px widths.
