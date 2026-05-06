import { Book } from '@koinsight/common/types';
import { Button, Flex, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { mutate } from 'swr';
import { updateBookSeries } from '../../../api/books';

export function BookSeries({ book }: { book: Book }) {
  const [series, setSeries] = useState(book.series ?? '');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateBookSeries(book.id, series || null);
      await mutate((key) => Array.isArray(key) && key[0] === 'books', undefined, { revalidate: true });
      await mutate(`books/${book.id}`);
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
        Override the series for this book. Leave blank to remove it.
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
