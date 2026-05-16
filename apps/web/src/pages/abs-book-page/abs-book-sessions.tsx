import { blockAbsSession, AbsSession } from '../../api/audiobookshelf';
import { ActionIcon, Flex, Table, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { format } from 'date-fns';
import { mutate } from 'swr';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function AbsBookSessions({ sessions }: { sessions: AbsSession[] }) {
  if (sessions.length === 0) return null;

  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);

  const handleDelete = (session: AbsSession) => {
    modals.openConfirmModal({
      title: 'Remove session?',
      centered: true,
      children: (
        <Text size="sm">
          Remove the session on{' '}
          <strong>{format(new Date(session.startedAt), 'MMM d, yyyy')}</strong> (
          {formatSecondsToHumanReadable(session.timeListening)}) from KoInsight? This does not
          affect AudioBookShelf.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await blockAbsSession(session.id);
          await mutate('abs-sessions');
          notifications.show({
            title: 'Session removed',
            message: 'The session has been removed from KoInsight.',
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
        Listening sessions
      </Title>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Device</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((s) => (
            <Table.Tr key={s.id}>
              <Table.Td>{format(new Date(s.startedAt), 'MMM d, yyyy – HH:mm')}</Table.Td>
              <Table.Td>{formatSecondsToHumanReadable(s.timeListening)}</Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {s.deviceInfo?.clientName ?? s.deviceInfo?.deviceName ?? '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Flex justify="flex-end">
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="sm"
                    onClick={() => handleDelete(s)}
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
