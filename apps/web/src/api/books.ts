import { Book, BookWithData } from '@koinsight/common/types';
import useSWR from 'swr';
import { API_URL, fetchFromAPI } from './api';

export function useBooks({ showHidden } = { showHidden: false }) {
  return useSWR(
    ['books', showHidden],
    () => fetchFromAPI<BookWithData[]>('books', 'GET', { showHidden }),
    {
      fallbackData: [],
    }
  );
}

export async function deleteBook(id: Book['id']) {
  return fetchFromAPI<{ message: string }>(`books/${id}`, 'DELETE');
}

export async function mergeBooks(targetId: Book['id'], sourceId: Book['id']) {
  return fetchFromAPI<{ message: string }>(`books/${targetId}/merge`, 'POST', { sourceId });
}

export async function hideBook(id: Book['id']) {
  return fetchFromAPI<{ message: string }>(`books/${id}/hide`, 'PUT', { hidden: true });
}

export async function showBook(id: Book['id']) {
  return fetchFromAPI<{ message: string }>(`books/${id}/hide`, 'PUT', { hidden: false });
}

export async function completeBook(id: Book['id'], completed: boolean) {
  return fetchFromAPI<{ message: string }>(`books/${id}/complete`, 'PUT', { completed });
}

export async function updateBookSeries(id: Book['id'], series: string | null) {
  return fetchFromAPI<{ message: string }>(`books/${id}/series`, 'PUT', { series });
}

export async function updateBookReferencePages(id: Book['id'], referencePages: number | null) {
  return fetchFromAPI<Book>(`books/${id}/reference_pages`, 'PUT', {
    reference_pages: referencePages,
  });
}

export function uploadBookCover(bookId: Book['id'], formData: FormData) {
  return fetch(`${API_URL}/books/${bookId}/cover`, {
    method: 'POST',
    body: formData,
    headers: { Accept: 'multipart/form-data' },
  });
}
