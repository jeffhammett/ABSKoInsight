import { Button, Flex, Loader, Progress, Text, Title, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { IconCards, IconTable } from '@tabler/icons-react';
import { JSX, useMemo } from 'react';
import { useParams } from 'react-router';
import { useAbsBooks } from '../../api/audiobookshelf';
import { useBooks } from '../../api/books';
import { BooksCards } from '../books-page/books-cards';
import { BooksTable, UnifiedBook } from '../books-page/books-table';

import { normalizeSeries, getSeriesSequence } from '../../utils/series';

export function SeriesPage(): JSX.Element {
  const { name } = useParams() as { name: string };
  const seriesName = decodeURIComponent(name);
  const normalizedTarget = normalizeSeries(seriesName);

  const { data: ebooks, isLoading: ebooksLoading } = useBooks();
  const { data: absBooks, isLoading: absLoading } = useAbsBooks();

  const seriesEbooks = useMemo(
    () => (ebooks ?? [])
      .filter((b) => normalizeSeries(b.series) === normalizedTarget)
      .sort((a, b) => getSeriesSequence(a.series) - getSeriesSequence(b.series)),
    [ebooks, normalizedTarget]
  );

  const seriesAbs = useMemo(
    () => (absBooks ?? [])
      .filter((b) => normalizeSeries(b.series) === normalizedTarget)
      .sort((a, b) => getSeriesSequence(a.series) - getSeriesSequence(b.series)),
    [absBooks, normalizedTarget]
  );

  const [mode, setMode] = useLocalStorage<'table' | 'cards'>({
    key: 'koinsight-series-detail-mode',
    defaultValue: 'table',
  });

  const unifiedBooks = useMemo((): UnifiedBook[] => {
    const ebooks: UnifiedBook[] = seriesEbooks.map((book) => {
      const rawPct = book.total_pages > 0 ? (book.unique_read_pages / book.total_pages) * 100 : 0;
      return {
        key: `ebook-${book.id}`,
        source: 'ebook',
        title: book.title,
        authors: book.authors,
        series: book.series,
        ebookId: book.id,
        soft_deleted: book.soft_deleted,
        annotationsCount: book.annotations.length,
        progressPct: book.completed_override ? 100 : rawPct,
        readLabel: book.completed_override ? '100%' : `${Math.round(rawPct)}%`,
        totalPages: String(book.total_pages),
        totalReadTime: book.total_read_time ?? 0,
        lastActivityMs: (book.last_open ?? 0) * 1000,
        completed: !!book.completed_override,
      };
    });
    const absBooks: UnifiedBook[] = seriesAbs.map((book) => {
      const hasProgress = book.progress > 0;
      return {
        key: `abs-${book.id}`,
        source: 'audiobook',
        title: book.title,
        authors: book.authors || null,
        series: book.series,
        absItemId: book.id,
        soft_deleted: false,
        annotationsCount: 0,
        progressPct: book.completed ? 100 : book.progress * 100,
        readLabel: book.completed ? '100%' : `${Math.round(book.progress * 100)}%`,
        totalPages: book.reference_pages ? String(book.reference_pages) : 'N/A',
        totalReadTime: book.listeningTime ?? 0,
        lastActivityMs: book.lastUpdate ?? 0,
        completed: !!book.completed,
      };
    });
    return [...ebooks, ...absBooks].sort(
      (a, b) => getSeriesSequence(a.series) - getSeriesSequence(b.series)
    );
  }, [seriesEbooks, seriesAbs]);

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
      <Flex justify="space-between" align="flex-start" mb="xs" wrap="wrap" gap="sm">
        <Title>{seriesName}</Title>
        <Button.Group>
          <Tooltip label="Table view" position="top" withArrow>
            <Button
              variant={mode === 'table' ? 'filled' : 'default'}
              onClick={() => setMode('table')}
            >
              <IconTable size={16} />
            </Button>
          </Tooltip>
          <Tooltip label="Cards view" position="top" withArrow>
            <Button
              variant={mode === 'cards' ? 'filled' : 'default'}
              onClick={() => setMode('cards')}
            >
              <IconCards size={16} />
            </Button>
          </Tooltip>
        </Button.Group>
      </Flex>
      <Flex align="center" gap="md" mb="xl">
        <Text c="dimmed" size="sm">
          {totalCompleted} of {totalBooks} {totalBooks === 1 ? 'book' : 'books'} completed ({completionPct}%)
        </Text>
        <Progress value={completionPct} w={120} size="sm" />
      </Flex>

      {mode === 'cards' ? (
        totalBooks === 0 ? (
          <Text c="dimmed">No books found for this series.</Text>
        ) : (
          <BooksCards books={unifiedBooks} />
        )
      ) : null}

      {mode === 'table' && totalBooks === 0 && (
        <Text c="dimmed">No books found for this series.</Text>
      )}

      {mode === 'table' && totalBooks > 0 && <BooksTable books={unifiedBooks} />}
    </>
  );
}
