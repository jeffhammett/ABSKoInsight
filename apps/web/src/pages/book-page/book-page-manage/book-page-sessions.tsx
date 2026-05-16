import { PageStat } from '@koinsight/common/types/page-stat';
import { blockPageStat } from '../../../api/use-page-stats';
import { ActionIcon, Flex, Table, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { format } from 'date-fns';
import { mutate } from 'swr';
import { formatSecondsToHumanReadable } from '../../../utils/dates';

const CLUSTER_GAP_MS = 30 * 60 * 1000;

interface ReadingSession {
  stats: PageStat[];
  startTime: number;
  totalDuration: number;
}

function clusterIntoSessions(stats: PageStat[]): ReadingSession[] {
  const sorted = [...stats].sort((a, b) => a.start_time - b.start_time);
  const sessions: ReadingSession[] = [];

  for (const stat of sorted) {
    const last = sessions[sessions.length - 1];
    const endOfLast = last ? last.startTime + last.totalDuration * 1000 : -Infinity;
    if (last && stat.start_time - endOfLast < CLUSTER_GAP_MS) {
      last.stats.push(stat);
      last.totalDuration += stat.duration;
    } else {
      sessions.push({ stats: [stat], startTime: stat.start_time, totalDuration: stat.duration });
    }
  }

  return sessions.reverse();
}

export function BookPageSessions({
  stats,
  bookId,
}: {
  stats: PageStat[];
  bookId: number;
}) {
  if (stats.length === 0) return null;

  const sessions = clusterIntoSessions(stats);

  const handleDelete = (session: ReadingSession) => {
    const idsWithoutStat = session.stats.filter((s) => s.id == null);
    if (idsWithoutStat.length > 0) {
      notifications.show({
        title: 'Cannot remove session',
        message: 'Some entries in this session are missing an ID. Try reloading book data.',
        color: 'red',
        position: 'top-center',
      });
      return;
    }

    modals.openConfirmModal({
      title: 'Remove session?',
      centered: true,
      children: (
        <Text size="sm">
          Remove the reading session on{' '}
          <strong>{format(new Date(session.startTime), 'MMM d, yyyy')}</strong> (
          {formatSecondsToHumanReadable(session.totalDuration)}) from KoInsight? This does not
          affect your KoReader device.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await Promise.all(session.stats.map((s) => blockPageStat(s.id!)));
          await mutate(`books/${bookId}`);
          notifications.show({
            title: 'Session removed',
            message: 'The reading session has been removed from KoInsight.',
            color: 'green',
            position: 'top-center',
          });
        } catch {
          notifications.show({
            title: 'Failed',
            message: 'Could not remove the session.',
            color: 'red',
            position: 'top-center',
          });
        }
      },
    });
  };

  return (
    <div>
      <Title order={3} mb="md">
        Reading sessions
      </Title>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sessions.map((session) => (
            <Table.Tr key={session.startTime}>
              <Table.Td>
                {format(new Date(session.startTime), 'MMM d, yyyy – HH:mm')}
              </Table.Td>
              <Table.Td>{formatSecondsToHumanReadable(session.totalDuration)}</Table.Td>
              <Table.Td>
                <Flex justify="flex-end">
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="sm"
                    onClick={() => handleDelete(session)}
                    aria-label="Remove session"
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Flex>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
