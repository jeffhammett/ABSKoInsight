import { PageStat } from '@koinsight/common/types';
import { Box, Flex, Text } from '@mantine/core';
import { JSX } from 'react';
import { AbsSession } from '../../api/audiobookshelf';

const W = 100;
const BAR_W = 2.5;
const MAX_DURATION = 3600; // 1 hour = full height
const MIN_HEIGHT = 2;

type Session = { startTimeMs: number; durationSecs: number };

// Group consecutive page reads into sessions using a gap threshold.
// start_time from PageStat is in milliseconds (server multiplies DB seconds by 1000).
// duration stays in seconds — same unit as ABS timeListening, so bars are directly comparable.
function groupPageStatsIntoSessions(events: PageStat[], gapThresholdMs = 600_000): Session[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.start_time - b.start_time);
  const sessions: Session[] = [];
  let start = sorted[0].start_time;
  let duration = sorted[0].duration;
  let end = sorted[0].start_time + sorted[0].duration * 1000;
  for (let i = 1; i < sorted.length; i++) {
    const stat = sorted[i];
    if (stat.start_time - end <= gapThresholdMs) {
      duration += stat.duration;
      end = Math.max(end, stat.start_time + stat.duration * 1000);
    } else {
      sessions.push({ startTimeMs: start, durationSecs: duration });
      start = stat.start_time;
      duration = stat.duration;
      end = stat.start_time + stat.duration * 1000;
    }
  }
  sessions.push({ startTimeMs: start, durationSecs: duration });
  return sessions;
}

// Both ebook start_time (ms) and ABS startedAt (ms) go through here.
function timeOfDayMs(tsMs: number): number {
  const d = new Date(tsMs);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

type Props = {
  readingEvents: PageStat[];
  listeningEvents: AbsSession[];
  chartHeight?: number;
  showAxisLabels?: boolean;
};

const AXIS_LABEL_NAMES = ['12am', '6am', '12pm', '6pm', '12am'];

export function DayTimeline({
  readingEvents,
  listeningEvents,
  chartHeight,
  showAxisLabels = false,
}: Props): JSX.Element | null {
  const H = chartHeight ?? (showAxisLabels ? 260 : 20);
  const minH = showAxisLabels ? Math.max(H * 0.01, 2) : MIN_HEIGHT;

  const isEmpty = !readingEvents.length && !listeningEvents.length;
  if (isEmpty && !showAxisLabels) return null;

  const PADDING_TOP = showAxisLabels ? 4 : 0;

  const readingSessions = groupPageStatsIntoSessions(readingEvents);

  const bars: { x: number; h: number; color: string }[] = [
    ...readingSessions.map((s) => ({
      x: (timeOfDayMs(s.startTimeMs) / 86400) * W,
      h: Math.max(Math.min(s.durationSecs / MAX_DURATION, 1) * H, minH),
      color: 'var(--mantine-color-teal-6)',
    })),
    ...listeningEvents.map((s) => ({
      x: (timeOfDayMs(s.startedAt) / 86400) * W,
      h: Math.max(Math.min(s.timeListening / MAX_DURATION, 1) * H, minH),
      color: 'var(--mantine-color-violet-6)',
    })),
  ];

  if (showAxisLabels) {
    return (
      <Box>
        <svg
          viewBox={`0 0 ${W} ${PADDING_TOP + H}`}
          width="100%"
          height={PADDING_TOP + H}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
          aria-hidden
        >
          {bars.map((bar, i) => (
            <rect
              key={i}
              x={Math.min(bar.x, W - BAR_W)}
              y={PADDING_TOP + H - bar.h}
              width={BAR_W}
              height={bar.h}
              fill={bar.color}
              rx={0.5}
            />
          ))}
        </svg>
        <Flex
          justify="space-between"
          pt={4}
          style={{ borderTop: '1px solid var(--mantine-color-gray-4)' }}
        >
          {AXIS_LABEL_NAMES.map((label, i) => (
            <Text key={i} size="xs" c="dimmed">
              {label}
            </Text>
          ))}
        </Flex>
      </Box>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
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
