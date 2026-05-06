import { generatePath } from 'react-router';

export enum RoutePath {
  HOME = '/home',
  BOOKS = '/books',
  BOOK = '/books/:id',
  ABS_BOOK = '/abs-books/:id',
  SERIES_LIST = '/series',
  CALENDAR = '/calendar/',
  STATS = '/stats/',
  SETTINGS = '/settings',
  SERIES = '/series/:name',
}

export function getBookPath(bookId: number | string): string {
  return generatePath(RoutePath.BOOK, { id: bookId.toString() });
}

export function getAbsBookPath(itemId: string): string {
  return generatePath(RoutePath.ABS_BOOK, { id: itemId });
}

export function getSeriesPath(name: string): string {
  return generatePath(RoutePath.SERIES, { name: encodeURIComponent(name) });
}
