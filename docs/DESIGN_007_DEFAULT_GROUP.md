---
design_id: DESIGN-007
title: Default Group and Invitation Onboarding
status: Implemented and verified; local commits 7053051 and 83ab826
created: 2026-09-17
updated: 2026-09-17
related:
  - PLAN_007_DEFAULT_GROUP.md
  - AUTHENTICATION_DESIGN.md
  - DESIGN_004_MOBILE_BOTTOM_NAV.md
  - SESSION_HANDOFF.md
---

# DESIGN-007 — Default Group and Invitation Onboarding

## 1. Purpose and Status

Introduce one shared default group where members can discover each other's
public Top 10 and Practice Library. A shared invitation URL carries visitors
through registration or login and into the group.

The user approved the behavior below and subsequently authorized implementation.
The feature is implemented on `codex/default-group`, based on `83b24f3`,
and saved locally as `7053051` plus refinement commit `83ab826`.
The user authorized a local Git commit. GitHub push, merge, and deployment
have not been requested or performed.

The user confirmed `Default Group` as the formal display name and `Groups` as
a new primary-navigation destination on both the desktop top bar and the
mobile bottom bar. Product decisions for this planning scope are resolved.

## 2. Approved Scope

- There is one default group in this release.
- New accounts automatically join it during successful registration, including
  registration through the ordinary application entry point.
- Existing accounts do not automatically join on ordinary login.
- In the user's existing local test data, TTT starts as a member; AAA remains
  outside the group to test invitation-based joining.
- A valid invitation adds an authenticated nonmember and opens the group page.
- A current member opening the invitation goes directly to the group page.
- Every logged-in user can share the same fixed invitation URL. There is no
  inviter attribution, expiration, rotation, approval, or join quota.
- The group page exposes its complete member list to authenticated members.
- A logged-in nonmember sees that they have not joined any groups, with no
  join button and no member list.
- Clicking a member opens their public personal-list view, with a route back
  to the group.
- A member without public lists remains visible in the member list. Their
  profile view explains that they have not made any lists public.

Invitation-only admission is not a global rule: ordinary new registrations
still join automatically. The user's possible future invitation-only rule is
deferred.

## 3. Registration, Login, and Invitation Behavior

| Entry and account state | Membership outcome | Destination |
| --- | --- | --- |
| Ordinary registration | Join the default group automatically | Home (`/`, resolving to the default published ranking) |
| Ordinary login, already a member | Preserve membership | Preserve existing ordinary login behavior; no group redirect |
| Ordinary login, not a member (including AAA) | Remain a nonmember | Preserve existing ordinary login behavior; login from home stays on home |
| Invitation, no account | Register and automatically join | Group page |
| Invitation, existing account but logged out | Log in, then join if needed | Group page |
| Invitation, authenticated nonmember | Automatically join | Group page |
| Invitation, authenticated member | Preserve the existing membership | Group page |
| Group page, authenticated nonmember | Do not join | Empty state: not currently in any groups; no join button |

An anonymous invitation visitor sees the group introduction and a login or
registration entry, without the member list. They can switch between login
and registration without losing the invitation. Refreshing the invitation page
also preserves the flow. Closing authentication does not create membership.

Registration failures create neither an account nor membership. A failed login
does not join the group. If authentication succeeds but an invitation join
request fails, retain the authenticated session, show a recoverable error, and
permit retry without registering again. Only navigate to the group after
membership is established or confirmed.

The automatic join requires no extra confirmation. Opening an invitation as a
logged-in user waits for session resolution before attempting to join. A
session lookup error must not be mistaken for an anonymous visitor.

## 4. List Visibility and Member Discovery

Keep exactly the existing `PRIVATE` and `PUBLIC` values, independently applied
to Top 10 and Practice Library. Both default to public for newly registered users. Existing stored visibility is preserved; missing legacy settings remain private.

| Visibility | Who can read the list |
| --- | --- |
| Private | Its owner only |
| Public | Anyone with the profile URL, including logged-out visitors |

Membership does not reveal a private list, publish a list, or grant access to
private Practice Library notes. Existing anonymous public links remain valid.
Public here does not mean group-only visibility.

The new member directory makes public lists discoverable by fellow members.
This is an intentional addition to the current URL-only discovery model; it
does not introduce anonymous user browsing, user search, or a public directory.

The member list shows display name and username. Users with private lists
remain members. Member payloads contain no credentials, session information,
private list contents, or private notes.

Currently `/u/:username` reports a missing public profile when both lists are
private. The group-origin view must distinguish the known member's lack of
public lists from a loading failure. Reuse the existing safe public-list
projections; do not fetch private lists to construct the empty state.

## 5. Page and Sharing Behavior

The group page shows the approved display name, member count, member list,
and a share-invitation action. It has explicit loading, error, member, and
nonmember states. The invitation page introduces the group and explains that
successful login or registration will join it automatically.

Add `Groups` to the desktop top navigation and mobile bottom navigation.
Authenticated users now have four primary destinations: Ranking, Personal,
Practice, and Groups. Preserve the existing 600px breakpoint, narrow-width
usability from 320px, content clearance, and Snackbar clearance.

