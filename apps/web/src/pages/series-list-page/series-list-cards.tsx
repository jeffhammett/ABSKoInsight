import { Badge, Box, Flex, Progress, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { JSX } from 'react';
import { useNavigate } from 'react-router';
import { getSeriesPath } from '../../routes';

export type SeriesCardEntry = {
  key: string;
  name: string;
  ebookCount: number;
  audiobookCount: number;
  completedCount: number;
  totalCount: number;
  completionPct: number;
};

type SeriesListCardsProps = {
  series: SeriesCardEntry[];
};

export function SeriesListCards({ series }: SeriesListCardsProps): JSX.Element {
  const navigate = useNavigate();
  const isSmallScreen = useMediaQuery(`(max-width: 62em)`);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${isSmallScreen ? 160 : 220}px, 1fr))`,
        gap: 'var(--mantine-spacing-md)',
      }}
    >
      {series.map((s) => (
        <Box
          key={s.key}
          onClick={() => navigate(getSeriesPath(s.name))}
          role="button"
          style={{
            cursor: 'pointer',
            borderRadius: 'var(--mantine-radius-md)',
            border: '1px solid var(--mantine-color-default-border)',
            overflow: 'hidden',
          }}
        >
          <Box
            style={{
              background: 'var(--mantine-color-violet-light)',
              padding: 'var(--mantine-spacing-md)',
              minHeight: 80,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Text fw={700} size="md" style={{ wordBreak: 'break-word' }}>
              {s.name}
            </Text>
          </Box>
          <Progress radius={0} h={4} value={s.completionPct} color="violet" />
          <Box p="sm">
            <Flex gap={4} mb={6} wrap="wrap">
              {s.ebookCount > 0 && (
                <Badge size="xs" color="teal" variant="light">
                  {s.ebookCount} ebook{s.ebookCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {s.audiobookCount > 0 && (
                <Badge size="xs" color="violet" variant="light">
                  {s.audiobookCount} audiobook{s.audiobookCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </Flex>
            <Text size="xs" c="dimmed">
              {s.completedCount}/{s.totalCount} completed ({s.completionPct}%)
            </Text>
          </Box>
        </Box>
      ))}
    </div>
  );
}
