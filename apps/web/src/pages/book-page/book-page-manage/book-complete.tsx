import { Book } from '@koinsight/common/types';
import { Switch, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { mutate } from 'swr';
import { completeBook } from '../../../api/books';

export type BookCompleteProps = {
  book: Book;
};

export function BookComplete({ book }: BookCompleteProps) {
  const [loading, setLoading] = useState(false);

  const onUpdate = async (completed: boolean) => {
    try {
      setLoading(true);
      await completeBook(book.id, completed);
      await mutate('books');
      await mutate(`books/${book.id}`);
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
        Mark this book as completed regardless of pages read. The progress ring will show 100% but
        your actual reading stats are unchanged.
      </Text>
      <Switch
        disabled={loading}
        label="Completed"
        checked={book.completed_override}
        onChange={(e) => onUpdate(e.target.checked)}
      />
    </div>
  );
}
