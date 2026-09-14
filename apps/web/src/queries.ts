import { queryOptions } from '@tanstack/react-query';
import { request, type AuthSession, type AuthUser, type ListSettings, type PublicProfile, type PublicSingingListEntry, type Ranking, type RankingDecade, type RankingDetail, type RankingRegion, type SingingListEntry, type SingingStatus, type Song, type TopListEntry } from './api';

export const queryKeys = {
  session: ['auth-session'] as const,
  rankings: ['rankings'] as const,
  songs: ['songs'] as const,
  ranking: (decade: RankingDecade, region: RankingRegion, q: string, artist: string, releaseYear: number | 'ALL') => ['ranking', decade, region, q, artist, releaseYear] as const,
  personal: ['personal'] as const,
  signedOut: (resource: string, detail?: string) => ['signed-out', resource, detail ?? 'all'] as const,
  topList: (userId: string) => ['personal', userId, 'top-list'] as const,
  singingList: (userId: string, status: string) => ['personal', userId, 'singing-list', status] as const,
  listSettings: (userId: string) => ['personal', userId, 'list-settings'] as const,
  publicProfile: (username: string) => ['public-profile', username] as const,
  publicTopList: (username: string) => ['public-profile', username, 'top-list'] as const,
  publicSingingList: (username: string) => ['public-profile', username, 'singing-list'] as const
};

export function getRankingPath(decade: RankingDecade, region: RankingRegion, query: string, artist: string, releaseYear: number | 'ALL') {
  const parameters = new URLSearchParams();
  if (query) parameters.set('q', query);
  if (artist !== 'ALL') parameters.set('artist', artist);
  if (releaseYear !== 'ALL') parameters.set('releaseYear', String(releaseYear));
  const queryString = parameters.toString();
  return `/api/rankings/${decade}/${region}${queryString ? `?${queryString}` : ''}`;
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

export const rankingQueryOptions = (decade: RankingDecade, region: RankingRegion, query: string, artist: string, releaseYear: number | 'ALL') => queryOptions({
  queryKey: queryKeys.ranking(decade, region, query, artist, releaseYear),
  queryFn: () => request<RankingDetail>(getRankingPath(decade, region, query, artist, releaseYear))
});

export const topListQueryOptions = (user: AuthUser | null) => queryOptions({
  queryKey: user ? queryKeys.topList(user.id) : queryKeys.signedOut('top-list'),
  queryFn: () => request<TopListEntry[]>('/api/me/top-list'),
  enabled: Boolean(user),
  retry: false
});

export const singingListQueryOptions = (user: AuthUser | null, filter: SingingStatus | 'ALL') => queryOptions({
  queryKey: user ? queryKeys.singingList(user.id, filter) : queryKeys.signedOut('singing-list', filter),
  queryFn: () => request<SingingListEntry[]>(filter === 'ALL' ? '/api/me/singing-list' : `/api/me/singing-list?status=${filter}`),
  enabled: Boolean(user),
  retry: false
});

export const listSettingsQueryOptions = (user: AuthUser | null) => queryOptions({
  queryKey: user ? queryKeys.listSettings(user.id) : queryKeys.signedOut('list-settings'),
  queryFn: () => request<ListSettings>('/api/me/list-settings'),
  enabled: Boolean(user),
  retry: false
});

export const publicProfileQueryOptions = (username: string) => queryOptions({
  queryKey: queryKeys.publicProfile(username),
  queryFn: () => request<PublicProfile>(`/api/users/${encodeURIComponent(username)}`),
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
