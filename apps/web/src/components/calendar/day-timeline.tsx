import { PageStat } from '@koinsight/common/types';
import { JSX } from 'react';
import { AbsSession } from '../../api/audiobookshelf';

const W = 100;
const H = 20;
const BAR_W = 2.5;
const MAX_DURATION = 3600; // 1 hour = full height
const MIN_HEIGHT = 2;

type Session = { startTimeMs: number; durationSecs: number };

// Group by book: one bar per book, at the first read of the day, height = sum of page durations.
// start_time from PageStat is in milliseconds (server multiplies DB seconds by 1000).
// duration stays in seconds — same unit as ABS timeListening, so bars are directly comparable.
function groupPageStatsByBook(events: PageStat[]): Session[] {
  const byBook = new Map<string, Session>();
  for (const e of events) {
    const existing = byBook.get(e.book_md5);
    if (!existing) {
      byBook.set(e.book_md5, { startTimeMs: e.start_time, durationSecs: e.duration });
    } else {
      if (e.start_time < existing.startTimeMs) existing.startTimeMs = e.start_time;
      existing.durationSecs += e.duration;
    }
  }
  return Array.from(byBook.values());
}

// Both ebook start_time (ms) and ABS startedAt (ms) go through here.
function timeOfDayMs(tsMs: number): number {
  const d = new Date(tsMs);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function barH(durationSecs: number): number {
  return Math.max(Math.min(durationSecs / MAX_DURATION, 1) * H, MIN_HEIGHT);
}

type Props = {
  readingEvents: PageStat[];
  listeningEvents: AbsSession[];
};

export function DayTimeline({ readingEvents, listeningEvents }: Props): JSX.Element | null {
  if (!readingEvents.length && !listeningEvents.length) return null;

  const readingSessions = groupPageStatsByBook(readingEvents);

  const bars: { x: number; h: number; color: string }[] = [
    ...readingSessions.map((s) => ({
      x: (timeOfDayMs(s.startTimeMs) / 86400) * W,
      h: barH(s.durationSecs),
      color: 'var(--mantine-color-teal-6)',
    })),
    ...listeningEvents.map((s) => ({
      x: (timeOfDayMs(s.startedAt) / 86400) * W,
      h: barH(s.timeListening),
      color: 'var(--mantine-color-violet-6)',
    })),
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ display: 'block', marginTop: 'auto' }}
      aria-hidden
    >
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={Math.min(bar.x, W - BAR_W)}
          y={H - bar.h}
          width={BAR_W}
          height={bar.h}
          fill={bar.color}
          rx={0.5}
        />
      ))}
    </svg>
  );
}
