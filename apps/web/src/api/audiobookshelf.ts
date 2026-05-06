import useSWR from 'swr';
import { fetchFromAPI } from './api';

export interface AbsBook {
  id: string;
  title: string;
  authors: string;
  duration: number;
  addedAt: number;
  progress: number;
  currentTime: number;
  isFinished: boolean;
  finishedAt: number | null;
  lastUpdate: number | null;
  source: 'audiobookshelf';
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
}

export function useAbsBooks() {
  return useSWR('abs-books', () => fetchFromAPI<AbsBook[]>('audiobookshelf/books'), {
    fallbackData: [],
    shouldRetryOnError: false,
  });
}

export function useAbsStats() {
  return useSWR('abs-stats', () => fetchFromAPI<AbsStats>('audiobookshelf/stats'), {
    shouldRetryOnError: false,
  });
}

export function useAbsSessions() {
  return useSWR('abs-sessions', () => fetchFromAPI<AbsSession[]>('audiobookshelf/sessions'), {
    fallbackData: [],
    shouldRetryOnError: false,
  });
}
