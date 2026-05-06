import { AbsBook, updateAbsBook, uploadAbsBookCover } from '../../api/audiobookshelf';
import { AbsBookComplete } from './abs-book-page-complete';
import { AbsBookReferencePages } from './abs-book-reference-pages';
import { Button, FileInput, Flex, Switch, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { mutate } from 'swr';
import { RoutePath } from '../../routes';

export function AbsBookPageManage({
  book,
  onCoverUploaded,
}: {
  book: AbsBook;
  onCoverUploaded: () => void;
}) {
  const navigate = useNavigate();

  // Cover upload
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);

  const handleCoverUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!coverFile) return;
    setCoverLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', coverFile);
      const res = await uploadAbsBookCover(book.id, formData);
      if (res.ok) {
        notifications.show({
          title: 'Cover updated',
          message: 'Cover image replaced successfully.',
          color: 'green',
          position: 'top-center',
        });
        setCoverFile(null);
        onCoverUploaded();
      } else {
        notifications.show({
          title: 'Upload failed',
          message: 'Failed to upload cover.',
          color: 'red',
          position: 'top-center',
        });
      }
    } catch {
      notifications.show({
        title: 'Upload failed',
        message: 'An error occurred during upload.',
        color: 'red',
        position: 'top-center',
      });
    } finally {
      setCoverLoading(false);
    }
  };

  // Hide toggle
  const [hideLoading, setHideLoading] = useState(false);

  const handleHide = async (hidden: boolean) => {
    setHideLoading(true);
    try {
      await updateAbsBook(book.id, { hidden });
      await mutate((key) => Array.isArray(key) && key[0] === 'abs-books', undefined, {
        revalidate: true,
      });
      notifications.show({
        title: hidden ? 'Book hidden' : 'Book shown',
        message: `"${book.title}" ${hidden ? 'hidden' : 'shown'} successfully.`,
        color: 'green',
        position: 'top-center',
      });
    } catch {
      notifications.show({
        title: 'Failed',
        message: `Failed to ${hidden ? 'hide' : 'show'} the book.`,
        color: 'red',
        position: 'top-center',
      });
    } finally {
      setHideLoading(false);
    }
  };

  // Delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  const openDeleteConfirm = () =>
    modals.openConfirmModal({
      title: 'Remove book?',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to remove <strong>"{book.title}"</strong> from KoInsight? This
          hides it permanently from your library. Your progress in AudioBookShelf is not affected.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: "No, keep it" },
      confirmProps: { color: 'red' },
      onConfirm: handleDelete,
    });

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await updateAbsBook(book.id, { deleted: true });
      await mutate((key) => Array.isArray(key) && key[0] === 'abs-books', undefined, {
        revalidate: true,
      });
      navigate(RoutePath.HOME);
      notifications.show({
        title: 'Book removed',
        message: `"${book.title}" removed from KoInsight.`,
        color: 'green',
        position: 'top-center',
      });
    } catch {
      notifications.show({
        title: 'Failed',
        message: 'Failed to remove the book.',
        color: 'red',
        position: 'top-center',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Flex direction="column" align="flex-start" gap="xl">
      {/* Cover upload */}
      <div>
        <Title order={3} mb="md">
          Upload cover
        </Title>
        <form onSubmit={handleCoverUpload} encType="multipart/form-data">
          <Flex align="flex-end" gap="md">
            <FileInput
              w={200}
              placeholder="cover.png"
              value={coverFile}
              onChange={setCoverFile}
              accept=".png,.jpg,.jpeg,.gif"
            />
            <Button
              type="submit"
              color="violet"
              disabled={coverFile === null}
              loading={coverLoading}
            >
              Upload
            </Button>
          </Flex>
        </form>
      </div>

      <AbsBookReferencePages book={book} />

      <AbsBookComplete book={book} />

      {/* Hide toggle */}
      <div>
        <Title order={3} mb="md">
          Hide book
        </Title>
        <Text size="sm" mb="md" lh="xl">
          Hidden books are not shown in the book list and are excluded from statistics.
        </Text>
        <Switch
          disabled={hideLoading}
          label="Hide book"
          checked={book.hidden}
          onChange={(e) => handleHide(e.target.checked)}
        />
      </div>

      {/* Delete */}
      <div>
        <Title order={3} mb="md">
          Remove book
        </Title>
        <Button
          loading={deleteLoading}
          leftSection={<IconTrash size={16} />}
          variant="danger"
          onClick={openDeleteConfirm}
        >
          Remove from KoInsight
        </Button>
      </div>
    </Flex>
  );
}
