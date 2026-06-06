import { Book, PerDayOfTheWeek, PerMonthReadingTime } from '@koinsight/common/types';
import { BarChart } from '@mantine/charts';
import {
  Box,
  Flex,
  Loader,
  Text,
  Title,
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { IconClock, IconHeadphones, IconMaximize, IconPageBreak } from '@tabler/icons-react';
import { format, getDay, parse, startOfDay, subDays } from 'date-fns';
import { JSX, useMemo } from 'react';
import { BarProps } from 'recharts';
import { useAbsBooks, useAbsSessions, useAbsStats } from '../../api/audiobookshelf';
import { useBooks } from '../../api/books';
import { usePageStats } from '../../api/use-page-stats';
import { CustomBar } from '../../components/charts/custom-bar';
import {
  DataSourceToggle,
  useDataSource,
} from '../../components/data-source-toggle/data-source-toggle';
import { ListeningCalendar } from '../../components/statistics/listening-calendar';
import { ReadingCalendar } from '../../components/statistics/reading-calendar';
import { Statistics } from '../../components/statistics/statistics';
import { formatSecondsToHumanReadable } from '../../utils/dates';
import { AbsMonthStats } from './abs-month-stats';
import { AbsWeekStats } from './abs-week-stats';
import { AbsYearStats } from './abs-year-stats';
import { DayStats } from './day-stats';
import { MonthStats } from './month-stats';
import { WeekStats } from './week-stats';
import { YearStats } from './year-stats';

const DAY_ORDER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function absMonthlyToMap(absDays: Record<string, number>): Record<string, number> {
  const monthly: Record<string, number> = {};
  for (const [dateStr, seconds] of Object.entries(absDays)) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const monthKey = format(new Date(y, mo - 1, d), 'MMMM yyyy');
    monthly[monthKey] = (monthly[monthKey] ?? 0) + seconds;
  }
  return monthly;
}

function mergeMonthly(
  koMonthly: PerMonthReadingTime[],
  absMonthlyMap: Record<string, number>
): Array<{ month: string; date: number; ebook: number; audiobook: number }> {
  const result: Array<{ month: string; date: number; ebook: number; audiobook: number }> =
    koMonthly.map((m) => ({
      month: m.month,
      date: m.date,
      ebook: m.duration,
      audiobook: absMonthlyMap[m.month] ?? 0,
    }));

  for (const [month, duration] of Object.entries(absMonthlyMap)) {
    if (!result.find((m) => m.month === month)) {
      const date = parse(month, 'MMMM yyyy', new Date()).getTime();
      result.push({ month, date, ebook: 0, audiobook: duration });
    }
  }

  return result.sort((a, b) => a.date - b.date);
}

function mergeWeekdays(
  koDow: PerDayOfTheWeek[],
  absDow: Record<string, number>
): Array<{ name: string; ebook: number; audiobook: number; day: number }> {
  const result: Array<{ name: string; ebook: number; audiobook: number; day: number }> =
    koDow.map((d) => ({
      name: d.name,
      day: d.day,
      ebook: d.value,
      audiobook: absDow[d.name] ?? 0,
    }));

  for (const [name, seconds] of Object.entries(absDow)) {
    if (!result.find((d) => d.name === name)) {
      result.push({ name, day: DAY_ORDER[name] ?? 0, ebook: 0, audiobook: seconds });
    }
  }

  return result.sort((a, b) => a.day - b.day);
}

