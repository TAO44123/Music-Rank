import { and, asc, eq } from 'drizzle-orm';
import { db, defaultGroupId, groupMemberships, groups, users } from '@music-rank/database';
import type { GroupMember, GroupSummary } from '@music-rank/contracts';
import { AppError } from './errors.js';
import { getListSettings } from './services.js';

const summary = { id: groups.id, name: groups.name, slug: groups.slug };

export async function getDefaultGroup(): Promise<GroupSummary> {
  const [group] = await db.select(summary).from(groups).where(eq(groups.id, defaultGroupId));
  if (!group) throw new AppError(404, 'GROUP_NOT_FOUND', 'Group not found');
  return group;
}

export async function joinDefaultGroup(userId: string): Promise<GroupSummary> {
  const group = await getDefaultGroup();
  await db.insert(groupMemberships).values({ groupId: group.id, userId }).onConflictDoNothing();
  return group;
}

export async function getMyGroups(userId: string): Promise<GroupSummary[]> {
  return db.select(summary).from(groups)
    .innerJoin(groupMemberships, eq(groupMemberships.groupId, groups.id))
    .where(eq(groupMemberships.userId, userId)).orderBy(asc(groups.name), asc(groups.id));
}

async function requireMembership(userId: string, groupId: string) {
  const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId));
  if (!group) throw new AppError(404, 'GROUP_NOT_FOUND', 'Group not found');
  const [membership] = await db.select({ userId: groupMemberships.userId }).from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)));
  if (!membership) throw new AppError(403, 'GROUP_MEMBERSHIP_REQUIRED', 'You are not a member of this group');
}

export async function getGroupMembers(userId: string, groupId: string): Promise<GroupMember[]> {
  await requireMembership(userId, groupId);
  const members = await db.select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(groupMemberships).innerJoin(users, eq(users.id, groupMemberships.userId))
    .where(eq(groupMemberships.groupId, groupId)).orderBy(asc(users.displayName), asc(users.username), asc(users.id));
  return members.filter((member): member is GroupMember => member.username !== null);
}

// Members can learn that another member has no public lists without turning
// the anonymous public-profile API into a directory of private accounts.
export async function getGroupMemberProfile(userId: string, groupId: string, username: string) {
  await requireMembership(userId, groupId);
  const [member] = await db.select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(groupMemberships).innerJoin(users, eq(users.id, groupMemberships.userId))
    .where(and(eq(groupMemberships.groupId, groupId), eq(users.username, username)));
  if (!member?.username) throw new AppError(404, 'GROUP_MEMBER_NOT_FOUND', 'Group member not found');
  return { username: member.username, displayName: member.displayName, lists: await getListSettings(member.id) };
}
