import { AreaChart } from '@mantine/charts';
import { Flex, Popover, Text, useComputedColorScheme, useMantineTheme } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconArrowsVertical, IconCaretDownFilled, IconClock, IconPageBreak } from '@tabler/icons-react';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  format,
  formatDate,
  isBefore,
  isSameDay,
  startOfWeek,
} from 'date-fns';
import { sum } from 'ramda';
import { JSX, useMemo, useState } from 'react';
import { AbsBook, useAbsSessions } from '../../api/audiobookshelf';
import { Statistics } from '../../components/statistics/statistics';
import { StatisticProps } from '../../components/statistics/statistic';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function AbsWeekStats({ absBooksByItemId = {} }: { absBooksByItemId?: Record<string, AbsBook> }): JSX.Element {
  const colorScheme = useComputedColorScheme();
  const { colors } = useMantineTheme();
  const { data: sessions = [] } = useAbsSessions();

  const [weekStart, setWeekStart] = useState<number>(
    startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
  );

  const weekEnd = useMemo(() => {
    const rawWeekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }).getTime();
    const today = endOfDay(new Date()).getTime();
    return rawWeekEnd <= today ? rawWeekEnd : today;
  }, [weekStart]);

  const weekDaysPassed = useMemo(
    () => differenceInCalendarDays(weekEnd, weekStart) + 1,
    [weekStart, weekEnd]
  );

  const weekSessions = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 }).getTime();
    return sessions.filter((s) => s.startedAt >= start && s.startedAt <= weekEnd);
  }, [sessions, weekStart, weekEnd]);

  const totalTime = useMemo(() => sum(weekSessions.map((s) => s.timeListening)), [weekSessions]);

  const estimatedPagesRead = useMemo(() => {
    if (!Object.keys(absBooksByItemId).length) return null;
    let pages = 0;
    let hasAny = false;
    for (const s of weekSessions) {
      const book = absBooksByItemId[s.libraryItemId];
      if (!book?.reference_pages || !book.duration) continue;
      hasAny = true;
      pages += s.timeListening * (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
    }
    return hasAny ? Math.round(pages) : null;
  }, [weekSessions, absBooksByItemId]);

  const estimatedAvgPagesPerDay = useMemo(() => {
    if (estimatedPagesRead === null) return null;
    return Math.round(estimatedPagesRead / weekDaysPassed);
  }, [estimatedPagesRead, weekDaysPassed]);

  const perDay = useMemo(() => {
    const result = [];
    let day = weekStart;
    while (isBefore(day, weekEnd)) {
      const daySessions = sessions.filter((s) => isSameDay(s.startedAt, day));
      result.push({
        day: format(day, 'dd MMM yyyy'),
        duration: sum(daySessions.map((s) => s.timeListening)),
      });
      day = addDays(day, 1).getTime();
    }
    return result;
  }, [sessions, weekStart, weekEnd]);

  const statsData = useMemo((): StatisticProps[] => {
    const base: StatisticProps[] = [
      {
        label: 'Listen time',
        value: formatSecondsToHumanReadable(totalTime),
        icon: IconClock,
      },
      {
        label: 'Average time per day',
        value: formatSecondsToHumanReadable(Math.round(totalTime / weekDaysPassed)),
        icon: IconClock,
      },
    ];
    if (estimatedPagesRead !== null) {
      base.push(
        { label: 'Estimated pages read', value: estimatedPagesRead, icon: IconPageBreak },
        { label: 'Estimated avg pages/day', value: estimatedAvgPagesPerDay ?? 0, icon: IconArrowsVertical }
      );
    }
    return base;
  }, [totalTime, weekDaysPassed, estimatedPagesRead, estimatedAvgPagesPerDay]);

  return (
    <>
      <Popover position="bottom-start">
        <Popover.Target>
          <Flex align="center" mb="md" gap={4} style={{ cursor: 'pointer' }}>
            <Text c="violet.4" tt="uppercase" size="sm" fw={600}>
              {formatDate(weekStart, 'dd MMM')} - {formatDate(weekEnd, 'dd MMM')}
            </Text>
            <IconCaretDownFilled size={16} color={colors.violet[6]} />
          </Flex>
        </Popover.Target>
        <Popover.Dropdown>
          <DatePicker
            value={new Date(weekStart)}
            maxDate={endOfWeek(new Date(), { weekStartsOn: 1 })}
            onChange={(date) =>
              date && setWeekStart(startOfWeek(date, { weekStartsOn: 1 }).getTime())
            }
          />
        </Popover.Dropdown>
      </Popover>
      <Statistics data={statsData} />
      <AreaChart
        h={300}
        mt="sm"
        data={perDay}
        dataKey="day"
        gridAxis="none"
        withYAxis={false}
        type="stacked"
        valueFormatter={(value) => formatSecondsToHumanReadable(value)}
        curveType="monotone"
        series={[
          {
            name: 'duration',
            label: 'Listening time',
            color: colorScheme === 'dark' ? 'violet.3' : 'violet.7',
          },
        ]}
      />
    </>
  );
}
