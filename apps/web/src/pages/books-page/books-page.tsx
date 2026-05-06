import { Book, BookWithData } from '@koinsight/common/types';
import {
  Button,
  Checkbox,
  Flex,
  Group,
  Loader,
  Modal,
  Select,
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
import { JSX, useState } from 'react';
import { useAbsBooks } from '../../api/audiobookshelf';
import { useBooks } from '../../api/books';
import {
  DataSourceToggle,
  useDataSource,
} from '../../components/data-source-toggle/data-source-toggle';
import { EmptyState } from '../../components/empty-state/empty-state';
import { AbsBooksSection } from './abs-books-section';
import { BooksCards } from './books-cards';
import { BooksTable } from './books-table';

import style from './books-page.module.css';

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

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useLocalStorage<{
    key: keyof BookWithData;
    direction: 'asc' | 'desc';
  }>({
    key: 'koinsight-books-sort',
    defaultValue: {
      key: 'last_open',
      direction: 'desc',
    },
  });

  const { data: books, isLoading, error } = useBooks({ showHidden: showHiddenBooks });
  const { data: absBooks, isLoading: absLoading } = useAbsBooks();

  const visibleBooks =
    searchTerm.length === 0
      ? (books ?? [])
      : (books ?? []).filter((book) =>
          [book.title, book.authors, book.series]
            .map((value) => value?.toLowerCase())
            .some((v) => v?.includes(searchTerm.toLowerCase()))
        );

  const sortedBooks = visibleBooks.sort((a, b) => {
    const { key: sort, direction } = sortBy;
    const aVal = a[sort];
    const bVal = b[sort];

    if (aVal === null) return 1;
    if (bVal === null) return -1;

    const dir = direction === 'asc' ? 1 : -1;
    if (aVal < bVal) return -1 * dir;
    if (aVal > bVal) return 1 * dir;
    return 0;
  });

  const showEbooks = dataSource === 'ebook' || dataSource === 'both';
  const showAudiobooks = dataSource === 'audiobook' || dataSource === 'both';

  if (error && dataSource === 'ebook') {
    return <Flex justify="center">Failed to load books</Flex>;
  }

  if (isLoading && showEbooks) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <>
      <Flex justify="space-between" align="center" mb="xl" wrap="wrap" gap="sm">
        <Title>Books</Title>
        <DataSourceToggle value={dataSource} onChange={setDataSource} />
      </Flex>

      {showEbooks && (
        <>
          {(books ?? []).length === 0 && !isLoading ? (
            <EmptyState
              title="No books yet"
              description="Upload a statistics database or sync via WebDAV to get started."
            />
          ) : (
            <>
              <div className={style.Controls}>
                <Flex gap="md">
                  <TextInput
                    placeholder="Search books..."
                    w={media ? '100%' : 300}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    rightSection={
                      searchTerm.length > 0 ? (
                        <IconX
                          size={14}
                          onClick={() => setSearchTerm('')}
                          style={{ cursor: 'pointer' }}
                        />
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
                        setSortBy({
                          key: sortBy.key,
                          direction: sortBy.direction === 'asc' ? 'desc' : 'asc',
                        })
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
                      w={150}
                      value={sortBy.key}
                      allowDeselect={false}
                      onChange={(value) =>
                        setSortBy((prev) => ({ ...prev, key: value as keyof Book }))
                      }
                      data={
                        [
                          { label: 'Added', value: 'id' },
                          { label: 'Title', value: 'title' },
                          { label: 'Author', value: 'authors' },
                          { label: 'Read time', value: 'total_read_time' },
                          { label: 'Last open', value: 'last_open' },
                        ] as { label: string; value: keyof Book }[]
                      }
                      defaultValue="title"
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
              {mode === 'table' ? (
                <BooksTable books={sortedBooks} />
              ) : (
                <BooksCards books={sortedBooks} />
              )}
            </>
          )}
        </>
      )}

      {showAudiobooks && (
        <AbsBooksSection
          books={absBooks ?? []}
          isLoading={absLoading}
          showTitle={dataSource === 'both'}
        />
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
        <Checkbox
          checked={showHiddenBooks}
          onChange={(v) => setShowHiddenBooks(v.target.checked)}
          label="View hidden books"
        />
      </Modal>
    </>
  );
}
