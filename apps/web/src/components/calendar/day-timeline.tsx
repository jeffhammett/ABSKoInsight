import { PageStat } from '@koinsight/common/types';
import { JSX } from 'react';
import { AbsSession } from '../../api/audiobookshelf';

const W = 100;
const H = 20;
const BAR_W = 2.5;
const MAX_DURATION = 3600; // 1 hour = full height
const MIN_HEIGHT = 2;
// start_time from PageStat arrives in milliseconds (server multiplies by 1000).
// duration stays in seconds. GAP_THRESHOLD is in ms.
const GAP_THRESHOLD_MS = 3600 * 1000; // 60 min

type Session = { startTimeMs: number; durationSecs: number };

function groupPageStats(events: PageStat[]): Session[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.start_time - b.start_time);
  const sessions: Session[] = [];
  let cur = {
    startMs: sorted[0].start_time,
    endMs: sorted[0].start_time + sorted[0].duration * 1000,
  };
  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i];
    const eEndMs = e.start_time + e.duration * 1000;
    if (e.start_time - cur.endMs < GAP_THRESHOLD_MS) {
      cur.endMs = Math.max(cur.endMs, eEndMs);
    } else {
      sessions.push({ startTimeMs: cur.startMs, durationSecs: (cur.endMs - cur.startMs) / 1000 });
      cur = { startMs: e.start_time, endMs: eEndMs };
    }
  }
  sessions.push({ startTimeMs: cur.startMs, durationSecs: (cur.endMs - cur.startMs) / 1000 });
  return sessions;
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

  const readingSessions = groupPageStats(readingEvents);

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
      style={{ display: 'block', marginTop: 6 }}
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
