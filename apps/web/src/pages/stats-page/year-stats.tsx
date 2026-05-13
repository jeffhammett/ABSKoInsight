import { Book } from '@koinsight/common/types/book';
import { PageStat } from '@koinsight/common/types/page-stat';
import { AreaChart } from '@mantine/charts';
import { Flex, Popover, Text, useComputedColorScheme, useMantineTheme } from '@mantine/core';
import { YearPicker } from '@mantine/dates';
import {
  IconArrowsVertical,
  IconCaretDownFilled,
  IconClock,
  IconHeadphones,
  IconPageBreak,
} from '@tabler/icons-react';
import {
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  formatDate,
  isBefore,
  startOfDay,
  startOfYear,
} from 'date-fns';
import { groupBy, sum } from 'ramda';
import { useMemo, useState } from 'react';
import { AbsBook, AbsSession } from '../../api/audiobookshelf';
import { StatisticProps } from '../../components/statistics/statistic';
import { Statistics } from '../../components/statistics/statistics';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function YearStats({
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

  const [yearStart, setYearStart] = useState<number>(
    startOfYear(new Date()).getTime()
  );

  const yearEnd = useMemo(() => {
    const rawYearEnd = endOfYear(yearStart).getTime();
    const today = endOfDay(new Date()).getTime();
    return rawYearEnd <= today ? rawYearEnd : today;
  }, [yearStart]);

  const yearData = useMemo(() => {
    return stats?.filter(({ start_time }) => start_time >= yearStart && start_time <= yearEnd);
  }, [stats, yearStart, yearEnd]);

  const yearSessions = useMemo(() => {
    if (!combined) return [];
    return absSessions!.filter((s) => s.startedAt >= yearStart && s.startedAt <= yearEnd);
  }, [absSessions, yearStart, yearEnd, combined]);

  const yearDaysPassed = useMemo(
    () => differenceInCalendarDays(yearEnd, yearStart) + 1,
    [yearStart, yearEnd]
  );

  const ebookTotalTime = useMemo(() => sum(yearData?.map((s) => s.duration) ?? []), [yearData]);
  const absTotalTime = useMemo(() => sum(yearSessions.map((s) => s.timeListening)), [yearSessions]);

  const pagesRead = useMemo(
    () =>
      Math.round(
        yearData?.reduce((acc, stat) => {
          if (stat.total_pages && booksByMd5[stat.book_md5]?.reference_pages) {
            return acc + (1 / stat.total_pages) * booksByMd5[stat.book_md5].reference_pages!;
          } else {
            return acc + 1;
          }
        }, 0) ?? 0
      ),
    [yearData, booksByMd5]
  );

  const estimatedAbsPagesRead = useMemo(() => {
    if (!combined || !Object.keys(absBooksByItemId).length) return null;
    let pages = 0;
    let hasAny = false;
    for (const s of yearSessions) {
      const book = absBooksByItemId[s.libraryItemId];
      if (!book?.reference_pages || !book.duration) continue;
      hasAny = true;
      pages += s.timeListening * (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
    }
    return hasAny ? Math.round(pages) : null;
  }, [combined, yearSessions, absBooksByItemId]);

  const avgPagesPerDay = useMemo(() => {
    const statsPerDay = groupBy(
      (stat: PageStat) => startOfDay(stat.start_time).getTime().toString()
    )(yearData ?? []);

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
  }, [yearData, booksByMd5]);

  const perMonth = useMemo(() => {
    const result: Record<string, unknown>[] = [];
    let month = yearStart;
    while (isBefore(month, yearEnd)) {
      const mEnd = Math.min(endOfMonth(month).getTime(), yearEnd);
      const monthStats = stats?.filter(
        ({ start_time }) => start_time >= month && start_time <= mEnd
      ) ?? [];
      if (combined) {
        const monthSessions = absSessions!.filter(
          (s) => s.startedAt >= month && s.startedAt <= mEnd
        );
        result.push({
          month: format(month, 'MMM'),
          ebook: sum(monthStats.map((s) => s.duration)),
          audiobook: sum(monthSessions.map((s) => s.timeListening)),
        });
      } else {
        result.push({
          month: format(month, 'MMM'),
          duration: sum(monthStats.map((s) => s.duration)),
        });
      }
      month = addMonths(month, 1).getTime();
    }
    return result;
  }, [stats, absSessions, yearStart, yearEnd, combined]);

  const statsData = useMemo((): StatisticProps[] => {
    if (combined) {
      const combinedTime = ebookTotalTime + absTotalTime;
      return [
        { label: 'Read time', value: formatSecondsToHumanReadable(ebookTotalTime), icon: IconClock },
        { label: 'Listen time', value: formatSecondsToHumanReadable(absTotalTime), icon: IconHeadphones },
        { label: 'Combined pages', value: pagesRead + (estimatedAbsPagesRead ?? 0), icon: IconPageBreak },
        {
          label: 'Average time per day',
          value: formatSecondsToHumanReadable(Math.round(combinedTime / yearDaysPassed)),
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
        value: formatSecondsToHumanReadable(Math.round(ebookTotalTime / yearDaysPassed)),
        icon: IconClock,
      },
    ];
  }, [combined, ebookTotalTime, absTotalTime, pagesRead, estimatedAbsPagesRead, avgPagesPerDay, yearDaysPassed]);

  return (
    <>
      <Popover position="bottom-start">
        <Popover.Target>
          <Flex align="center" mb="md" gap={4} style={{ cursor: 'pointer' }}>
            <Text c="koinsight.4" tt="uppercase" size="sm" fw={600}>
              {formatDate(yearStart, 'yyyy')}
            </Text>
            <IconCaretDownFilled size={16} color={colors.koinsight[6]} />
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
