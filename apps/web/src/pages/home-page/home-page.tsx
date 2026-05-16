import { Badge, Box, Flex, Image, Loader, Progress, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconBook, IconFlame, IconHeadphones } from '@tabler/icons-react';
import { startOfDay, subDays } from 'date-fns';
import { JSX, useMemo } from 'react';
import { NavLink } from 'react-router';
import { AbsBook, useAbsBooks, useAbsSessions } from '../../api/audiobookshelf';
import { useBooks } from '../../api/books';
import { usePageStats } from '../../api/use-page-stats';
import { API_URL } from '../../api/api';
import {
  DataSourceToggle,
  useDataSource,
} from '../../components/data-source-toggle/data-source-toggle';
import { getAbsBookPath, getBookPath } from '../../routes';
import { formatRelativeDate } from '../../utils/dates';
import { BookWithData } from '@koinsight/common/types';

import style from './home-page.module.css';

function computeStreak(days: Set<number>): { current: number; longest: number } {
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = Array.from(days).sort((a, b) => b - a);
  const DAY_MS = 86_400_000;
  const todayStart = startOfDay(new Date()).getTime();
  const yesterdayStart = subDays(new Date(), 1).setHours(0, 0, 0, 0);

  let current = 0;
  if (days.has(todayStart) || days.has(yesterdayStart)) {
    let cursor = days.has(todayStart) ? todayStart : yesterdayStart;
    while (days.has(cursor)) {
      current++;
      cursor -= DAY_MS;
    }
  }

  let longest = 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] - sorted[i] === DAY_MS) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  longest = Math.max(longest, current, sorted.length > 0 ? 1 : 0);

  return { current, longest };
}

function StreakCard({
  current,
  longest,
  label,
}: {
  current: number;
  longest: number;
  label: string;
}) {
  return (
    <Box
      p="xl"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-md)',
        background: 'linear-gradient(135deg, var(--mantine-color-default) 0%, var(--mantine-color-body) 100%)',
      }}
    >
      <Flex align="center" gap="md">
        <IconFlame size={40} color="orange" />
        <Stack gap={0}>
          <Text fz={48} fw={900} lh={1}>
            {current}
          </Text>
          <Text size="sm" c="dimmed">
            day streak {label}
          </Text>
        </Stack>
        <Stack gap={0} ml="auto" ta="right">
          <Text fz={24} fw={700} lh={1}>
            {longest}
          </Text>
          <Text size="xs" c="dimmed">
            longest
          </Text>
        </Stack>
      </Flex>
    </Box>
  );
}

function CurrentlyReadingCard({ book }: { book: BookWithData }) {
  const pct = book.completed_override
    ? 100
    : book.total_pages > 0
    ? (book.unique_read_pages / book.total_pages) * 100
    : 0;

  return (
    <NavLink to={getBookPath(book.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box
        p="md"
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
          cursor: 'pointer',
        }}
      >
        <Flex gap="md" align="flex-start">
          <Image
            src={`${API_URL}/books/${book.id}/cover`}
            w={60}
            style={{ aspectRatio: '1/1.5' }}
            fit="contain"
            fallbackSrc="/book-placeholder-small.png"
            radius="sm"
            alt={book.title}
          />
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Flex align="center" gap={4}>
              <IconBook size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              <Text size="xs" c="dimmed" truncate>
                {book.authors}
              </Text>
            </Flex>
            <Text fw={700} size="sm" lineClamp={2}>
              {book.title}
            </Text>
            <Progress value={pct} size="xs" color="koinsight" mt={4} />
            <Text size="xs" c="dimmed">
              {Math.round(pct)}% · {book.last_open ? formatRelativeDate(book.last_open * 1000) : 'Never'}
            </Text>
          </Stack>
        </Flex>
      </Box>
    </NavLink>
  );
}

function CurrentlyListeningCard({ book }: { book: AbsBook }) {
  const pct = book.completed ? 100 : Math.round(book.progress * 100);

  return (
    <NavLink to={getAbsBookPath(book.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box
        p="md"
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
          cursor: 'pointer',
        }}
      >
        <Flex gap="md" align="flex-start">
          <Image
            src={`${API_URL}/audiobookshelf/cover/${book.id}`}
            w={60}
            style={{ aspectRatio: '1/1.5' }}
            fit="contain"
            fallbackSrc="/book-placeholder-small.png"
            radius="sm"
            alt={book.title}
          />
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Flex align="center" gap={4}>
              <IconHeadphones size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              <Text size="xs" c="dimmed" truncate>
                {book.authors || 'Unknown author'}
              </Text>
            </Flex>
            <Text fw={700} size="sm" lineClamp={2}>
              {book.title}
            </Text>
            <Progress value={pct} size="xs" color="violet" mt={4} />
            <Text size="xs" c="dimmed">
              {pct}% · {book.lastUpdate ? formatRelativeDate(book.lastUpdate) : 'Never'}
            </Text>
          </Stack>
        </Flex>
      </Box>
    </NavLink>
  );
}