The implementation reuses existing guarded-destination behavior for
anonymous visitors: hide Groups in the desktop top bar, and show a sign-in
button in the mobile bar that does not change the URL or join the group.
Ordinary sign-in from navigation must not be treated as an invitation.

The user refined sharing after the local feature commit: both public-list
sharing and group invitations now always open a centered in-app dialog with a
dimmed backdrop. The dialog displays a read-only selectable URL and a Copy
button beside it. The list hint is “Copy the link to share this list.”; the
invitation hint is “Copy the link to invite friends to Default Group.”

Opening the dialog does not copy anything. Copy uses the asynchronous clipboard
API where available, then selection-based copying for HTTP or permission
failure. Success is explicitly reported; if neither method works, retain the
selected link and explain manual copying. No native share sheet is invoked.
HTTPS deployment is not part of this refinement. Links and visibility rules
remain unchanged.

## 6. Implementation

The following describes the implementation. See PLAN-007 for validation and
the implementation sequence.

- Persist a group and its membership relationships, with a stable internal
  default-group identity and a unique `(groupId, userId)` membership key.
- Do not add owners, roles, or a general-purpose invitation-token system for
  this fixed, open default-group invitation.
- Routes: `/groups` for the group view and `/invite/default` for the
  shared invitation. `/u/:username` remains the public profile path.
- Serve invitation metadata without authentication, but require a real session
  for membership writes and a membership check for member-list reads.
- Join through an authenticated POST with existing Origin validation. GETs,
  route preloads, and link-preview requests do not insert memberships.
- Make joins idempotent, including concurrent requests and repeat invitations.
- Add registration membership in the existing account-creation transaction;
  ordinary login never performs a membership backfill.
- Use user-scoped query keys for group membership and member data. Clear them
  on logout or authentication failure with the existing private-cache cleanup.
- Preserve invitation intent in the invitation route across authentication and
  refresh. Do not support arbitrary external return URLs.
- Generate invitation URLs from the browser's current public origin; do not
  embed an EC2 IP, localhost address, or deployment-specific host in code.

Default-group initialization must be idempotent. Do not create the group as
a side effect of every read, or depend on a developer's ignored configuration.
Migration `0005_bizarre_the_stranger.sql` creates the two tables and inserts
`Default Group` with the stable ID exported by `packages/database/src/groups.ts`.
Migration `0006_panoramic_machine_man.sql` changes new list-setting defaults
to PUBLIC without updating existing visibility. Registration explicitly creates
both public settings. Missing legacy settings remain private.
Normal seed does not add existing accounts. A member-only profile endpoint
returns safe identity and visibility flags, including for members with both
lists private. Actual list contents still use the existing public endpoints.

## 7. Existing Data and Test Setup

TTT and AAA are user-selected existing local test accounts, not special types
of user. Resolve the actual normalized usernames and IDs before setting up
their data. Add TTT's membership idempotently; preserve AAA's absence.

Do not encode these names in application services, login behavior, SQL schema
migrations, or public Demo seed rules. Use an explicit, narrowly scoped local
setup operation. It must not change either user's credentials, lists, list
visibility, or songs, and must not delete an unexpected existing membership.

Do not broadly backfill all existing users. The credential-free Demo remains
untouched; it is not a registered login account. Automated tests use isolated
fixtures and dynamic accounts rather than TTT or AAA.

The implementation session confirmed the development target as local PostgreSQL,
added TTT idempotently, and verified AAA still has no membership. Existing
account, credential, session, list, visibility, and catalog data were preserved.
This does not authorize changes to the EC2 or production database.

## 8. Acceptance Criteria

1. Ordinary registration creates exactly one default-group membership and
   finishes on home; ordinary login does not add a nonmember.
2. All three invitation authentication states finish on the group page without
   duplicate memberships; refresh and authentication-mode changes retain intent.
3. Authenticated nonmembers see the approved empty state without a join button
   or member data; anonymous visitors cannot read the member list.
4. Members can see all members and open their public lists, including the
   no-public-lists case, then return to the group.
5. Anonymous public-profile access still works. Private lists and all practice
   notes remain inaccessible to other users.
6. List and invitation sharing open the in-app link dialog, copy only on an
   explicit button press, and handle absent/rejected clipboard APIs with
   selection-based copying or a clear manual-copy explanation.
7. Logout and session expiration remove protected group data from the client.
8. Existing rankings, Demo data, personal-list behavior, authentication, and
   desktop/mobile layout remain intact.

## 9. Deferred Work

- User-created groups and membership in multiple independently managed groups.
- Member exit, removal, group dissolution, ownership, transfer, and admin roles.
- Per-group visibility, selected-group sharing, and other list visibility levels.
- Invitation-only admission, expiring or resettable invitations, attribution,
  approval, member limits, and blocking re-entry after removal.
- Arbitrary user-created lists, group playlists, feeds, chat, and notifications.
- Global user search or an anonymous public member directory.

These items are future design topics, not authorized implementation tasks.

## 10. Confirmed Presentation Decisions

| Decision | State |
| --- | --- |
| Formal group display name | User confirmed `Default Group` |
| Group navigation placement | User confirmed a new `Groups` primary-navigation item on desktop and mobile |