export function StatsPage(): JSX.Element {
  const colorScheme = useComputedColorScheme();
  const { colors } = useMantineTheme();
  const [dataSource, setDataSource] = useDataSource('stats');

  const showEbooks = dataSource === 'ebook' || dataSource === 'both';
  const showAudiobooks = dataSource === 'audiobook' || dataSource === 'both';

  const { data: books, isLoading: booksLoading } = useBooks();
  const { data: absBooks = [] } = useAbsBooks();
  const {
    data: {
      stats,
      perMonth,
      perDayOfTheWeek,
      mostPagesInADay,
      totalReadingTime,
      longestDay,
      last7DaysReadTime,
      totalPagesRead,
    },
    isLoading: statsLoading,
  } = usePageStats();

  const { data: absStats, isLoading: absLoading } = useAbsStats();
  const { data: absSessions = [], isLoading: absSessionsLoading } = useAbsSessions();

  const booksByMd5 = useMemo(() => {
    return books?.reduce(
      (acc, book) => {
        acc[book.md5] = book;
        return acc;
      },
      {} as Record<string, Book>
    );
  }, [books]);

  // Re-derive ebook per-month in the browser using local time — same reason as per-day-of-week below.
  // Server-computed perMonth uses UTC, shifting sessions near month boundaries into the wrong month.
  const ebookPerMonth = useMemo((): PerMonthReadingTime[] => {
    const map = new Map<string, { duration: number; date: number }>();
    for (const s of stats) {
      const month = format(new Date(s.start_time), 'MMMM yyyy');
      const existing = map.get(month);
      if (existing) {
        existing.duration += s.duration;
      } else {
        map.set(month, { duration: s.duration, date: s.start_time });
      }
    }
    return Array.from(map.entries())
      .map(([month, { duration, date }]) => ({ month, duration, date }))
      .sort((a, b) => a.date - b.date);
  }, [stats]);

  // Re-derive ebook per-day-of-week in the browser using local time, so it matches the
  // calendar view. The server-computed perDayOfTheWeek uses UTC, which shifts sessions
  // near midnight into the wrong day for users in non-UTC timezones.
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ebookPerDayOfTheWeek = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const s of stats) {
      const name = DAY_NAMES[getDay(new Date(s.start_time))];
      totals[name] = (totals[name] ?? 0) + s.duration;
    }
    return DAY_NAMES
      .map((name, day) => ({ name, value: totals[name] ?? 0, day }))
      .filter((d) => d.value > 0);
  }, [stats]);

  // Derive per-day, per-weekday, and per-month maps from sessions using browser-local
  // time (session.startedAt epoch ms), avoiding ABS server timezone offsets in absStats.days
  const absSessionDayMap = useMemo(() => {
    return absSessions.reduce<Record<string, number>>((acc, s) => {
      const key = format(new Date(s.startedAt), 'yyyy-MM-dd');
      acc[key] = (acc[key] ?? 0) + s.timeListening;
      return acc;
    }, {});
  }, [absSessions]);

  const absSessionDayOfWeek = useMemo(() => {
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return absSessions.reduce<Record<string, number>>((acc, s) => {
      const name = DAY_NAMES[getDay(new Date(s.startedAt))];
      acc[name] = (acc[name] ?? 0) + s.timeListening;
      return acc;
    }, {});
  }, [absSessions]);

  const absMonthlyMap = useMemo(
    () => absMonthlyToMap(absSessionDayMap),
    [absSessionDayMap]
  );

  const combinedMonthly = useMemo(
    () => mergeMonthly(ebookPerMonth, absMonthlyMap),
    [ebookPerMonth, absMonthlyMap]
  );

  const combinedWeekdays = useMemo(
    () => mergeWeekdays(ebookPerDayOfTheWeek, absSessionDayOfWeek),
    [ebookPerDayOfTheWeek, absSessionDayOfWeek]
  );

  const absLast7DaysTime = useMemo(() => {
    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 6);
    return absSessions.reduce((acc, s) => {
      const day = startOfDay(new Date(s.startedAt));
      if (day >= sevenDaysAgo && day <= today) return acc + s.timeListening;
      return acc;
    }, 0);
  }, [absSessions]);

  const absLongestDay = useMemo(() => {
    if (!Object.keys(absSessionDayMap).length) return 0;
    return Math.max(0, ...Object.values(absSessionDayMap));
  }, [absSessionDayMap]);

  const absBooksByItemId = useMemo(() => {
    return absBooks.reduce<Record<string, typeof absBooks[0]>>((acc, b) => {
      acc[b.id] = b;
      return acc;
    }, {});
  }, [absBooks]);

  const estimatedAbsTotalPages = useMemo(() => {
    let total = 0;
    let hasAny = false;
    for (const s of absSessions) {
      const book = absBooksByItemId[s.libraryItemId];
      if (!book?.reference_pages || !book.duration) continue;
      hasAny = true;
      total += s.timeListening * (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
    }
    return hasAny ? Math.round(total) : null;
  }, [absSessions, absBooksByItemId]);

  const estimatedAbsMostPagesInADay = useMemo(() => {
    if (!absBooks.some((b) => b.reference_pages)) return null;
    const pagesPerDay: Record<string, number> = {};
    for (const s of absSessions) {
      const book = absBooksByItemId[s.libraryItemId];
      if (!book?.reference_pages || !book.duration) continue;
      const pagesPerSecond = (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
      const key = format(new Date(s.startedAt), 'yyyy-MM-dd');
      pagesPerDay[key] = (pagesPerDay[key] ?? 0) + s.timeListening * pagesPerSecond;
    }
    if (!Object.keys(pagesPerDay).length) return null;
    return Math.round(Math.max(...Object.values(pagesPerDay)));
  }, [absSessions, absBooksByItemId, absBooks]);

  const isLoading =
    (showEbooks && (booksLoading || statsLoading)) ||
    (showAudiobooks && (absLoading || absSessionsLoading));

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  const totalListeningTime = absStats?.totalTime ?? 0;
  const combinedTotal = (showEbooks ? totalReadingTime : 0) + (showAudiobooks ? totalListeningTime : 0);

  const last7Days =
    (showEbooks ? last7DaysReadTime : 0) + (showAudiobooks ? absLast7DaysTime : 0);

  const activityVerb =
    dataSource === 'audiobook' ? 'listened' : dataSource === 'both' ? 'read or listened' : 'read';

  return (
    <>
      <Flex justify="space-between" align="center" mb="sm" wrap="wrap" gap="sm">
        <Title>Reading statistics</Title>
        <DataSourceToggle value={dataSource} onChange={setDataSource} />
      </Flex>

      <Text
        mt={4}
        mb="md"
        style={{ display: 'inline' }}
        variant="gradient"
        gradient={{
          from: colorScheme === 'dark' ? 'violet.4' : 'violet.8',
          to: colorScheme === 'dark' ? 'koinsight.5' : 'koinsight.8',
          deg: 120,
        }}
        fw={900}
      >
        {last7Days > 0 ? (
          <>You {activityVerb} for {formatSecondsToHumanReadable(last7Days)} this week. Keep it up!</>
        ) : (
          <>You haven't {activityVerb} this week yet. No better time to start!</>
        )}
      </Text>

      <Box my="xl">
        {dataSource === 'ebook' && (
          <Statistics
            data={[
              {
                label: 'Total read time',
                value: formatSecondsToHumanReadable(totalReadingTime),
                icon: IconClock,
              },
              { label: 'Total pages read', value: totalPagesRead, icon: IconPageBreak },
              {
                label: 'Longest time reading in a day',
                value: formatSecondsToHumanReadable(longestDay),
                icon: IconMaximize,
              },
              {
                label: 'Most pages in a day',
                value: mostPagesInADay ?? 'N/A',
                icon: IconMaximize,
              },
            ]}
          />
        )}

        {dataSource === 'audiobook' && (
          <Statistics
            data={[
              {
                label: 'Total listening time',
                value: formatSecondsToHumanReadable(totalListeningTime),
                icon: IconHeadphones,
              },
              {
                label: 'Longest time listening in a day',
                value: formatSecondsToHumanReadable(absLongestDay),
                icon: IconMaximize,
              },
              ...(estimatedAbsTotalPages !== null ? [
                { label: 'Estimated total pages read', value: estimatedAbsTotalPages, icon: IconPageBreak },
                { label: 'Estimated most pages in a day', value: estimatedAbsMostPagesInADay ?? 'N/A', icon: IconMaximize },
              ] : []),
            ]}
          />
        )}

        {dataSource === 'both' && (
          <Statistics
            data={[
              {
                label: 'Total read time',
                value: formatSecondsToHumanReadable(totalReadingTime),
                icon: IconClock,
              },
              {
                label: 'Total listening time',
                value: formatSecondsToHumanReadable(totalListeningTime),
                icon: IconHeadphones,
              },
              {
                label: 'Combined total',
                value: formatSecondsToHumanReadable(combinedTotal),
                icon: IconMaximize,
              },
              {
                label: 'Total pages read',
                value: totalPagesRead + (estimatedAbsTotalPages ?? 0),
                icon: IconPageBreak,
              },
            ]}
          />
        )}
      </Box>

      {dataSource === 'ebook' && (
        <>
          <Title mb="xl" order={3}>
            Reading history
          </Title>
          <Box mb="xl">
            <ReadingCalendar />
          </Box>
          <Title mt="xl" mb={4} order={3}>
            Daily stats
          </Title>
          <DayStats
            stats={stats}
            booksByMd5={booksByMd5 ?? {}}
            absSessions={[]}
            absBooksByItemId={{}}
            showEbooks
            showAudiobooks={false}
          />
          <Title mt="xl" mb={4} order={3}>
            Weekly stats
          </Title>
          <WeekStats stats={stats} booksByMd5={booksByMd5 ?? {}} />
          <Title mt="xl" mb={4} order={3}>
            Monthly stats
          </Title>
          <MonthStats stats={stats} booksByMd5={booksByMd5 ?? {}} />
          <Title mt="xl" mb={4} order={3}>
            Yearly stats
          </Title>
          <YearStats stats={stats} booksByMd5={booksByMd5 ?? {}} />
        </>
      )}

      {dataSource === 'audiobook' && (
        <>
          <Title mb="xl" order={3}>
            Listening history
          </Title>
          <Box mb="xl">
            <ListeningCalendar absData={absSessionDayMap} accentRgb="121, 80, 242" />
          </Box>
          <Title mt="xl" mb={4} order={3}>
            Daily stats
          </Title>
          <DayStats
            stats={[]}
            booksByMd5={{}}
            absSessions={absSessions}
            absBooksByItemId={absBooksByItemId}
            showEbooks={false}
            showAudiobooks
          />
          <Title mt="xl" mb={4} order={3}>
            Weekly stats
          </Title>
          <AbsWeekStats absBooksByItemId={absBooksByItemId} />
          <Title mt="xl" mb={4} order={3}>
            Monthly stats
          </Title>
          <AbsMonthStats absBooksByItemId={absBooksByItemId} />
          <Title mt="xl" mb={4} order={3}>
            Yearly stats
          </Title>
          <AbsYearStats absBooksByItemId={absBooksByItemId} />
        </>
      )}

      {dataSource === 'both' && (
        <>
          <Title mb="xl" order={3}>
            Reading history
          </Title>
          <Box mb="xl">
            <ReadingCalendar absData={absSessionDayMap} />
          </Box>
          <Title mt="xl" mb={4} order={3}>
            Daily stats
          </Title>
          <DayStats
            stats={stats}
            booksByMd5={booksByMd5 ?? {}}
            absSessions={absSessions}
            absBooksByItemId={absBooksByItemId}
            showEbooks
            showAudiobooks
          />
          <Title mt="xl" mb={4} order={3}>
            Weekly stats
          </Title>
          <WeekStats stats={stats} booksByMd5={booksByMd5 ?? {}} absSessions={absSessions} absBooksByItemId={absBooksByItemId} />
          <Title mt="xl" mb={4} order={3}>
            Monthly stats
          </Title>
          <MonthStats stats={stats} booksByMd5={booksByMd5 ?? {}} absSessions={absSessions} absBooksByItemId={absBooksByItemId} />
          <Title mt="xl" mb={4} order={3}>
            Yearly stats
          </Title>
          <YearStats stats={stats} booksByMd5={booksByMd5 ?? {}} absSessions={absSessions} absBooksByItemId={absBooksByItemId} />
        </>
      )}

      {dataSource !== 'both' && (
        <>
          <Title mt="xl" order={3}>
            Per day of the week
          </Title>
          <BarChart
            h={300}
            data={
              dataSource === 'ebook'
                ? ebookPerDayOfTheWeek.map((d) => ({ name: d.name, value: d.value }))
                : Object.entries(DAY_ORDER)
                    .sort(([, a], [, b]) => a - b)
                    .map(([name]) => ({
                      name,
                      value: absSessionDayOfWeek[name] ?? 0,
                    }))
            }
            dataKey="name"
            series={[
              {
                name: 'value',
                label: 'Time',
                color:
                  dataSource === 'audiobook'
                    ? colorScheme === 'dark' ? 'violet.7' : 'violet.1'
                    : colorScheme === 'dark' ? 'koinsight.7' : 'koinsight.1',
              },
            ]}
            gridAxis="none"
            withYAxis={false}
            barProps={{
              maxBarSize: 100,
              shape: (props: BarProps) => (
                <CustomBar
                  {...props}
                  accent={
                    dataSource === 'audiobook'
                      ? colorScheme === 'dark' ? colors.violet[2] : colors.violet[8]
                      : colorScheme === 'dark' ? colors.koinsight[2] : colors.koinsight[8]
                  }
                />
              ),
            }}
            valueFormatter={(value) => formatSecondsToHumanReadable(value)}
          />

          <Title mt="xl" order={3}>
            Monthly {dataSource === 'audiobook' ? 'listening' : 'reading'} time
          </Title>
          <BarChart
            h={300}
            mt="sm"
            data={
              dataSource === 'ebook'
                ? ebookPerMonth
                : Object.entries(absMonthlyMap).map(([month, duration]) => ({ month, duration }))
            }
            dataKey="month"
            gridAxis="none"
            withYAxis={false}
            barProps={{
              maxBarSize: 100,
              shape: (props: BarProps) => (
                <CustomBar
                  {...props}
                  accent={
                    dataSource === 'ebook'
                      ? (colorScheme === 'dark' ? colors.koinsight[2] : colors.koinsight[8])
                      : (colorScheme === 'dark' ? colors.violet[2] : colors.violet[8])
                  }
                />
              ),
            }}
            valueFormatter={(value) => formatSecondsToHumanReadable(value)}
            series={[
              {
                name: 'duration',
                label: 'Time',
                color: dataSource === 'ebook'
                  ? (colorScheme === 'dark' ? 'koinsight.7' : 'koinsight.1')
                  : (colorScheme === 'dark' ? 'violet.7' : 'violet.1'),
              },
            ]}
          />
        </>
      )}

      {dataSource === 'both' && (
        <>
          <Title mt="xl" order={3}>
            Per day of the week
          </Title>
          <BarChart
            h={300}
            data={combinedWeekdays}
            dataKey="name"
            series={[
              {
                name: 'ebook',
                label: 'E-books',
                color: colorScheme === 'dark' ? 'koinsight.7' : 'koinsight.5',
              },
              {
                name: 'audiobook',
                label: 'Audiobooks',
                color: colorScheme === 'dark' ? 'violet.5' : 'violet.6',
              },
            ]}
            gridAxis="none"
            withYAxis={false}
            barProps={{ maxBarSize: 60 }}
            valueFormatter={(value) => formatSecondsToHumanReadable(value)}
          />

          <Title mt="xl" order={3}>
            Monthly time
          </Title>
          <BarChart
            h={300}
            mt="sm"
            data={combinedMonthly}
            dataKey="month"
            gridAxis="none"
            withYAxis={false}
            barProps={{ maxBarSize: 60 }}
            valueFormatter={(value) => formatSecondsToHumanReadable(value)}
            series={[
              {
                name: 'ebook',
                label: 'E-books',
                color: colorScheme === 'dark' ? 'koinsight.7' : 'koinsight.5',
              },
              {
                name: 'audiobook',
                label: 'Audiobooks',
                color: colorScheme === 'dark' ? 'violet.5' : 'violet.6',
              },
            ]}
          />
        </>
      )}
    </>
  );
}
