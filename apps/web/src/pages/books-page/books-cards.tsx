import { Box, Flex, Group, Image, Progress, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconBook,
  IconBooks,
  IconEyeClosed,
  IconHeadphones,
  IconHighlight,
  IconProgress,
  IconUser,
} from '@tabler/icons-react';
import C from 'clsx';
import { JSX } from 'react';
import { useNavigate } from 'react-router';
import { API_URL } from '../../api/api';
import { getAbsBookPath, getBookPath } from '../../routes';
import { UnifiedBook } from './books-table';

import style from './books-cards.module.css';

type BooksCardsProps = {
  books: UnifiedBook[];
};

export function BooksCards({ books }: BooksCardsProps): JSX.Element {
  const navigate = useNavigate();
  const isSmallScreen = useMediaQuery(`(max-width: 62em)`);

  const cardWidth = isSmallScreen ? 120 : 200;

  return (
    <div
      className={style.CardGrid}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))` }}
    >
      {books.map((book) => {
        const coverSrc =
          book.source === 'ebook'
            ? `${API_URL}/books/${book.ebookId}/cover`
            : `${API_URL}/audiobookshelf/cover/${book.absItemId}`;
        const href =
          book.source === 'ebook'
            ? getBookPath(book.ebookId!)
            : getAbsBookPath(book.absItemId!);

        return (
          <Box
            key={book.key}
            className={style.Card}
            role="button"
            onClick={() => navigate(href)}
          >
            {book.soft_deleted ? (
              <Tooltip label="This book is hidden" withArrow>
                <IconEyeClosed size={16} className={style.BookHiddenIndicator} />
              </Tooltip>
            ) : null}
            <Image
              src={coverSrc}
              style={{ aspectRatio: '1/1.5' }}
              w={cardWidth}
              alt={book.title}
              fallbackSrc="/book-placeholder-small.png"
              className={book.soft_deleted ? style.BookHidden : undefined}
            />
            <Progress
              radius={0}
              h={5}
              value={book.progressPct}
              color={book.source === 'audiobook' ? 'violet' : 'koinsight'}
            />
            <Box px="lg" className={C(style.CardDetails, { [style.Small]: isSmallScreen })}>
              <Flex align="flex-start" gap={6}>
                {book.source === 'ebook'
                  ? <IconBook size={14} style={{ flexShrink: 0, marginTop: 3, opacity: 0.7 }} />
                  : <IconHeadphones size={14} style={{ flexShrink: 0, marginTop: 3, opacity: 0.7 }} />
                }
                <Text fz="md" fw={600} style={{ wordBreak: 'break-word', whiteSpace: 'wrap' }}>
                  {book.title}
                </Text>
              </Flex>
              <Group wrap="nowrap" gap={8} mt="xs">
                <Tooltip label="Author" position="top" withArrow>
                  <IconUser stroke={1.5} size={16} />
                </Tooltip>
                <span className={style.Attribute}>{book.authors ?? 'N/A'}</span>
              </Group>
              {!isSmallScreen && (
                <>
                  {book.series && (
                    <Group wrap="nowrap" gap={8}>
                      <Tooltip label="Series" position="top" withArrow>
                        <IconBooks stroke={1.5} size={16} />
                      </Tooltip>
                      <span className={style.Attribute}>{book.series}</span>
                    </Group>
                  )}
                  {book.annotationsCount > 0 && (
                    <Group wrap="nowrap" gap={8}>
                      <Tooltip
                        label={`${book.annotationsCount} imported annotations`}
                        position="top"
                        withArrow
                      >
                        <IconHighlight stroke={1.5} size={16} />
                      </Tooltip>
                      <span className={style.Attribute}>{book.annotationsCount} annotations</span>
                    </Group>
                  )}
                  <Group wrap="nowrap" gap={8}>
                    <Tooltip label="Progress" position="top" withArrow>
                      <IconProgress stroke={1.5} size={16} />
                    </Tooltip>
                    <span className={style.Attribute}>{book.readLabel} read</span>
                  </Group>
                </>
              )}
            </Box>
          </Box>
        );
      })}
    </div>
  );
}
