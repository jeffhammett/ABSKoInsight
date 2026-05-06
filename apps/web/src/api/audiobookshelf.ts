import useSWR from 'swr';
import { API_URL, fetchFromAPI } from './api';

export interface AbsBook {
  id: string;
  title: string;
  authors: string;
  series: string | null;
  duration: number;
  addedAt: number;
  progress: number;
  currentTime: number;
  listeningTime: number;
  isFinished: boolean;
  finishedAt: number | null;
  lastUpdate: number | null;
  source: 'audiobookshelf';
  hidden: boolean;
  deleted: boolean;
  completed: boolean;
  reference_pages?: number | null;
}

export interface AbsStats {
  totalTime: number;
  days: Record<string, number>;
  dayOfWeek: Record<string, number>;
  booksCount: number;
  recentSessions: AbsSession[];
}

export interface AbsSession {
  id: string;
  libraryItemId: string;
  displayTitle: string;
  displayAuthor: string;
  duration: number;
  timeListening: number;
  currentTime: number;
  date: string;
  dayOfWeek: string;
  startedAt: number;
  updatedAt: number;
  deviceDescription?: string;
}

interface AbsSessionsResponse {
  sessions: AbsSession[];
  truncated: boolean;
}

export function useAbsBooks({ showHidden } = { showHidden: false }) {
  return useSWR(
    ['abs-books', showHidden],
    () => fetchFromAPI<AbsBook[]>('audiobookshelf/books', 'GET', { showHidden }),
    {
      fallbackData: [],
      shouldRetryOnError: false,
    }
  );
}

export function useAbsBook(id: string) {
  return useSWR(
    id ? `abs-book-${id}` : null,
    () => fetchFromAPI<AbsBook>(`audiobookshelf/books/${id}`),
    { shouldRetryOnError: false }
  );
}

export function useAbsStats() {
  return useSWR('abs-stats', () => fetchFromAPI<AbsStats>('audiobookshelf/stats'), {
    shouldRetryOnError: false,
  });
}

export function useAbsSessions() {
  const { data, isLoading, error, mutate } = useSWR<AbsSessionsResponse>(
    'abs-sessions',
    () => fetchFromAPI<AbsSessionsResponse>('audiobookshelf/sessions'),
    {
      fallbackData: { sessions: [], truncated: false },
      shouldRetryOnError: false,
    }
  );
  return {
    data: data?.sessions ?? [],
    truncated: data?.truncated ?? false,
    isLoading,
    error,
    mutate,
  };
}

export async function updateAbsBook(
  id: string,
  data: { hidden?: boolean; deleted?: boolean; completed?: boolean; reference_pages?: number | null }
) {
  return fetchFromAPI<{ message: string }>(`audiobookshelf/books/${id}`, 'PATCH', data);
}

export function uploadAbsBookCover(itemId: string, formData: FormData) {
  return fetch(`${API_URL}/audiobookshelf/books/${itemId}/cover`, {
    method: 'POST',
    body: formData,
    headers: { Accept: 'multipart/form-data' },
  });
}

export async function verifyAbsConnection(abs_url: string, abs_api_key: string) {
  return fetchFromAPI<{ ok: boolean; message: string; username?: string }>(
    'audiobookshelf/verify',
    'POST',
    { abs_url, abs_api_key }
  );
}

export async function refreshAbsCache() {
  return fetchFromAPI<{ message: string }>('audiobookshelf/refresh', 'POST');
}
