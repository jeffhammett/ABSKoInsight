import { PageStat } from '@koinsight/common/types/page-stat';

// Page stats less than this far apart (end of one to start of next) belong to the same
// reading session. Matches the clustering used on the book page's session list.
export const SESSION_GAP_MS = 30 * 60 * 1000;

// ABS listening sessions shorter than this are treated as accidental plays.
export const MIN_ABS_SESSION_SECONDS = 60;

/**
 * Drops KOReader reading sessions that only touched a single page — e.g. opening a book by
 * accident and closing it again. Stats are grouped into sessions per book; a gap of
 * SESSION_GAP_MS or more starts a new session. `start_time` must be in milliseconds.
 */
export function removeAccidentalSessions(stats: PageStat[]): PageStat[] {
  const byBook = new Map<string, PageStat[]>();
  for (const stat of stats) {
    const list = byBook.get(stat.book_md5);
    if (list) list.push(stat);
    else byBook.set(stat.book_md5, [stat]);
  }

  const kept: PageStat[] = [];
  for (const bookStats of byBook.values()) {
    const sorted = [...bookStats].sort((a, b) => a.start_time - b.start_time);
    let session: PageStat[] = [];
    let sessionEnd = -Infinity;

    const flush = () => {
      if (new Set(session.map((s) => s.page)).size > 1) kept.push(...session);
      session = [];
    };

    for (const stat of sorted) {
      if (session.length > 0 && stat.start_time - sessionEnd >= SESSION_GAP_MS) flush();
      session.push(stat);
      sessionEnd = Math.max(sessionEnd, stat.start_time + stat.duration * 1000);
    }
    flush();
  }

  return kept;
}

export function isAccidentalAbsSession(session: { timeListening?: number }): boolean {
  return (session.timeListening ?? 0) < MIN_ABS_SESSION_SECONDS;
}
