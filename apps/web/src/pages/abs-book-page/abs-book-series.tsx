import { AbsBook, updateAbsBook } from '../../api/audiobookshelf';
import { Button, Flex, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { mutate } from 'swr';

export function AbsBookSeries({ book }: { book: AbsBook }) {
  const [series, setSeries] = useState(book.series ?? '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateAbsBook(book.id, { series: series || null });
      await mutate((key) => Array.isArray(key) && key[0] === 'abs-books', undefined, { revalidate: true });
      await mutate(`abs-book-${book.id}`);
      notifications.show({
        title: 'Series updated',
        message: series ? `Series set to "${series}".` : 'Series removed.',
        color: 'green',
        position: 'top-center',
      });
    } catch {
      notifications.show({
        title: 'Failed to update series',
        message: '',
        color: 'red',
        position: 'top-center',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title order={3} mb="md">
        Series
      </Title>
      <Text size="sm" mb="md" maw="80%" lh="xl">
        Override the series for this audiobook. Leave blank to remove it.
      </Text>
      <Flex gap="md">
        <TextInput
          placeholder="Series name"
          value={series}
          onChange={(e) => setSeries(e.target.value)}
        />
        <Button variant="subtle" loading={loading} onClick={handleUpdate}>
          Update series
        </Button>
      </Flex>
    </div>
  );
}
