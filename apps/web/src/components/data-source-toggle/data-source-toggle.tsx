import { SegmentedControl } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { JSX } from 'react';

export type DataSource = 'ebook' | 'audiobook' | 'both';

interface DataSourceToggleProps {
  value: DataSource;
  onChange: (source: DataSource) => void;
}

export function DataSourceToggle({ value, onChange }: DataSourceToggleProps): JSX.Element {
  return (
    <SegmentedControl
      value={value}
      onChange={(v) => onChange(v as DataSource)}
      data={[
        { value: 'both', label: 'Both' },
        { value: 'ebook', label: 'E-books' },
        { value: 'audiobook', label: 'Audiobooks' },
      ]}
      size="sm"
    />
  );
}

export function useDataSource(pageKey: string) {
  return useLocalStorage<DataSource>({
    key: `koinsight-datasource-${pageKey}`,
    defaultValue: 'both',
  });
}
