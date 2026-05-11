import { Book } from '@koinsight/common/types/book';
import { PageStat } from '@koinsight/common/types/page-stat';
import { AreaChart } from '@mantine/charts';
import { Flex, Popover, Text, useComputedColorScheme, useMantineTheme } from '@mantine/core';
import { MonthPicker } from '@mantine/dates';
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
  endOfMonth,
  format,
  formatDate,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { groupBy, sum } from 'ramda';
import { useMemo, useState } from 'react';
import { Statistics } from '../../components/statistics/statistics';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function MonthStats({
  stats,
  booksByMd5,
}: {
  stats: PageStat[];
  booksByMd5: Record<string, Book>;
}) {
  const colorScheme = useComputedColorScheme();
  const { colors } = useMantineTheme();

  const [monthStart, setMonthStart] = useState<number>(
    startOfMonth(new Date()).getTime()
  );

  const monthEnd = useMemo(() => {
    const rawMonthEnd = endOfMonth(monthStart).getTime();
    const today = endOfDay(new Date()).getTime();
    return rawMonthEnd <= today ? rawMonthEnd : today;
  }, [monthStart]);

  const monthData = useMemo(() => {
    return stats?.filter(({ start_time }) => start_time >= monthStart && start_time <= monthEnd);
  }, [stats, monthStart, monthEnd]);

  const monthDaysPassed = useMemo(
    () => differenceInCalendarDays(monthEnd, monthStart) + 1,
    [monthStart, monthEnd]
  );

  const pagesRead = useMemo(
    () =>
      Math.round(
        monthData?.reduce((acc, stat) => {
          if (stat.total_pages && booksByMd5[stat.book_md5]?.reference_pages) {
            return acc + (1 / stat.total_pages) * booksByMd5[stat.book_md5].reference_pages!;
          } else {
            return acc + 1;
          }
        }, 0) ?? 0
      ),
    [monthData, booksByMd5]
  );

  const avgPagesPerDay = useMemo(() => {
    const statsPerDay = groupBy((stat: PageStat) =>
      startOfDay(stat.start_time).getTime().toString()
    )(monthData ?? []);

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
  }, [monthData, booksByMd5]);

  const perDay = useMemo(() => {
    const result = [];
    let day = monthStart;
    while (isBefore(day, monthEnd)) {
      const dayStats = stats?.filter((stat) => isSameDay(stat.start_time, day)) ?? [];
      result.push({
        day: format(day, 'dd MMM'),
        duration: sum(dayStats.map((s) => s.duration)),
      });
      day = addDays(day, 1).getTime();
    }
    return result;
  }, [stats, monthStart, monthEnd]);

  return (
    <>
      <Popover position="bottom-start">
        <Popover.Target>
          <Flex align="center" mb="md" gap={4} style={{ cursor: 'pointer' }}>
            <Text c="koinsight.4" tt="uppercase" size="sm" fw={600}>
              {formatDate(monthStart, 'MMMM yyyy')}
            </Text>
            <IconCaretDownFilled size={16} color={colors.koinsight[6]} />
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
      <Statistics
        data={[
          {
            label: 'Read time',
            value: formatSecondsToHumanReadable(sum(monthData?.map((stat) => stat.duration) ?? [])),
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
              Math.round(sum(monthData?.map((stat) => stat.duration) ?? []) / monthDaysPassed)
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
