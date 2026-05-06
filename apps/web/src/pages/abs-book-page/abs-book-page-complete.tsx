import { Switch, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { mutate } from 'swr';
import { AbsBook, updateAbsBook } from '../../api/audiobookshelf';

export function AbsBookComplete({ book }: { book: AbsBook }) {
  const [loading, setLoading] = useState(false);

  const onUpdate = async (completed: boolean) => {
    try {
      setLoading(true);
      await updateAbsBook(book.id, { completed });
      await mutate((key) => Array.isArray(key) && key[0] === 'abs-books', undefined, {
        revalidate: true,
      });
      await mutate(`abs-book-${book.id}`, undefined, { revalidate: true });
      notifications.show({
        title: completed ? 'Marked as completed' : 'Completion removed',
        message: `"${book.title}" ${completed ? 'marked as completed' : 'marked as not completed'}.`,
        color: 'green',
        position: 'top-center',
      });
    } catch {
      notifications.show({
        title: 'Failed',
        message: 'Failed to update completion status.',
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
        Mark as completed
      </Title>
      <Text size="sm" mb="md" lh="xl">
        Mark this audiobook as completed regardless of listening progress. The progress ring will
        show 100% but your actual listening stats are unchanged.
      </Text>
      <Switch
        disabled={loading}
        label="Completed"
        checked={book.completed}
        onChange={(e) => onUpdate(e.target.checked)}
      />
    </div>
  );
}
