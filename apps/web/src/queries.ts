import { queryOptions } from '@tanstack/react-query';
import { request, type AuthSession, type AuthUser, type GroupMember, type GroupSummary, type ListSettings, type PublicProfile, type PublicSingingListEntry, type Ranking, type RankingDetail, type SingingListEntry, type SingingStatus, type Song, type TopListEntry } from './api';

export const queryKeys = {
  session: ['auth-session'] as const,
  rankings: ['rankings'] as const,
  songs: ['songs'] as const,
  ranking: (slug: string, q: string, artist: string, releaseYear: number | 'ALL') => ['ranking', slug, q, artist, releaseYear] as const,
  personal: ['personal'] as const,
  groups: (userId: string) => ['personal', userId, 'groups'] as const,
  groupMembers: (userId: string, groupId: string) => ['personal', userId, 'groups', groupId, 'members'] as const,
  signedOut: (resource: string, detail?: string) => ['signed-out', resource, detail ?? 'all'] as const,
  topList: (userId: string) => ['personal', userId, 'top-list'] as const,
  singingList: (userId: string, status: string) => ['personal', userId, 'singing-list', status] as const,
  listSettings: (userId: string) => ['personal', userId, 'list-settings'] as const,
  publicProfile: (username: string) => ['public-profile', username] as const,
  publicTopList: (username: string) => ['public-profile', username, 'top-list'] as const,
  publicSingingList: (username: string) => ['public-profile', username, 'singing-list'] as const
};

export function getRankingPath(slug: string, query: string, artist: string, releaseYear: number | 'ALL') {
  const parameters = new URLSearchParams();
  if (query) parameters.set('q', query);
  if (artist !== 'ALL') parameters.set('artist', artist);
  if (releaseYear !== 'ALL') parameters.set('releaseYear', String(releaseYear));
  const queryString = parameters.toString();
  return `/api/rankings/${encodeURIComponent(slug)}${queryString ? `?${queryString}` : ''}`;
}

export const sessionQueryOptions = () => queryOptions({
  queryKey: queryKeys.session,
  queryFn: () => request<AuthSession>('/api/auth/session'),
  retry: false
});

export const rankingsQueryOptions = () => queryOptions({
  queryKey: queryKeys.rankings,
  queryFn: () => request<Ranking[]>('/api/rankings')
});

export const songsQueryOptions = () => queryOptions({
  queryKey: queryKeys.songs,
  queryFn: () => request<Song[]>('/api/songs')
});

export const rankingQueryOptions = (slug: string, query: string, artist: string, releaseYear: number | 'ALL') => queryOptions({
  queryKey: queryKeys.ranking(slug, query, artist, releaseYear),
  queryFn: () => request<RankingDetail>(getRankingPath(slug, query, artist, releaseYear))
});

export const topListQueryOptions = (user: AuthUser | null) => queryOptions({
  queryKey: user ? queryKeys.topList(user.id) : queryKeys.signedOut('top-list'),
  queryFn: ({ signal }) => request<TopListEntry[]>('/api/me/top-list', { signal }),
  enabled: Boolean(user),
  retry: false
});

export const singingListQueryOptions = (user: AuthUser | null, filter: SingingStatus | 'ALL') => queryOptions({
  queryKey: user ? queryKeys.singingList(user.id, filter) : queryKeys.signedOut('singing-list', filter),
  queryFn: ({ signal }) => request<SingingListEntry[]>(filter === 'ALL' ? '/api/me/singing-list' : `/api/me/singing-list?status=${filter}`, { signal }),
  enabled: Boolean(user),
  retry: false
});

export const listSettingsQueryOptions = (user: AuthUser | null) => queryOptions({
  queryKey: user ? queryKeys.listSettings(user.id) : queryKeys.signedOut('list-settings'),
  queryFn: ({ signal }) => request<ListSettings>('/api/me/list-settings', { signal }),
  enabled: Boolean(user),
  retry: false
});

export const publicProfileQueryOptions = (username: string, enabled = true) => queryOptions({
  queryKey: queryKeys.publicProfile(username),
  queryFn: () => request<PublicProfile>(`/api/users/${encodeURIComponent(username)}`),
  enabled,
  retry: false
});

export const defaultInvitationQueryOptions = () => queryOptions({
  queryKey: ['group-invitation', 'default'],
  queryFn: ({ signal }) => request<GroupSummary>('/api/group-invitations/default', { signal }),
  retry: false
});

export const groupsQueryOptions = (user: AuthUser | null) => queryOptions({
  queryKey: user ? queryKeys.groups(user.id) : queryKeys.signedOut('groups'),
  queryFn: ({ signal }) => request<GroupSummary[]>('/api/me/groups', { signal }),
  enabled: Boolean(user),
  retry: false
});

export const groupMembersQueryOptions = (user: AuthUser | null, groupId: string) => queryOptions({
  queryKey: user ? queryKeys.groupMembers(user.id, groupId) : queryKeys.signedOut('group-members'),
  queryFn: ({ signal }) => request<GroupMember[]>(`/api/me/groups/${groupId}/members`, { signal }),
  enabled: Boolean(user),
  retry: false
});

export const groupMemberProfileQueryOptions = (user: AuthUser | null, groupId: string | undefined, username: string) => queryOptions({
  queryKey: user ? ['personal', user.id, 'group-profile', groupId, username] : queryKeys.signedOut('group-profile', username),
  queryFn: ({ signal }) => request<PublicProfile>(`/api/me/groups/${groupId}/members/${encodeURIComponent(username)}`, { signal }),
  enabled: Boolean(user && groupId),
  retry: false
});

export const publicTopListQueryOptions = (username: string, enabled: boolean) => queryOptions({
  queryKey: queryKeys.publicTopList(username),
  queryFn: () => request<TopListEntry[]>(`/api/users/${encodeURIComponent(username)}/top-list`),
  enabled,
  retry: false
});

export const publicSingingListQueryOptions = (username: string, enabled: boolean) => queryOptions({
  queryKey: queryKeys.publicSingingList(username),
  queryFn: () => request<PublicSingingListEntry[]>(`/api/users/${encodeURIComponent(username)}/singing-list`),
  enabled,
  retry: false
});
