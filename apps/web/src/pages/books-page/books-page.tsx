import { BookWithData } from '@koinsight/common/types';
import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Flex,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import {
  IconArrowsDownUp,
  IconCards,
  IconFilter,
  IconSortAscending,
  IconSortDescending,
  IconTable,
  IconX,
} from '@tabler/icons-react';
import { JSX, useMemo, useState } from 'react';
import { AbsBook, useAbsBooks } from '../../api/audiobookshelf';
import { useBooks } from '../../api/books';
import {
  DataSourceToggle,
  useDataSource,
} from '../../components/data-source-toggle/data-source-toggle';
import { EmptyState } from '../../components/empty-state/empty-state';
import { getSeriesPath } from '../../routes';
import { BooksCards } from './books-cards';
import { BooksTable, UnifiedBook } from './books-table';
import { NavLink } from 'react-router';

import style from './books-page.module.css';

type SortKey = 'title' | 'authors' | 'totalReadTime' | 'lastActivityMs' | 'progressPct';

import { displaySeriesName, normalizeSeries } from '../../utils/series';

function ebookToUnified(book: BookWithData): UnifiedBook {
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
}

function absBookToUnified(book: AbsBook): UnifiedBook {
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
    lastActivityMs: hasProgress ? (book.lastUpdate ?? book.addedAt ?? 0) : 0,
    completed: !!book.completed,
  };
}

