import type { RankingDecade as ContractRankingDecade, RankingRegionPath } from '@music-rank/contracts';
export type { GroupSummary, GroupMember } from '@music-rank/contracts';

export type Song = { id: string; title: string; artist: string; releaseYear: number | null };
export type RankingDecade = ContractRankingDecade;
export type RankingRegion = RankingRegionPath;
export type Ranking = { id: string; title: string; slug: string; era: string | null; decadeStart: number | null; decade: RankingDecade | null; region: RankingRegion | null; displayOrder: number; sourceType: string; description: string | null; hasSource: boolean };
export type RankingDetail = Ranking & { sourceUrl: string | null; songCount: number; facets: { artists: string[]; releaseYears: number[] }; entries: Array<Song & { rank: number }> };
export type TopListEntry = Song & { position: number };
export type SingingStatus = 'CAN_SING' | 'REGULARLY_SING' | 'PRACTICING' | 'WANT_TO_LEARN';
export type SingingListEntry = Song & { status: SingingStatus; note: string | null };
export type PublicSingingListEntry = Song & { status: SingingStatus };
export type AuthUser = { id: string; username: string; displayName: string };
export type AuthSession = { user: AuthUser | null };
export type ListVisibility = 'PRIVATE' | 'PUBLIC';
export type ListSettings = { topList: ListVisibility; singingList: ListVisibility };
export type PublicProfile = { username: string; displayName: string; lists: ListSettings };
export type ExistingSong = Pick<Song, 'id' | 'title' | 'artist'>;
export type AddSongToListInput = { songId: string } | { song: { title: string; artist: string } };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly data: Record<string, unknown> = {}) {
    super(message);
  }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...options?.headers }, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: 'REQUEST_FAILED', message: 'The request failed' })) as Record<string, unknown>;
    throw new ApiError(
      response.status,
      typeof body.code === 'string' ? body.code : 'REQUEST_FAILED',
      typeof body.message === 'string' ? body.message : 'The request failed',
      body
    );
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
