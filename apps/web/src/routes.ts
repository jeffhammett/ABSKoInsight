import { generatePath } from 'react-router';

export enum RoutePath {
  BOOKS = '/books',
  BOOK = '/books/:id',
  ABS_BOOK = '/abs-books/:id',
  CALENDAR = '/calendar/',
  STATS = '/stats/',
  SETTINGS = '/settings',

  HOME = BOOKS,
}

export function getBookPath(bookId: number | string): string {
  return generatePath(RoutePath.BOOK, { id: bookId.toString() });
}

export function getAbsBookPath(itemId: string): string {
  return generatePath(RoutePath.ABS_BOOK, { id: itemId });
}
