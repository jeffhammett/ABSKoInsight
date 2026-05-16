import { Book, BookWithData } from '@koinsight/common/types';
import { useBooks, mergeBooks } from '../../../api/books';
import { Button, Combobox, InputBase, Text, Title, useCombobox } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconGitMerge } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { mutate } from 'swr';
import { RoutePath } from '../../../routes';

export function BookMerge({ book }: { book: BookWithData }) {
  const { data: allBooks } = useBooks({ showHidden: true });
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });

  const candidates = (allBooks ?? []).filter(
    (b: Book) => b.id !== book.id && !b.soft_deleted
  );

  const filtered = candidates.filter((b: Book) =>
    b.title.toLowerCase().includes(search.toLowerCase())
  );

  const selectedBook = candidates.find((b: Book) => b.id === sourceId);

  const openConfirm = () => {
    if (!selectedBook) return;
    modals.openConfirmModal({
      title: 'Merge books?',
      centered: true,
      children: (
        <Text size="sm">
          All reading sessions and stats from{' '}
          <strong>"{selectedBook.title}"</strong> will be moved into{' '}
          <strong>"{book.title}"</strong>. The source book will be hidden. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Merge', cancel: 'Cancel' },
      confirmProps: { color: 'violet' },
      onConfirm: handleMerge,
    });
  };

  const handleMerge = async () => {
    if (!selectedBook) return;
    setLoading(true);
    try {
      await mergeBooks(book.id, selectedBook.id);
      await mutate((key) => typeof key === 'string' && key.startsWith('books/'));
      await mutate(['books', false]);
      notifications.show({
        title: 'Books merged',
        message: `Stats from "${selectedBook.title}" have been merged into "${book.title}".`,
        color: 'green',
        position: 'top-center',
      });
      navigate(RoutePath.HOME);
    } catch {
      notifications.show({
        title: 'Merge failed',
        message: 'Could not merge the books.',
        color: 'red',
        position: 'top-center',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title order={3} mb="xs">
        Merge from another book
      </Title>
      <Text size="sm" c="dimmed" mb="md" lh="xl">
        Move all reading sessions and stats from an older entry into this book. Use this when a
        file was re-synced with a slightly different checksum and shows up as a duplicate. The
        source book will be hidden after the merge.
      </Text>

      <Combobox
        store={combobox}
        onOptionSubmit={(val) => {
          setSourceId(Number(val));
          setSearch('');
          combobox.closeDropdown();
        }}
      >
        <Combobox.Target>
          <InputBase
            w={340}
            placeholder="Search for source book…"
            value={search || (selectedBook ? selectedBook.title : '')}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setSourceId(null);
              combobox.openDropdown();
            }}
            onClick={() => combobox.openDropdown()}
            onFocus={() => combobox.openDropdown()}
            rightSection={<Combobox.Chevron />}
            rightSectionPointerEvents="none"
          />
        </Combobox.Target>

        <Combobox.Dropdown>
          <Combobox.Options mah={200} style={{ overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <Combobox.Empty>No books found</Combobox.Empty>
            ) : (
              filtered.map((b: BookWithData) => (
                <Combobox.Option key={b.id} value={String(b.id)}>
                  {b.title}
                  {b.authors ? (
                    <Text span size="xs" c="dimmed" ml={6}>
                      {b.authors}
                    </Text>
                  ) : null}
                </Combobox.Option>
              ))
            )}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>

      <Button
        mt="md"
        color="violet"
        leftSection={<IconGitMerge size={16} />}
        disabled={sourceId === null}
        loading={loading}
        onClick={openConfirm}
      >
        Merge into this book
      </Button>
    </div>
  );
}