export function BooksPage(): JSX.Element {
  const media = useMediaQuery(`(max-width: 62em)`);
  const [dataSource, setDataSource] = useDataSource('books');

  const [mode, setMode] = useLocalStorage<'table' | 'cards'>({
    key: 'koinsight-books-search',
    defaultValue: 'table',
  });

  const [viewAdvancedFilters, { open: openAdvancedFilters, close: closeAdvancedFilters }] =
    useDisclosure(false);

  const [showHiddenBooks, setShowHiddenBooks] = useLocalStorage<boolean>({
    key: 'koinsight-hidden-books',
    defaultValue: false,
  });

  const [groupBySeries, setGroupBySeries] = useLocalStorage<boolean>({
    key: 'koinsight-group-by-series',
    defaultValue: false,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useLocalStorage<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'koinsight-books-sort-v2',
    defaultValue: { key: 'lastActivityMs', direction: 'desc' },
  });

  const { data: ebooks, isLoading: ebooksLoading, error } = useBooks({ showHidden: showHiddenBooks });
  const { data: absBooks, isLoading: absLoading } = useAbsBooks({ showHidden: showHiddenBooks });

  const showEbooks = dataSource === 'ebook' || dataSource === 'both';
  const showAudiobooks = dataSource === 'audiobook' || dataSource === 'both';

  const unifiedBooks: UnifiedBook[] = [
    ...(showEbooks ? (ebooks ?? []).map(ebookToUnified) : []),
    ...(showAudiobooks ? (absBooks ?? []).map(absBookToUnified) : []),
  ];

  const filtered =
    searchTerm.length === 0
      ? unifiedBooks
      : unifiedBooks.filter((book) =>
          [book.title, book.authors, book.series]
            .map((v) => v?.toLowerCase())
            .some((v) => v?.includes(searchTerm.toLowerCase()))
        );

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortBy.direction === 'asc' ? 1 : -1;
    switch (sortBy.key) {
      case 'title':
        return a.title.localeCompare(b.title) * dir;
      case 'authors':
        return (a.authors ?? '').localeCompare(b.authors ?? '') * dir;
      case 'totalReadTime':
        return (a.totalReadTime - b.totalReadTime) * dir;
      case 'lastActivityMs':
        return (a.lastActivityMs - b.lastActivityMs) * dir;
      case 'progressPct':
        return (a.progressPct - b.progressPct) * dir;
      default:
        return 0;
    }
  });

  // Group by series
  const grouped = useMemo(() => {
    if (!groupBySeries) return null;
    const groups = new Map<string, UnifiedBook[]>();
    for (const book of sorted) {
      const key = normalizeSeries(book.series) || '__ungrouped__';
      const display = book.series || 'No series';
      const existing = groups.get(key);
      if (existing) {
        existing.push(book);
      } else {
        groups.set(key, [book]);
      }
    }
    return Array.from(groups.entries()).map(([key, books]) => ({
      key,
      name: displaySeriesName(books[0].series) || 'No series',
      books,
    })).sort((a, b) => {
      if (a.key === '__ungrouped__') return 1;
      if (b.key === '__ungrouped__') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [groupBySeries, sorted]);

  const isLoading = (showEbooks && ebooksLoading) || (showAudiobooks && absLoading);

  if (error && dataSource === 'ebook') {
    return <Flex justify="center">Failed to load books</Flex>;
  }

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (unifiedBooks.length === 0) {
    return (
      <>
        <Flex justify="space-between" align="center" mb="xl" wrap="wrap" gap="sm">
          <Title>Books</Title>
          <DataSourceToggle value={dataSource} onChange={setDataSource} />
        </Flex>
        <EmptyState
          title="No books yet"
          description="Upload a statistics database, sync via WebDAV, or configure AudioBookShelf in Settings."
        />
      </>
    );
  }

  const sortOptions: { label: string; value: SortKey }[] = [
    { label: 'Last open', value: 'lastActivityMs' },
    { label: 'Title', value: 'title' },
    { label: 'Author', value: 'authors' },
    { label: 'Read time', value: 'totalReadTime' },
    { label: 'Completion %', value: 'progressPct' },
  ];

  return (
    <>
      <Flex justify="space-between" align="center" mb="xl" wrap="wrap" gap="sm">
        <Title>Books</Title>
        <DataSourceToggle value={dataSource} onChange={setDataSource} />
      </Flex>

      <div className={style.Controls}>
        <Flex gap="md">
          <TextInput
            placeholder="Search books..."
            w={media ? '100%' : 300}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            rightSection={
              searchTerm.length > 0 ? (
                <IconX size={14} onClick={() => setSearchTerm('')} style={{ cursor: 'pointer' }} />
              ) : null
            }
          />
          <Tooltip label="Advanced filters" openDelay={1000} position="top" withArrow>
            <Button variant="default" onClick={openAdvancedFilters}>
              <IconFilter size={14} />
            </Button>
          </Tooltip>
        </Flex>
        <Group align="center">
          <Tooltip
            openDelay={1000}
            label={`Sort ${sortBy.direction === 'asc' ? 'descending' : 'ascending'}`}
            position="top"
            withArrow
          >
            <Button
              variant="default"
              onClick={() =>
                setSortBy({ key: sortBy.key, direction: sortBy.direction === 'asc' ? 'desc' : 'asc' })
              }
            >
              {sortBy.direction === 'asc' ? (
                <IconSortAscending size={18} />
              ) : (
                <IconSortDescending size={18} />
              )}
            </Button>
          </Tooltip>
          <Tooltip label="Sort by" openDelay={1000} position="top" withArrow>
            <Select
              leftSection={<IconArrowsDownUp size={16} />}
              w={160}
              value={sortBy.key}
              allowDeselect={false}
              onChange={(value) => {
                const key = value as SortKey;
                setSortBy({
                  key,
                  direction: key === 'progressPct' ? 'desc' : sortBy.direction,
                });
              }}
              data={sortOptions}
            />
          </Tooltip>
          <Button.Group variant="default">
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
        </Group>
      </div>

      {mode === 'table' || dataSource !== 'ebook' ? (
        grouped ? (
          <Stack gap="xl">
            {grouped.map(({ key, name, books }) => (
              <div key={key}>
                <Flex align="center" gap="sm" mb="xs">
                  {key !== '__ungrouped__' ? (
                    <NavLink
                      to={getSeriesPath(name)}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Text fw={700} size="lg">
                        {name}
                      </Text>
                    </NavLink>
                  ) : (
                    <Text fw={700} size="lg" c="dimmed">
                      {name}
                    </Text>
                  )}
                  <Badge variant="light" size="sm">
                    {books.length}
                  </Badge>
                </Flex>
                <BooksTable books={books} />
                <Divider mt="md" />
              </div>
            ))}
          </Stack>
        ) : (
          <BooksTable books={sorted} />
        )
      ) : (
        <BooksCards books={sorted} />
      )}

      <Modal
        opened={viewAdvancedFilters}
        onClose={closeAdvancedFilters}
        title="Advanced filters"
        styles={{
          title: {
            fontSize: 'var(--mantine-font-size-xl)',
            fontWeight: 700,
            fontFamily: 'Noto Sans',
            paddingTop: 'var(--mantine-spacing-xs)',
          },
        }}
        radius="lg"
        centered
      >
        <Stack gap="md">
          <Checkbox
            checked={showHiddenBooks}
            onChange={(v) => setShowHiddenBooks(v.target.checked)}
            label="View hidden books"
          />
          <Checkbox
            checked={groupBySeries}
            onChange={(v) => setGroupBySeries(v.target.checked)}
            label="Group by series"
          />
        </Stack>
      </Modal>
    </>
  );
}
