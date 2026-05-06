import { AbsBook } from '../../api/audiobookshelf';
import { Badge, Loader, Flex, Progress, Table, Text, Title } from '@mantine/core';
import { JSX } from 'react';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface AbsBooksSectionProps {
  books: AbsBook[];
  isLoading: boolean;
  showTitle?: boolean;
}

export function AbsBooksSection({
  books,
  isLoading,
  showTitle = true,
}: AbsBooksSectionProps): JSX.Element {
  if (isLoading) {
    return (
      <Flex justify="center" py="xl">
        <Loader />
      </Flex>
    );
  }

  return (
    <>
      {showTitle && (
        <Title order={3} mb="md" mt="xl">
          Audiobooks
        </Title>
      )}
      {books.length === 0 ? (
        <Text c="dimmed" size="sm">
          No audiobooks found. Make sure your AudioBookShelf settings are configured correctly.
        </Text>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Author</Table.Th>
              <Table.Th>Duration</Table.Th>
              <Table.Th>Progress</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {books.map((book) => (
              <Table.Tr key={book.id}>
                <Table.Td>{book.title}</Table.Td>
                <Table.Td>{book.authors || '—'}</Table.Td>
                <Table.Td>{formatDuration(book.duration)}</Table.Td>
                <Table.Td style={{ minWidth: 120 }}>
                  <Flex align="center" gap="xs">
                    <Progress
                      value={Math.round(book.progress * 100)}
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <Text size="xs" c="dimmed" w={32} ta="right">
                      {Math.round(book.progress * 100)}%
                    </Text>
                  </Flex>
                </Table.Td>
                <Table.Td>
                  {book.isFinished ? (
                    <Badge color="green" variant="light" size="sm">
                      Finished
                    </Badge>
                  ) : book.progress > 0 ? (
                    <Badge color="blue" variant="light" size="sm">
                      In progress
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="light" size="sm">
                      Not started
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
