import {
  Box,
  Flex,
  Group,
  Image,
  Loader,
  Paper,
  RingProgress,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconBooks,
  IconCalendar,
  IconClock,
  IconClockHour4,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { startOfDay } from 'date-fns';
import { JSX, useState } from 'react';
import { useParams } from 'react-router';
import { AbsBook, useAbsBooks, useAbsSessions } from '../../api/audiobookshelf';
import { API_URL } from '../../api/api';
import { formatRelativeDate, formatSecondsToHumanReadable } from '../../utils/dates';
import { AbsBookPageCalendar } from './abs-book-page-calendar';
import { AbsBookPageManage } from './abs-book-page-manage';

import style from '../book-page/book-card.module.css';

export function AbsBookPage(): JSX.Element {
  const { id } = useParams() as { id: string };
  const { data: books, isLoading: booksLoading } = useAbsBooks({ showHidden: true });
  const { data: allSessions, isLoading: sessionsLoading } = useAbsSessions();
  const [tabValue, setTabValue] = useState<string | null>('calendar');
  const [coverVersion, setCoverVersion] = useState(0);

  const book = books?.find((b) => b.id === id);
  const sessions = (allSessions ?? []).filter((s) => s.libraryItemId === id);

  if (booksLoading || sessionsLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (!book) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="dimmed">Audiobook not found.</Text>
      </Flex>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" gap="md" align="flex-start">
        <AbsBookInfo book={book} coverVersion={coverVersion} />
        <AbsStatsCard book={book} sessions={sessions} />
      </Group>

      <Tabs value={tabValue} onChange={setTabValue}>
        <Tabs.List>
          <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
            Calendar
          </Tabs.Tab>
          <Tabs.Tab value="manage" leftSection={<IconSettings size={16} />}>
            Manage data
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="calendar">
          <Box py={20}>
            <AbsBookPageCalendar sessions={sessions} />
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="manage">
          <Box py={20}>
            <AbsBookPageManage
              book={book}
              onCoverUploaded={() => setCoverVersion((v) => v + 1)}
            />
          </Box>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function AbsBookInfo({
  book,
  coverVersion,
}: {
  book: AbsBook;
  coverVersion: number;
}): JSX.Element {
  const media = useMediaQuery(`(max-width: 62em)`);

  return (
    <Flex align="center" gap="lg">
      <Image
        src={`${API_URL}/audiobookshelf/cover/${book.id}?v=${coverVersion}`}
        h={media ? 150 : 250}
        w="auto"
        radius="md"
        fallbackSrc="/book-placeholder-small.png"
        alt={book.title}
      />
      <div>
        <Flex align="center" gap={8} mt={3}>
          <Tooltip label="Author" position="top" withArrow>
            <IconUser stroke={1.5} size={16} />
          </Tooltip>
          <span className={style.Author}>{book.authors || 'Unknown author'}</span>
        </Flex>

        <Title fw="800">{book.title}</Title>

        {book.series && (
          <Flex align="center" gap={8} mt="sm">
            <Tooltip label="Series" position="top" withArrow>
              <IconBooks stroke={1.5} size={16} />
            </Tooltip>
            <span className={style.InfoText}>{book.series}</span>
          </Flex>
        )}

        {book.lastUpdate && (
          <Flex align="center" gap={8} mt={5}>
            <Tooltip label="Last listened" position="top" withArrow>
              <IconCalendar stroke={1.5} size={16} />
            </Tooltip>
            <span className={style.InfoText}>{formatRelativeDate(book.lastUpdate)}</span>
          </Flex>
        )}
      </div>
    </Flex>
  );
}

function AbsStatsCard({
  book,
  sessions,
}: {
  book: AbsBook;
  sessions: ReturnType<typeof useAbsSessions>['data'];
}): JSX.Element {
  const progressPct = Math.round(book.progress * 100);

  const listeningDays = new Set(
    (sessions ?? []).map((s) => startOfDay(new Date(s.startedAt)).getTime().toString())
  ).size;

  const avgPerDay = listeningDays > 0 ? book.currentTime / listeningDays : 0;

  return (
    <Paper
      withBorder
      px="lg"
      py="md"
      radius="md"
      style={{
        background:
          'linear-gradient(135deg, var(--mantine-color-default) 0%, var(--mantine-color-body) 100%)',
      }}
    >
      <Stack gap={0} align="center">
        <Text size="sm" c="dimmed" tt="uppercase" fw={700}>
          Listening progress
        </Text>
        <Group align="center" justify="space-between" wrap="nowrap">
          <Stack align="center" gap="xs">
            <RingProgress
              size={180}
              thickness={9}
              roundCaps
              label={
                <Stack gap={0} align="center">
                  <Text size="xl" fw={700} ta="center">
                    {progressPct}%
                  </Text>
                  <Text size="xs" c="dimmed" ta="center" fw="bold">
                    listened
                  </Text>
                </Stack>
              }
              sections={[{ value: progressPct, color: 'violet' }]}
            />
          </Stack>

          <Stack gap="md" flex={1} ml="lg">
            <Group gap="sm" wrap="nowrap">
              <IconClock size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
              <Stack gap={0}>
                <Text fz={11} c="dimmed" lh={1.2} tt="uppercase" fw="bold">
                  Total listening time
                </Text>
                <Text size="md" fw={600}>
                  {formatSecondsToHumanReadable(book.currentTime)}
                </Text>
              </Stack>
            </Group>

            <Group gap="sm" wrap="nowrap">
              <IconClockHour4 size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
              <Stack gap={0}>
                <Text fz={11} c="dimmed" lh={1.2} tt="uppercase" fw="bold">
                  Average per day
                </Text>
                <Text size="md" fw={600}>
                  {formatSecondsToHumanReadable(avgPerDay)}
                </Text>
              </Stack>
            </Group>
          </Stack>

          <Stack gap="md" flex={1}>
            <Group gap="sm" wrap="nowrap">
              <IconCalendar size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
              <Stack gap={0}>
                <Text fz={11} c="dimmed" lh={1.2} tt="uppercase" fw="bold">
                  Days listening
                </Text>
                <Text size="md" fw={600}>
                  {listeningDays}
                </Text>
              </Stack>
            </Group>
          </Stack>
        </Group>
      </Stack>
    </Paper>
  );
}
