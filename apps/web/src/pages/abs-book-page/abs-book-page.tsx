import {
  Anchor,
  Flex,
  Group,
  Image,
  Loader,
  Paper,
  RingProgress,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconCalendar, IconClock, IconExternalLink, IconHeadphones, IconUser } from '@tabler/icons-react';
import { JSX } from 'react';
import { useParams } from 'react-router';
import { useAbsBooks } from '../../api/audiobookshelf';
import { API_URL } from '../../api/api';
import { useSettings } from '../../api/settings';
import { formatRelativeDate, formatSecondsToHumanReadable } from '../../utils/dates';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AbsBookPage(): JSX.Element {
  const { id } = useParams() as { id: string };
  const { data: books, isLoading } = useAbsBooks();
  const { data: settings } = useSettings();

  const book = books?.find((b) => b.id === id);
  const absBase = settings?.abs_url?.replace(/\/$/, '') ?? '';

  if (isLoading) {
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

  const progressPct = Math.round(book.progress * 100);

  return (
    <Stack gap="md">
      <Group justify="space-between" gap="md" align="flex-start">
        {/* Book info card */}
        <Flex align="center" gap="lg">
          <Image
            src={`${API_URL}/audiobookshelf/cover/${book.id}`}
            h={250}
            w="auto"
            radius="md"
            fallbackSrc="/book-placeholder-small.png"
            alt={book.title}
          />
          <Stack gap="xs">
            <Flex align="center" gap={8}>
              <Tooltip label="Author" position="top" withArrow>
                <IconUser stroke={1.5} size={16} />
              </Tooltip>
              <Text c="dimmed">{book.authors || 'N/A'}</Text>
            </Flex>
            <Title fw={800}>{book.title}</Title>
            <Flex align="center" gap={8}>
              <Tooltip label="Total duration" position="top" withArrow>
                <IconHeadphones stroke={1.5} size={16} />
              </Tooltip>
              <Text>{formatDuration(book.duration)}</Text>
            </Flex>
            {book.lastUpdate && (
              <Flex align="center" gap={8}>
                <Tooltip label="Last listened" position="top" withArrow>
                  <IconCalendar stroke={1.5} size={16} />
                </Tooltip>
                <Text>{formatRelativeDate(book.lastUpdate)}</Text>
              </Flex>
            )}
            {absBase && (
              <Anchor href={`${absBase}/item/${book.id}`} target="_blank" rel="noreferrer" size="sm">
                <Flex align="center" gap={4}>
                  <IconExternalLink size={14} />
                  Open in AudioBookShelf
                </Flex>
              </Anchor>
            )}
          </Stack>
        </Flex>

        {/* Progress card */}
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
                        {formatDuration(book.currentTime)}
                        <br />
                        of {formatDuration(book.duration)}
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
                      Time listened
                    </Text>
                    <Text size="md" fw={600}>
                      {formatSecondsToHumanReadable(book.currentTime)}
                    </Text>
                  </Stack>
                </Group>

                <Group gap="sm" wrap="nowrap">
                  <IconHeadphones size={18} style={{ flexShrink: 0, opacity: 0.6 }} />
                  <Stack gap={0}>
                    <Text fz={11} c="dimmed" lh={1.2} tt="uppercase" fw="bold">
                      Total duration
                    </Text>
                    <Text size="md" fw={600}>
                      {formatSecondsToHumanReadable(book.duration)}
                    </Text>
                  </Stack>
                </Group>
              </Stack>
            </Group>
          </Stack>
        </Paper>
      </Group>
    </Stack>
  );
}
