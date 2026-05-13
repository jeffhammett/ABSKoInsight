import { Book } from '@koinsight/common/types/book';
import { PageStat } from '@koinsight/common/types/page-stat';
import { AreaChart } from '@mantine/charts';
import { Flex, Popover, Text, useComputedColorScheme, useMantineTheme } from '@mantine/core';
import { MonthPicker } from '@mantine/dates';
import {
  IconArrowsVertical,
  IconCaretDownFilled,
  IconClock,
  IconHeadphones,
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
import { AbsBook, AbsSession } from '../../api/audiobookshelf';
import { StatisticProps } from '../../components/statistics/statistic';
import { Statistics } from '../../components/statistics/statistics';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function MonthStats({
  stats,
  booksByMd5,
  absSessions,
  absBooksByItemId = {},
}: {
  stats: PageStat[];
  booksByMd5: Record<string, Book>;
  absSessions?: AbsSession[];
  absBooksByItemId?: Record<string, AbsBook>;
}) {
  const combined = absSessions !== undefined;
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

  const monthSessions = useMemo(() => {
    if (!combined) return [];
    return absSessions!.filter((s) => s.startedAt >= monthStart && s.startedAt <= monthEnd);
  }, [absSessions, monthStart, monthEnd, combined]);

  const monthDaysPassed = useMemo(
    () => differenceInCalendarDays(monthEnd, monthStart) + 1,
    [monthStart, monthEnd]
  );

  const ebookTotalTime = useMemo(() => sum(monthData?.map((s) => s.duration) ?? []), [monthData]);
  const absTotalTime = useMemo(() => sum(monthSessions.map((s) => s.timeListening)), [monthSessions]);

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

  const estimatedAbsPagesRead = useMemo(() => {
    if (!combined || !Object.keys(absBooksByItemId).length) return null;
    let pages = 0;
    let hasAny = false;
    for (const s of monthSessions) {
      const book = absBooksByItemId[s.libraryItemId];
      if (!book?.reference_pages || !book.duration) continue;
      hasAny = true;
      pages += s.timeListening * (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
    }
    return hasAny ? Math.round(pages) : null;
  }, [combined, monthSessions, absBooksByItemId]);

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
    const result: Record<string, unknown>[] = [];
    let day = monthStart;
    while (isBefore(day, monthEnd)) {
      const dayStats = stats?.filter((stat) => isSameDay(stat.start_time, day)) ?? [];
      if (combined) {
        const daySessions = absSessions!.filter((s) => isSameDay(s.startedAt, day));
        result.push({
          day: format(day, 'dd MMM'),
          ebook: sum(dayStats.map((s) => s.duration)),
          audiobook: sum(daySessions.map((s) => s.timeListening)),
        });
      } else {
        result.push({
          day: format(day, 'dd MMM'),
          duration: sum(dayStats.map((s) => s.duration)),
        });
      }
      day = addDays(day, 1).getTime();
    }
    return result;
  }, [stats, absSessions, monthStart, monthEnd, combined]);

  const statsData = useMemo((): StatisticProps[] => {
    if (combined) {
      const combinedTime = ebookTotalTime + absTotalTime;
      return [
        { label: 'Read time', value: formatSecondsToHumanReadable(ebookTotalTime), icon: IconClock },
        { label: 'Listen time', value: formatSecondsToHumanReadable(absTotalTime), icon: IconHeadphones },
        { label: 'Combined pages', value: pagesRead + (estimatedAbsPagesRead ?? 0), icon: IconPageBreak },
        {
          label: 'Average time per day',
          value: formatSecondsToHumanReadable(Math.round(combinedTime / monthDaysPassed)),
          icon: IconClock,
        },
      ];
    }
    return [
      { label: 'Read time', value: formatSecondsToHumanReadable(ebookTotalTime), icon: IconClock },
      { label: 'Pages read', value: pagesRead, icon: IconPageBreak },
      { label: 'Average pages per day', value: avgPagesPerDay, icon: IconArrowsVertical },
      {
        label: 'Average time per day',
        value: formatSecondsToHumanReadable(Math.round(ebookTotalTime / monthDaysPassed)),
        icon: IconClock,
      },
    ];
  }, [combined, ebookTotalTime, absTotalTime, pagesRead, estimatedAbsPagesRead, avgPagesPerDay, monthDaysPassed]);

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
      <Statistics data={statsData} />
      <AreaChart
        h={300}
        mt="sm"
        data={perDay}
        dataKey="day"
        gridAxis="none"
        withYAxis={false}
        type={combined ? 'default' : 'stacked'}
        valueFormatter={(value) => value === 0 ? '0 minutes' : formatSecondsToHumanReadable(value)}
        curveType="monotone"
        series={
          combined
            ? [
                {
                  name: 'ebook',
                  label: 'Reading time',
                  color: colorScheme === 'dark' ? 'koinsight.3' : 'koinsight.7',
                },
                {
                  name: 'audiobook',
                  label: 'Listening time',
                  color: colorScheme === 'dark' ? 'violet.3' : 'violet.7',
                },
              ]
            : [
                {
                  name: 'duration',
                  label: 'Reading time',
                  color: colorScheme === 'dark' ? 'koinsight.3' : 'koinsight.7',
                },
              ]
        }
      />
    </>
  );
}
