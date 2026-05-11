import { AreaChart } from '@mantine/charts';
import { Flex, Popover, Text, useComputedColorScheme, useMantineTheme } from '@mantine/core';
import { MonthPicker } from '@mantine/dates';
import { IconArrowsVertical, IconCaretDownFilled, IconClock, IconPageBreak } from '@tabler/icons-react';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  formatDate,
  isBefore,
  isSameDay,
  startOfMonth,
} from 'date-fns';
import { sum } from 'ramda';
import { JSX, useMemo, useState } from 'react';
import { AbsBook, useAbsSessions } from '../../api/audiobookshelf';
import { Statistics } from '../../components/statistics/statistics';
import { StatisticProps } from '../../components/statistics/statistic';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function AbsMonthStats({ absBooksByItemId = {} }: { absBooksByItemId?: Record<string, AbsBook> }): JSX.Element {
  const colorScheme = useComputedColorScheme();
  const { colors } = useMantineTheme();
  const { data: sessions = [] } = useAbsSessions();

  const [monthStart, setMonthStart] = useState<number>(
    startOfMonth(new Date()).getTime()
  );

  const monthEnd = useMemo(() => {
    const rawMonthEnd = endOfMonth(monthStart).getTime();
    const today = endOfDay(new Date()).getTime();
    return rawMonthEnd <= today ? rawMonthEnd : today;
  }, [monthStart]);

  const monthDaysPassed = useMemo(
    () => differenceInCalendarDays(monthEnd, monthStart) + 1,
    [monthStart, monthEnd]
  );

  const monthSessions = useMemo(() => {
    return sessions.filter((s) => s.startedAt >= monthStart && s.startedAt <= monthEnd);
  }, [sessions, monthStart, monthEnd]);

  const totalTime = useMemo(() => sum(monthSessions.map((s) => s.timeListening)), [monthSessions]);

  const estimatedPagesRead = useMemo(() => {
    if (!Object.keys(absBooksByItemId).length) return null;
    let pages = 0;
    let hasAny = false;
    for (const s of monthSessions) {
      const book = absBooksByItemId[s.libraryItemId];
      if (!book?.reference_pages || !book.duration) continue;
      hasAny = true;
      pages += s.timeListening * (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
    }
    return hasAny ? Math.round(pages) : null;
  }, [monthSessions, absBooksByItemId]);

  const estimatedAvgPagesPerDay = useMemo(() => {
    if (estimatedPagesRead === null) return null;
    return Math.round(estimatedPagesRead / monthDaysPassed);
  }, [estimatedPagesRead, monthDaysPassed]);

  const perDay = useMemo(() => {
    const result = [];
    let day = monthStart;
    while (isBefore(day, monthEnd)) {
      const daySessions = sessions.filter((s) => isSameDay(s.startedAt, day));
      result.push({
        day: format(day, 'dd MMM'),
        duration: sum(daySessions.map((s) => s.timeListening)),
      });
      day = addDays(day, 1).getTime();
    }
    return result;
  }, [sessions, monthStart, monthEnd]);

  const statsData = useMemo((): StatisticProps[] => {
    const base: StatisticProps[] = [
      {
        label: 'Listen time',
        value: formatSecondsToHumanReadable(totalTime),
        icon: IconClock,
      },
      {
        label: 'Average time per day',
        value: formatSecondsToHumanReadable(Math.round(totalTime / monthDaysPassed)),
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
  }, [totalTime, monthDaysPassed, estimatedPagesRead, estimatedAvgPagesPerDay]);

  return (
    <>
      <Popover position="bottom-start">
        <Popover.Target>
          <Flex align="center" mb="md" gap={4} style={{ cursor: 'pointer' }}>
            <Text c="violet.4" tt="uppercase" size="sm" fw={600}>
              {formatDate(monthStart, 'MMMM yyyy')}
            </Text>
            <IconCaretDownFilled size={16} color={colors.violet[6]} />
          </Flex>
        </Popover.Target>
        <Popover.Dropdown>
          <MonthPicker
            value={format(new Date(monthStart), 'yyyy-MM-dd')}
            maxDate={new Date()}
            onChange={(dateStr) => {
              if (!dateStr) return;
              const [y, m, d] = (dateStr as string).split('-').map(Number);
              setMonthStart(startOfMonth(new Date(y, m - 1, d)).getTime());
            }}
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
