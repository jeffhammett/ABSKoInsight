import { BookWithData } from '@koinsight/common/types';
import {
  Badge,
  Flex,
  Loader,
  Progress,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { JSX, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { AbsBook, useAbsBooks } from '../../api/audiobookshelf';
import { useBooks } from '../../api/books';
import {
  DataSourceToggle,
  useDataSource,
} from '../../components/data-source-toggle/data-source-toggle';
import { EmptyState } from '../../components/empty-state/empty-state';
import { getSeriesPath } from '../../routes';

function normalizeSeries(name: string | null | undefined): string {
  if (!name || name === 'N/A') return '';
  return name.toLowerCase().replace(/^the\s+/, '').replace(/\s+#\d+(\.\d+)?$/, '').trim();
}

function displaySeriesName(name: string | null | undefined): string {
  if (!name || name === 'N/A') return '';
  return name.replace(/\s+#\d+(\.\d+)?$/, '').trim();
}

type SeriesEntry = {
  key: string;
  name: string;
  ebookCount: number;
  audiobookCount: number;
  completedCount: number;
  totalCount: number;
  completionPct: number;
  lastActivityMs: number;
};

function buildSeriesMap(
  ebooks: BookWithData[],
  absBooks: AbsBook[],
  showEbooks: boolean,
  showAudiobooks: boolean
): SeriesEntry[] {
  const map = new Map<string, SeriesEntry>();

  const ensure = (series: string): SeriesEntry => {
    const key = normalizeSeries(series);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: displaySeriesName(series),
        ebookCount: 0,
        audiobookCount: 0,
        completedCount: 0,
        totalCount: 0,
        completionPct: 0,
        lastActivityMs: 0,
      });
    }
    return map.get(key)!;
  };

  if (showEbooks) {
    for (const b of ebooks) {
      if (!b.series || !normalizeSeries(b.series)) continue;
      const entry = ensure(b.series);
      entry.ebookCount++;
      entry.totalCount++;
      const isComplete =
        b.completed_override ||
        (b.total_pages > 0 && b.unique_read_pages >= b.total_pages);
      if (isComplete) entry.completedCount++;
      const lastMs = (b.last_open ?? 0) * 1000;
      if (lastMs > entry.lastActivityMs) entry.lastActivityMs = lastMs;
    }
  }

  if (showAudiobooks) {
    for (const b of absBooks) {
      if (!b.series || !normalizeSeries(b.series)) continue;
      const entry = ensure(b.series);
      entry.audiobookCount++;
      entry.totalCount++;
      if (b.completed || b.isFinished || b.progress >= 1) entry.completedCount++;
      const lastMs = b.lastUpdate ?? b.addedAt ?? 0;
      if (lastMs > entry.lastActivityMs) entry.lastActivityMs = lastMs;
    }
  }

  return Array.from(map.values()).map((e) => ({
    ...e,
    completionPct: e.totalCount > 0 ? Math.round((e.completedCount / e.totalCount) * 100) : 0,
  }));
}

export function SeriesListPage(): JSX.Element {
  const [dataSource, setDataSource] = useDataSource('series');
  const [searchTerm, setSearchTerm] = useState('');

  const showEbooks = dataSource === 'ebook' || dataSource === 'both';
  const showAudiobooks = dataSource === 'audiobook' || dataSource === 'both';

  const { data: ebooks = [], isLoading: ebooksLoading } = useBooks();
  const { data: absBooks = [], isLoading: absLoading } = useAbsBooks();

  const isLoading = (showEbooks && ebooksLoading) || (showAudiobooks && absLoading);

  const allSeries = useMemo(
    () => buildSeriesMap(ebooks, absBooks, showEbooks, showAudiobooks),
    [ebooks, absBooks, showEbooks, showAudiobooks]
  );

  const filtered = useMemo(() => {
    const list = searchTerm
      ? allSeries.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : allSeries;
    return [...list].sort((a, b) => b.lastActivityMs - a.lastActivityMs);
  }, [allSeries, searchTerm]);

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <>
      <Flex justify="space-between" align="center" mb="xl" wrap="wrap" gap="sm">
        <Title>Series</Title>
        <DataSourceToggle value={dataSource} onChange={setDataSource} />
      </Flex>

      <TextInput
        placeholder="Search series..."
        mb="md"
        w={300}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        rightSection={
          searchTerm ? (
            <IconX size={14} onClick={() => setSearchTerm('')} style={{ cursor: 'pointer' }} />
          ) : null
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No series found"
          description="Add series metadata to your books to see them grouped here."
        />
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Series</Table.Th>
              <Table.Th>Books</Table.Th>
              <Table.Th>Progress</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((series) => (
              <Table.Tr key={series.key}>
                <Table.Td>
                  <Stack gap={4}>
                    <NavLink
                      to={getSeriesPath(series.name)}
                      style={{ textDecoration: 'none', color: 'inherit', fontWeight: 700 }}
                    >
                      {series.name}
                    </NavLink>
                    <Flex gap={4}>
                      {series.ebookCount > 0 && (
                        <Badge size="xs" color="teal" variant="light">
                          {series.ebookCount} ebook{series.ebookCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {series.audiobookCount > 0 && (
                        <Badge size="xs" color="violet" variant="light">
                          {series.audiobookCount} audiobook{series.audiobookCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </Flex>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {series.completedCount} / {series.totalCount} completed
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Flex align="center" gap="sm">
                    <Progress value={series.completionPct} w={100} size="sm" />
                    <Text size="sm">{series.completionPct}%</Text>
                  </Flex>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
