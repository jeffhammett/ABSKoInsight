import { Anchor, Badge, Flex, Image, Loader, Progress, Stack, Table, Text, Title } from '@mantine/core';
import { JSX, useMemo } from 'react';
import { NavLink, useParams } from 'react-router';
import { useAbsBooks } from '../../api/audiobookshelf';
import { useBooks } from '../../api/books';
import { API_URL } from '../../api/api';
import { getAbsBookPath, getBookPath } from '../../routes';

function normalizeSeries(name: string | null | undefined): string {
  if (!name) return '';
  return name.toLowerCase().replace(/^the\s+/, '').trim();
}

export function SeriesPage(): JSX.Element {
  const { name } = useParams() as { name: string };
  const seriesName = decodeURIComponent(name);
  const normalizedTarget = normalizeSeries(seriesName);

  const { data: ebooks, isLoading: ebooksLoading } = useBooks({ showHidden: true });
  const { data: absBooks, isLoading: absLoading } = useAbsBooks({ showHidden: true });

  const seriesEbooks = useMemo(
    () => (ebooks ?? []).filter((b) => normalizeSeries(b.series) === normalizedTarget),
    [ebooks, normalizedTarget]
  );

  const seriesAbs = useMemo(
    () => (absBooks ?? []).filter((b) => normalizeSeries(b.series) === normalizedTarget),
    [absBooks, normalizedTarget]
  );

  const isLoading = ebooksLoading || absLoading;

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  const totalBooks = seriesEbooks.length + seriesAbs.length;
  const completedEbooks = seriesEbooks.filter(
    (b) => b.completed_override || (b.total_pages > 0 && b.unique_read_pages >= b.total_pages)
  ).length;
  const completedAbs = seriesAbs.filter((b) => b.completed || b.isFinished || b.progress >= 1).length;
  const totalCompleted = completedEbooks + completedAbs;
  const completionPct = totalBooks > 0 ? Math.round((totalCompleted / totalBooks) * 100) : 0;

  return (
    <>
      <Title mb="xs">{seriesName}</Title>
      <Flex align="center" gap="md" mb="xl">
        <Text c="dimmed" size="sm">
          {totalCompleted} of {totalBooks} {totalBooks === 1 ? 'book' : 'books'} completed ({completionPct}%)
        </Text>
        <Progress value={completionPct} w={120} size="sm" />
      </Flex>

      {seriesEbooks.length > 0 && (
        <>
          <Title order={3} mb="md">
            E-books
          </Title>
          <Table mb="xl">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Progress</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {seriesEbooks.map((book) => {
                const pct = book.completed_override
                  ? 100
                  : book.total_pages > 0
                  ? Math.round((book.unique_read_pages / book.total_pages) * 100)
                  : 0;
                return (
                  <Table.Tr key={book.id}>
                    <Table.Td>
                      <Flex align="center" gap="sm">
                        <Image
                          src={`${API_URL}/books/${book.id}/cover`}
                          w={40}
                          style={{ aspectRatio: '1/1.5' }}
                          fit="contain"
                          fallbackSrc="/book-placeholder-small.png"
                          radius="sm"
                          alt={book.title}
                        />
                        <Stack gap={2}>
                          <Anchor to={getBookPath(book.id)} component={NavLink} fw={700} size="sm">
                            {book.title}
                          </Anchor>
                          <Text size="xs" c="dimmed">{book.authors}</Text>
                        </Stack>
                      </Flex>
                    </Table.Td>
                    <Table.Td>
                      <Flex align="center" gap="sm">
                        <Progress value={pct} w={80} size="sm" color="koinsight" />
                        <Text size="sm">{pct}%</Text>
                        {(book.completed_override || pct === 100) && (
                          <Badge size="xs" color="green">Completed</Badge>
                        )}
                      </Flex>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </>
      )}

      {seriesAbs.length > 0 && (
        <>
          <Title order={3} mb="md">
            Audiobooks
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Progress</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {seriesAbs.map((book) => {
                const pct = book.completed ? 100 : Math.round(book.progress * 100);
                return (
                  <Table.Tr key={book.id}>
                    <Table.Td>
                      <Flex align="center" gap="sm">
                        <Image
                          src={`${API_URL}/audiobookshelf/cover/${book.id}`}
                          w={40}
                          style={{ aspectRatio: '1/1.5' }}
                          fit="contain"
                          fallbackSrc="/book-placeholder-small.png"
                          radius="sm"
                          alt={book.title}
                        />
                        <Stack gap={2}>
                          <Anchor to={getAbsBookPath(book.id)} component={NavLink} fw={700} size="sm">
                            {book.title}
                          </Anchor>
                          <Text size="xs" c="dimmed">{book.authors}</Text>
                        </Stack>
                      </Flex>
                    </Table.Td>
                    <Table.Td>
                      <Flex align="center" gap="sm">
                        <Progress value={pct} w={80} size="sm" color="violet" />
                        <Text size="sm">{pct}%</Text>
                        {(book.completed || book.isFinished) && (
                          <Badge size="xs" color="green">Completed</Badge>
                        )}
                      </Flex>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </>
      )}

      {totalBooks === 0 && (
        <Text c="dimmed">No books found for this series.</Text>
      )}
    </>
  );
}
