import { PageStat } from '@koinsight/common/types/page-stat';
import {
  isAccidentalAbsSession,
  removeAccidentalSessions,
  SESSION_GAP_MS,
} from './accidental-sessions';

const BASE = new Date('2026-01-01T10:00:00').getTime();
const MIN = 60 * 1000;

function stat(overrides: Partial<PageStat>): PageStat {
  return {
    book_md5: 'book-a',
    device_id: 'device',
    page: 1,
    start_time: BASE,
    duration: 30,
    total_pages: 100,
    ...overrides,
  };
}

describe(removeAccidentalSessions, () => {
  it('drops a session that only touched one page', () => {
    const stats = [stat({ page: 5, start_time: BASE, duration: 40 })];
    expect(removeAccidentalSessions(stats)).toEqual([]);
  });

  it('drops a single-page session even with several rows for that page', () => {
    const stats = [
      stat({ page: 5, start_time: BASE }),
      stat({ page: 5, start_time: BASE + 5 * MIN }),
    ];
    expect(removeAccidentalSessions(stats)).toEqual([]);
  });

  it('keeps a session that touched more than one page', () => {
    const stats = [
      stat({ page: 5, start_time: BASE, duration: 10 }),
      stat({ page: 6, start_time: BASE + 10_000, duration: 10 }),
    ];
    expect(removeAccidentalSessions(stats)).toHaveLength(2);
  });

  it('splits sessions on a 30 minute gap and only drops the single-page one', () => {
    const real = [
      stat({ page: 1, start_time: BASE }),
      stat({ page: 2, start_time: BASE + MIN }),
      stat({ page: 3, start_time: BASE + 2 * MIN }),
    ];
    const accidental = stat({ page: 3, start_time: BASE + 2 * MIN + 30_000 + SESSION_GAP_MS });

    const result = removeAccidentalSessions([...real, accidental]);
    expect(result).toEqual(real);
  });

  it('keeps stats less than 30 minutes apart in the same session', () => {
    const stats = [
      stat({ page: 1, start_time: BASE, duration: 30 }),
      stat({ page: 2, start_time: BASE + 30_000 + SESSION_GAP_MS - 1 }),
    ];
    expect(removeAccidentalSessions(stats)).toHaveLength(2);
  });

  it('groups sessions per book', () => {
    const stats = [
      stat({ book_md5: 'book-a', page: 1, start_time: BASE }),
      stat({ book_md5: 'book-b', page: 2, start_time: BASE + 10_000 }),
    ];
    // Interleaved in time, but each book only has one page, so both are accidental
    expect(removeAccidentalSessions(stats)).toEqual([]);
  });

  it('handles unsorted input', () => {
    const stats = [
      stat({ page: 2, start_time: BASE + MIN }),
      stat({ page: 1, start_time: BASE }),
    ];
    expect(removeAccidentalSessions(stats)).toHaveLength(2);
  });
});

describe(isAccidentalAbsSession, () => {
  it('flags sessions under 60 seconds', () => {
    expect(isAccidentalAbsSession({ timeListening: 0 })).toBe(true);
    expect(isAccidentalAbsSession({ timeListening: 59 })).toBe(true);
    expect(isAccidentalAbsSession({})).toBe(true);
  });

  it('keeps sessions of 60 seconds or more', () => {
    expect(isAccidentalAbsSession({ timeListening: 60 })).toBe(false);
    expect(isAccidentalAbsSession({ timeListening: 3600 })).toBe(false);
  });
});
