import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory } from '@tanstack/react-router';
import { vi } from 'vitest';
import { createAppRouter } from '../router';

export function renderRoute({ path = '/', fetch }: { path?: string; fetch: (path: string, init?: RequestInit) => Promise<Response> }) {
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => fetch(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(client, createMemoryHistory({ initialEntries: [path] }));
  return { client, fetchMock, router };
}