export function HomePage(): JSX.Element {
  const [dataSource, setDataSource] = useDataSource('home');
  const showEbooks = dataSource === 'ebook' || dataSource === 'both';
  const showAudiobooks = dataSource === 'audiobook' || dataSource === 'both';

  const {
    data: { stats: pageStats },
    isLoading: statsLoading,
  } = usePageStats();
  const { data: absSessions, isLoading: absSessionsLoading } = useAbsSessions();
  const { data: ebooks, isLoading: ebooksLoading } = useBooks();
  const { data: absBooks, isLoading: absLoading } = useAbsBooks();

  const isLoading =
    (showEbooks && (statsLoading || ebooksLoading)) ||
    (showAudiobooks && (absSessionsLoading || absLoading));

  const ebookDays = useMemo(() => {
    const days = new Set<number>();
    if (!showEbooks) return days;
    for (const stat of pageStats) {
      days.add(startOfDay(stat.start_time).getTime());
    }
    return days;
  }, [pageStats, showEbooks]);

  const absDays = useMemo(() => {
    const days = new Set<number>();
    if (!showAudiobooks) return days;
    for (const s of absSessions) {
      if (s.timeListening > 0) {
        days.add(startOfDay(new Date(s.startedAt)).getTime());
      }
    }
    return days;
  }, [absSessions, showAudiobooks]);

  const allDays = useMemo(() => {
    const merged = new Set(ebookDays);
    for (const d of absDays) merged.add(d);
    return dataSource === 'ebook' ? ebookDays : dataSource === 'audiobook' ? absDays : merged;
  }, [ebookDays, absDays, dataSource]);

  const streak = useMemo(() => computeStreak(allDays), [allDays]);

  const currentlyReading = useMemo(() => {
    if (!showEbooks || !ebooks) return [];
    return ebooks
      .filter((b) => {
        const pct = b.total_pages > 0 ? (b.unique_read_pages / b.total_pages) * 100 : 0;
        return pct > 0 && pct < 100 && !b.completed_override && !b.soft_deleted;
      })
      .sort((a, b) => (b.last_open ?? 0) - (a.last_open ?? 0));
  }, [ebooks, showEbooks]);

  const currentlyListening = useMemo(() => {
    if (!showAudiobooks || !absBooks) return [];
    return absBooks
      .filter((b) => {
        const pct = b.progress * 100;
        return pct > 0 && pct < 100 && !b.completed && !b.hidden && !b.deleted;
      })
      .sort((a, b) => (b.lastUpdate ?? 0) - (a.lastUpdate ?? 0));
  }, [absBooks, showAudiobooks]);

  const media = useMediaQuery('(max-width: 62em)');

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  const streakLabel =
    dataSource === 'ebook'
      ? 'reading'
      : dataSource === 'audiobook'
      ? 'listening'
      : 'reading & listening';

  return (
    <>
      <Flex justify="space-between" align="center" mb="xl" wrap="wrap" gap="sm">
        <Title>Home</Title>
        <DataSourceToggle value={dataSource} onChange={setDataSource} />
      </Flex>

      <Box mb="xl" maw={400}>
        <StreakCard current={streak.current} longest={streak.longest} label={streakLabel} />
      </Box>

      {showEbooks && currentlyReading.length > 0 && (
        <>
          <Title order={3} mb="md">
            Currently reading
          </Title>
          <SimpleGrid cols={media ? 1 : 3} mb="xl" spacing="md">
            {currentlyReading.map((book) => (
              <CurrentlyReadingCard key={book.id} book={book} />
            ))}
          </SimpleGrid>
        </>
      )}

      {showEbooks && currentlyReading.length === 0 && (
        <Box mb="xl">
          <Title order={3} mb="sm">
            Currently reading
          </Title>
          <Text c="dimmed" size="sm">
            No books in progress. Start reading something!
          </Text>
        </Box>
      )}

      {showAudiobooks && currentlyListening.length > 0 && (
        <>
          <Title order={3} mb="md">
            Currently listening
          </Title>
          <SimpleGrid cols={media ? 1 : 3} mb="xl" spacing="md">
            {currentlyListening.map((book) => (
              <CurrentlyListeningCard key={book.id} book={book} />
            ))}
          </SimpleGrid>
        </>
      )}

      {showAudiobooks && currentlyListening.length === 0 && (
        <Box mb="xl">
          <Title order={3} mb="sm">
            Currently listening
          </Title>
          <Text c="dimmed" size="sm">
            No audiobooks in progress. Start listening to something!
          </Text>
        </Box>
      )}
    </>
  );
}
