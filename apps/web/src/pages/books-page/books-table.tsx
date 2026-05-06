import { Anchor, Badge, Flex, Image, Progress, Stack, Table, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconBook, IconEyeClosed, IconHeadphones, IconHighlight } from '@tabler/icons-react';
import { JSX } from 'react';
import { NavLink } from 'react-router';
import { API_URL } from '../../api/api';
import { formatRelativeDate, getDuration, shortDuration } from '../../utils/dates';
import style from './books-table.module.css';

export type UnifiedBook = {
  key: string;
  source: 'ebook' | 'audiobook';
  title: string;
  authors: string | null;
  series: string | null;
  ebookId?: number;
  absItemId?: string;
  soft_deleted: boolean;
  annotationsCount: number;
  progressPct: number;
  readLabel: string;
  totalPages: string;
  totalReadTime: number;
  lastActivityMs: number;
  completed?: boolean;
};

type BooksTableProps = {
  books: UnifiedBook[];
};

export function BooksTable({ books }: BooksTableProps): JSX.Element {
  const media = useMediaQuery(`(max-width: 62em)`);

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Title</Table.Th>
          <Table.Th style={{ width: '200px' }} visibleFrom="md">
            Read
          </Table.Th>
          <Table.Th visibleFrom="md">Pages</Table.Th>
          <Table.Th visibleFrom="md">Total read time</Table.Th>
          <Table.Th visibleFrom="md">Last open</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {books.map((book) => {
          const coverSrc =
            book.source === 'ebook'
              ? `${API_URL}/books/${book.ebookId}/cover`
              : `${API_URL}/audiobookshelf/cover/${book.absItemId}`;

          const bookPath =
            book.source === 'ebook' ? `/books/${book.ebookId}` : `/abs-books/${book.absItemId}`;

          return (
            <Table.Tr key={book.key}>
              <Table.Td>
                <Flex align="center" gap="sm">
                  <Anchor to={bookPath} component={NavLink} className={style.BookCoverLink}>
                    {book.soft_deleted ? (
                      <Tooltip label="This book is hidden" withArrow>
                        <IconEyeClosed size={13} className={style.BookHiddenIndicator} />
                      </Tooltip>
                    ) : null}
                    <Image
                      src={coverSrc}
                      style={{ aspectRatio: '1/1.5' }}
                      w={media ? 40 : 60}
                      fit="contain"
                      alt={book.title}
                      fallbackSrc="/book-placeholder-small.png"
                      radius="sm"
                      className={book.soft_deleted ? style.BookHidden : undefined}
                    />
                  </Anchor>
                  <Stack gap={2} justify="center">
                    <Flex align="center" gap={4}>
                      {book.source === 'ebook' && (
                        <Tooltip label="E-book" withArrow>
                          <IconBook size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                        </Tooltip>
                      )}
                      {book.source === 'audiobook' && (
                        <Tooltip label="Audiobook" withArrow>
                          <IconHeadphones size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                        </Tooltip>
                      )}
                      <Anchor to={bookPath} component={NavLink} fw={800}>
                        {book.title}
                      </Anchor>
                    </Flex>
                    <span className={style.SubTitle}>
                      {book.authors ?? 'Unknown author'}
                      {book.series && book.series !== 'N/A' ? ` · ${book.series}` : ''}
                    </span>
                    {book.annotationsCount > 0 && (
                      <Tooltip label={`${book.annotationsCount} imported annotations`} withArrow>
                        <Flex align="center">
                          <IconHighlight size={13} />
                          &nbsp;{book.annotationsCount}
                        </Flex>
                      </Tooltip>
                    )}
                    {book.source === 'ebook' && (
                      <Badge size="xs" color="teal" variant="light" w="fit-content">
                        ebook
                      </Badge>
                    )}
                    {book.source === 'audiobook' && (
                      <Badge size="xs" color="violet" variant="light" w="fit-content">
                        audiobook
                      </Badge>
                    )}
                  </Stack>
                </Flex>
              </Table.Td>
              <Table.Td visibleFrom="md">
                {book.readLabel}
                <Progress
                  value={book.progressPct}
                  aria-label="Progress"
                  color={book.source === 'audiobook' ? 'violet' : undefined}
                />
              </Table.Td>
              <Table.Td visibleFrom="md">{book.totalPages}</Table.Td>
              <Table.Td visibleFrom="md">
                {book.totalReadTime ? shortDuration(getDuration(book.totalReadTime)) : 'N/A'}
              </Table.Td>
              <Table.Td visibleFrom="md">
                {book.lastActivityMs ? formatRelativeDate(book.lastActivityMs) : 'N/A'}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
