import { AbsBook, updateAbsBook } from '../../api/audiobookshelf';
import { Button, Flex, NumberInput, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { mutate } from 'swr';

export function AbsBookPlaybackSpeed({ book }: { book: AbsBook }) {
  const [speed, setSpeed] = useState(book.playback_speed ?? 1.5);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateAbsBook(book.id, { playback_speed: speed || null });
      await mutate(`abs-book-${book.id}`);
      notifications.show({
        title: 'Playback speed updated',
        message: `"${book.title}" playback speed updated successfully.`,
        color: 'green',
        position: 'top-center',
      });
    } catch {
      notifications.show({
        title: 'Failed to update playback speed',
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
        Playback speed
      </Title>
      <Text size="sm" mb="md" maw="80%" lh="xl">
        Set the playback speed you use for this audiobook. This is used to correctly estimate pages
        read from your listening time. Defaults to 1.5× if not set.
      </Text>
      <Flex gap="md">
        <NumberInput
          min={0.25}
          max={4}
          step={0.25}
          decimalScale={2}
          value={speed}
          onChange={(e) => setSpeed(Number(e))}
        />
        <Button variant="subtle" loading={loading} onClick={handleUpdate}>
          Update playback speed
        </Button>
      </Flex>
    </div>
  );
}
