import { Flex } from '@mantine/core';
import { formatDate, startOfDay } from 'date-fns';
import { JSX, useMemo } from 'react';
import { usePageStats } from '../../api/use-page-stats';
import { formatSecondsToHumanReadable } from '../../utils/dates';
import { DayData, DotTrail } from '../dot-trail/dot-trail';

type ReadingCalendarProps = {
  absData?: Record<string, number>;
  showEbookData?: boolean;
};

export function ReadingCalendar({ absData, showEbookData = true }: ReadingCalendarProps): JSX.Element {
  const {
    data: { stats },
  } = usePageStats();

  const percentPerDay: Record<number, DayData> = useMemo(() => {
    const timePerDay: Record<number, { ebook: number; audio: number }> = {};

    if (showEbookData) {
      for (const stat of stats) {
        const day = startOfDay(stat.start_time).getTime();
        if (!timePerDay[day]) timePerDay[day] = { ebook: 0, audio: 0 };
        timePerDay[day].ebook += stat.duration;
      }
    }

    if (absData) {
      for (const [dateStr, seconds] of Object.entries(absData)) {
        const [y, mo, d] = dateStr.split('-').map(Number);
        const day = startOfDay(new Date(y, mo - 1, d)).getTime();
        if (!timePerDay[day]) timePerDay[day] = { ebook: 0, audio: 0 };
        timePerDay[day].audio += seconds;
      }
    }

    const maxTime = Math.max(...Object.values(timePerDay).map((v) => v.ebook + v.audio), 1);
    const hasBothSources = showEbookData && !!absData;

    return Object.entries(timePerDay).reduce<Record<number, DayData>>((acc, [day, times]) => {
      const total = times.ebook + times.audio;
      const dayNum = Number(day);
      const dateLabel = formatDate(new Date(dayNum), 'dd MMM yyyy');
      const timeLabel = formatSecondsToHumanReadable(total);

      acc[dayNum] = {
        percent: Math.floor((total / maxTime) * 100),
        tooltip: hasBothSources ? (
          <>{timeLabel} on {dateLabel}</>
        ) : !showEbookData ? (
          <>{timeLabel} listened on {dateLabel}</>
        ) : (
          <>{timeLabel} read on {dateLabel}</>
        ),
      };
      return acc;
    }, {});
  }, [stats, absData, showEbookData]);

  return (
    <Flex style={{ width: '100%' }} justify="center" align="center">
      <DotTrail percentPerDay={percentPerDay} />
    </Flex>
  );
}
