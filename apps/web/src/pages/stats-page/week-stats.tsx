import { Book } from '@koinsight/common/types/book';
import { PageStat } from '@koinsight/common/types/page-stat';
import { AreaChart } from '@mantine/charts';
import { Flex, Popover, Text, useComputedColorScheme, useMantineTheme } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import {
  IconArrowsVertical,
  IconCaretDownFilled,
  IconClock,
  IconPageBreak,
} from '@tabler/icons-react';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  formatDate,
  isBefore,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { groupBy, sum } from 'ramda';
import { useMemo, useState } from 'react';
import { Statistics } from '../../components/statistics/statistics';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function WeekStats({
  stats,
  booksByMd5,
}: {
  stats: PageStat[];
  booksByMd5: Record<string, Book>;
}) {
  const colorScheme = useComputedColorScheme();
  const { colors } = useMantineTheme();

  const [weekStart, setWeekStart] = useState<number>(
    startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
  );

  const weekEnd = useMemo(() => {
    const rawWeekEnd = endOfDay(addDays(weekStart, 6)).getTime();
    const today = endOfDay(new Date()).getTime();
    return rawWeekEnd <= today ? rawWeekEnd : today;
  }, [weekStart]);

  const weekData = useMemo(() => {
    return stats?.filter(({ start_time }) => start_time >= weekStart && start_time <= weekEnd);
  }, [stats, weekStart, weekEnd]);

  const weekDaysPassed = useMemo(
    () => differenceInCalendarDays(weekEnd, weekStart) + 1,
    [weekStart, weekEnd]
  );

  const pagesRead = useMemo(
    () =>
      Math.round(
        weekData?.reduce((acc, stat) => {
          if (stat.total_pages && booksByMd5[stat.book_md5]?.reference_pages) {
            return acc + (1 / stat.total_pages) * booksByMd5[stat.book_md5].reference_pages!;
          } else {
            return acc + 1;
          }
        }, 0) ?? 0
      ),
    [weekData, booksByMd5]
  );

  const avgPagesPerDay = useMemo(() => {
    const statsPerDay = groupBy((stat: PageStat) =>
      startOfDay(stat.start_time).getTime().toString()
    )(weekData ?? []);

    const pagesPerDay = Object.values(statsPerDay).map(
      (dayStats) =>
        dayStats?.reduce((acc, stat) => {
          if (stat.total_pages && booksByMd5[stat.book_md5]?.reference_pages) {
            return acc + (1 / stat.total_pages) * booksByMd5[stat.book_md5].reference_pages!;
          } else {
            return acc + 1;
          }
        }, 0) ?? 0
    );

    if (pagesPerDay.length === 0) return 0;
    return Math.round(sum(pagesPerDay) / pagesPerDay.length);
  }, [weekData, booksByMd5]);

  const perDay = useMemo(() => {
    const perDayResult = [];

    let day = weekStart;
    while (isBefore(day, weekEnd)) {
      const dayStats = stats?.filter((stat) => isSameDay(stat.start_time, day)) ?? [];

      perDayResult.push({
        day: format(day, 'dd MMM yyyy'),
        duration: sum(dayStats.map((s) => s.duration)),
      });

      day = addDays(day, 1).getTime();
    }

    return perDayResult;
  }, [stats, weekStart, weekEnd]);

  return (
    <>
      <Popover position="bottom-start">
        <Popover.Target>
          <Flex align="center" mb="md" gap={4} style={{ cursor: 'pointer' }}>
            <Text c="koinsight.4" tt="uppercase" size="sm" fw={600}>
              {formatDate(weekStart, 'dd MMM')} - {formatDate(weekEnd, 'dd MMM')}
            </Text>
            <IconCaretDownFilled size={16} color={colors.koinsight[6]} />
          </Flex>
        </Popover.Target>
        <Popover.Dropdown>
          <DatePicker
            value={format(new Date(weekStart), 'yyyy-MM-dd')}
            maxDate={new Date()}
            onChange={(dateStr) => {
              if (!dateStr) return;
              const [y, m, d] = (dateStr as string).split('-').map(Number);
              const picked = new Date(y, m - 1, d);
              setWeekStart(startOfWeek(picked, { weekStartsOn: 1 }).getTime());
            }}
          />
        </Popover.Dropdown>
      </Popover>
      <Statistics
        data={[
          {
            label: 'Read time',
            value: formatSecondsToHumanReadable(sum(weekData?.map((stat) => stat.duration) ?? [])),
            icon: IconClock,
          },
          {
            label: 'Pages read',
            value: pagesRead,
            icon: IconPageBreak,
          },
          {
            label: 'Average pages per day',
            value: avgPagesPerDay,
            icon: IconArrowsVertical,
          },
          {
            label: 'Average time per day',
            value: formatSecondsToHumanReadable(
              Math.round(sum(weekData?.map((stat) => stat.duration) ?? []) / weekDaysPassed)
            ),
            icon: IconClock,
          },
        ]}
      />
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
            label: 'Reading time',
            color: colorScheme === 'dark' ? 'koinsight.3' : 'koinsight.7',
          },
        ]}
      />
    </>
  );
}
