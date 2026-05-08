import { PageStat } from '@koinsight/common/types';
import { JSX } from 'react';
import { AbsSession } from '../../api/audiobookshelf';

const W = 100;
const H = 20;
const BAR_W = 2.5;
const MAX_DURATION = 3600; // 1 hour = full height
const MIN_HEIGHT = 2;
const GAP_THRESHOLD = 3600; // 60 min gap splits sessions

type Session = { startTime: number; duration: number };

function groupPageStats(events: PageStat[]): Session[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.start_time - b.start_time);
  const sessions: Session[] = [];
  let cur = {
    startTime: sorted[0].start_time,
    endTime: sorted[0].start_time + sorted[0].duration,
  };
  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.start_time - cur.endTime < GAP_THRESHOLD) {
      cur.endTime = Math.max(cur.endTime, e.start_time + e.duration);
    } else {
      sessions.push({ startTime: cur.startTime, duration: cur.endTime - cur.startTime });
      cur = { startTime: e.start_time, endTime: e.start_time + e.duration };
    }
  }
  sessions.push({ startTime: cur.startTime, duration: cur.endTime - cur.startTime });
  return sessions;
}

function timeOfDaySecs(tsSeconds: number): number {
  const d = new Date(tsSeconds * 1000);
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
      x: (timeOfDaySecs(s.startTime) / 86400) * W,
      h: barH(s.duration),
      color: 'var(--mantine-color-teal-6)',
    })),
    ...listeningEvents.map((s) => ({
      x: (timeOfDaySecs(s.startedAt / 1000) / 86400) * W,
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
