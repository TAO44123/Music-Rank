export type Song = { id: string; title: string; artist: string; releaseYear: number | null };
export type Ranking = { id: string; title: string; era: string | null; sourceType: string; description: string | null };
export type RankingDetail = Ranking & { sourceUrl: string | null; entries: Array<Song & { rank: number }> };
export type TopListEntry = Song & { position: number };
export type SingingStatus = 'CAN_SING' | 'REGULARLY_SING' | 'PRACTICING' | 'WANT_TO_LEARN';
export type SingingListEntry = Song & { status: SingingStatus; note: string | null };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...options?.headers }, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: 'REQUEST_FAILED', message: 'The request failed' }));
    throw new ApiError(response.status, body.code, body.message);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
