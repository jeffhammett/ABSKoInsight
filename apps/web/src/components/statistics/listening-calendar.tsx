import { Flex } from '@mantine/core';
import { formatDate, startOfDay } from 'date-fns';
import { JSX, useMemo } from 'react';
import { formatSecondsToHumanReadable } from '../../utils/dates';
import { DayData, DotTrail } from '../dot-trail/dot-trail';

type ListeningCalendarProps = {
  absData: Record<string, number>;
  accentRgb?: string;
};

export function ListeningCalendar({ absData, accentRgb }: ListeningCalendarProps): JSX.Element {
  const percentPerDay: Record<number, DayData> = useMemo(() => {
    const timePerDay: Record<number, number> = {};

    for (const [dateStr, seconds] of Object.entries(absData)) {
      const [y, mo, d] = dateStr.split('-').map(Number);
      const day = startOfDay(new Date(y, mo - 1, d)).getTime();
      timePerDay[day] = (timePerDay[day] ?? 0) + seconds;
    }

    const maxTime = Math.max(...Object.values(timePerDay), 1);

    return Object.entries(timePerDay).reduce<Record<number, DayData>>((acc, [day, total]) => {
      const dayNum = Number(day);
      const dateLabel = formatDate(new Date(dayNum), 'dd MMM yyyy');
      const timeLabel = formatSecondsToHumanReadable(total);
      acc[dayNum] = {
        percent: Math.floor((total / maxTime) * 100),
        tooltip: <>{timeLabel} listened on {dateLabel}</>,
      };
      return acc;
    }, {});
  }, [absData]);

  return (
    <Flex style={{ width: '100%' }} justify="center" align="center">
      <DotTrail percentPerDay={percentPerDay} accentRgb={accentRgb} />
    </Flex>
  );
}
