import { AreaChart } from '@mantine/charts';
import { Flex, Popover, Text, useComputedColorScheme, useMantineTheme } from '@mantine/core';
import { YearPicker } from '@mantine/dates';
import { IconArrowsVertical, IconCaretDownFilled, IconClock, IconPageBreak } from '@tabler/icons-react';
import {
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  formatDate,
  isBefore,
  startOfYear,
} from 'date-fns';
import { sum } from 'ramda';
import { JSX, useMemo, useState } from 'react';
import { AbsBook, useAbsSessions } from '../../api/audiobookshelf';
import { Statistics } from '../../components/statistics/statistics';
import { StatisticProps } from '../../components/statistics/statistic';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function AbsYearStats({ absBooksByItemId = {} }: { absBooksByItemId?: Record<string, AbsBook> }): JSX.Element {
  const colorScheme = useComputedColorScheme();
  const { colors } = useMantineTheme();
  const { data: sessions = [] } = useAbsSessions();

  const [yearStart, setYearStart] = useState<number>(
    startOfYear(new Date()).getTime()
  );

  const yearEnd = useMemo(() => {
    const rawYearEnd = endOfYear(yearStart).getTime();
    const today = endOfDay(new Date()).getTime();
    return rawYearEnd <= today ? rawYearEnd : today;
  }, [yearStart]);

  const yearDaysPassed = useMemo(
    () => differenceInCalendarDays(yearEnd, yearStart) + 1,
    [yearStart, yearEnd]
  );

  const yearSessions = useMemo(() => {
    return sessions.filter((s) => s.startedAt >= yearStart && s.startedAt <= yearEnd);
  }, [sessions, yearStart, yearEnd]);

  const totalTime = useMemo(() => sum(yearSessions.map((s) => s.timeListening)), [yearSessions]);

  const estimatedPagesRead = useMemo(() => {
    if (!Object.keys(absBooksByItemId).length) return null;
    let pages = 0;
    let hasAny = false;
    for (const s of yearSessions) {
      const book = absBooksByItemId[s.libraryItemId];
      if (!book?.reference_pages || !book.duration) continue;
      hasAny = true;
      pages += s.timeListening * (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
    }
    return hasAny ? Math.round(pages) : null;
  }, [yearSessions, absBooksByItemId]);

  const estimatedAvgPagesPerDay = useMemo(() => {
    if (estimatedPagesRead === null) return null;
    return Math.round(estimatedPagesRead / yearDaysPassed);
  }, [estimatedPagesRead, yearDaysPassed]);

  const perMonth = useMemo(() => {
    const result = [];
    let month = yearStart;
    while (isBefore(month, yearEnd)) {
      const mEnd = Math.min(endOfMonth(month).getTime(), yearEnd);
      const monthSessions = sessions.filter(
        (s) => s.startedAt >= month && s.startedAt <= mEnd
      );
      result.push({
        month: format(month, 'MMM'),
        duration: sum(monthSessions.map((s) => s.timeListening)),
      });
      month = addMonths(month, 1).getTime();
    }
    return result;
  }, [sessions, yearStart, yearEnd]);

  const statsData = useMemo((): StatisticProps[] => {
    const base: StatisticProps[] = [
      {
        label: 'Listen time',
        value: formatSecondsToHumanReadable(totalTime),
        icon: IconClock,
      },
      {
        label: 'Average time per day',
        value: formatSecondsToHumanReadable(Math.round(totalTime / yearDaysPassed)),
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
  }, [totalTime, yearDaysPassed, estimatedPagesRead, estimatedAvgPagesPerDay]);

  return (
    <>
      <Popover position="bottom-start">
        <Popover.Target>
          <Flex align="center" mb="md" gap={4} style={{ cursor: 'pointer' }}>
            <Text c="violet.4" tt="uppercase" size="sm" fw={600}>
              {formatDate(yearStart, 'yyyy')}
            </Text>
            <IconCaretDownFilled size={16} color={colors.violet[6]} />
          </Flex>
        </Popover.Target>
        <Popover.Dropdown>
          <YearPicker
            value={format(new Date(yearStart), 'yyyy-MM-dd')}
            maxDate={new Date()}
            onChange={(dateStr) => {
              if (!dateStr) return;
              const [y, m, d] = (dateStr as string).split('-').map(Number);
              setYearStart(startOfYear(new Date(y, m - 1, d)).getTime());
            }}
          />
        </Popover.Dropdown>
      </Popover>
      <Statistics data={statsData} />
      <AreaChart
        h={300}
        mt="sm"
        data={perMonth}
        dataKey="month"
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
