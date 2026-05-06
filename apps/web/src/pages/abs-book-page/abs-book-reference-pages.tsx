import { AbsBook, updateAbsBook } from '../../api/audiobookshelf';
import { Button, Flex, NumberInput, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { mutate } from 'swr';

export function AbsBookReferencePages({ book }: { book: AbsBook }) {
  const [referencePages, setReferencePages] = useState(book.reference_pages ?? 0);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateAbsBook(book.id, { reference_pages: referencePages || null });
      await mutate(`abs-book-${book.id}`);
      notifications.show({
        title: 'Reference page count updated',
        message: `"${book.title}" reference page count updated successfully.`,
        color: 'green',
        position: 'top-center',
      });
    } catch {
      notifications.show({
        title: 'Failed to update reference page count',
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
        Reference page count
      </Title>
      <Text size="sm" mb="md" maw="80%" lh="xl">
        Set the total page count for this audiobook to enable estimated pages read in your reading
        statistics. KoInsight will calculate estimated pages based on your listening progress
        through the book.
      </Text>
      <Flex gap="md">
        <NumberInput
          min={0}
          value={referencePages}
          onChange={(e) => setReferencePages(Number(e))}
        />
        <Button variant="subtle" loading={loading} onClick={handleUpdate}>
          Update reference pages
        </Button>
      </Flex>
    </div>
  );
}
