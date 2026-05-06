import { Book } from '@koinsight/common/types';
import { Flex } from '@mantine/core';
import { JSX } from 'react';
import { BookComplete } from './book-complete';
import { BookDelete } from './book-delete';
import { BookHide } from './book-hide';
import { BookReferencePages } from './book-reference-pages';
import { BookSeries } from './book-series';
import { BookUploadCover } from '../components/book-upload-cover';

type BookPageManageProps = {
  book: Book;
};

export function BookPageManage({ book }: BookPageManageProps): JSX.Element {
  return (
    <Flex direction="column" align="flex-start" gap="xl">
      <BookSeries book={book} />
      <BookReferencePages book={book} />
      <BookUploadCover book={book} />
      <BookComplete book={book} />
      <BookHide book={book} />
      <BookDelete book={book} />
    </Flex>
  );
}
