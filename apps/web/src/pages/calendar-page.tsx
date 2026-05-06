import { PageStat } from '@koinsight/common/types';
import { Book } from '@koinsight/common/types/book';
import { Anchor, Badge, Flex, Loader, Title } from '@mantine/core';
import { IconClock, IconHeadphones } from '@tabler/icons-react';
import { startOfDay } from 'date-fns/startOfDay';
import { sum, uniq } from 'ramda';
import { JSX, useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { AbsSession, useAbsSessions } from '../api/audiobookshelf';
import { useBooks } from '../api/books';
import { usePageStats } from '../api/use-page-stats';
import { Calendar, CalendarEvent } from '../components/calendar/calendar';
import {
  DataSourceToggle,
  useDataSource,
} from '../components/data-source-toggle/data-source-toggle';
import { getBookPath } from '../routes';
import { getDuration, shortDuration } from '../utils/dates';

type DayData = {
  readingEvents: PageStat[];
  listeningEvents: AbsSession[];
};

function parseDateStr(dateStr: string): Date {
  // dateStr is "YYYY-MM-DD" — parse as local midnight to avoid timezone drift
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

export function CalendarPage(): JSX.Element {
  const [dataSource, setDataSource] = useDataSource('calendar');
  const { data: books, isLoading } = useBooks();
  const {
    data: { stats: events },
    isLoading: eventsLoading,
  } = usePageStats();
  const { data: absSessions, isLoading: absLoading } = useAbsSessions();

  const showEbooks = dataSource === 'ebook' || dataSource === 'both';
  const showAudiobooks = dataSource === 'audiobook' || dataSource === 'both';

  const calendarEvents = useMemo<Record<string, CalendarEvent<DayData>>>(() => {
    if ((showEbooks && eventsLoading) || (showAudiobooks && absLoading)) return {};

    const acc: Record<string, CalendarEvent<DayData>> = {};

    const ensureDay = (date: Date, key: string) => {
      if (!acc[key]) acc[key] = { date, data: { readingEvents: [], listeningEvents: [] } };
      return acc[key].data as DayData;
    };

    if (showEbooks && events) {
      for (const event of events) {
        const date = startOfDay(event.start_time);
        const key = date.toISOString();
        ensureDay(date, key).readingEvents.push(event);
      }
    }

    if (showAudiobooks && absSessions) {
      for (const session of absSessions) {
        const date = startOfDay(parseDateStr(session.date));
        const key = date.toISOString();
        ensureDay(date, key).listeningEvents.push(session);
      }
    }

    return acc;
  }, [events, eventsLoading, absSessions, absLoading, showEbooks, showAudiobooks]);

  const getBookByMd5 = useCallback(
    (md5: Book['md5']) => books?.find((book) => book.md5 === md5),
    [books]
  );

  const dayRenderer = useCallback(
    (data: DayData) => {
      const elements: JSX.Element[] = [];

      // Reading events grouped by book
      if (data.readingEvents.length > 0) {
        const uniqueBookMd5s = uniq(data.readingEvents.map(({ book_md5 }) => book_md5));
        const eventBooks = uniqueBookMd5s
          .map((id) => getBookByMd5(id))
          .filter(Boolean) as Book[];

        for (const book of eventBooks) {
          const bookDuration = sum(
            data.readingEvents
              .filter((e) => e.book_md5 === book.md5)
              .map((e) => e.duration)
          );
          elements.push(
            <div key={`ebook-${book.id}`}>
              <Anchor component={Link} to={getBookPath(book.id)}>
                {book.title}
              </Anchor>
              <br />
              <IconClock size={14} /> {shortDuration(getDuration(bookDuration))}
              <br />
            </div>
          );
        }
      }

      // Listening events grouped by title
      if (data.listeningEvents.length > 0) {
        const byTitle = data.listeningEvents.reduce<Record<string, number>>((acc, s) => {
          acc[s.displayTitle] = (acc[s.displayTitle] ?? 0) + s.timeListening;
          return acc;
        }, {});

        for (const [title, seconds] of Object.entries(byTitle)) {
          elements.push(
            <div key={`abs-${title}`}>
              <Badge size="xs" color="violet" variant="light" mr={4}>
                audio
              </Badge>
              {title}
              <br />
              <IconHeadphones size={14} /> {shortDuration(getDuration(seconds))}
              <br />
            </div>
          );
        }
      }

      return elements;
    },
    [getBookByMd5]
  );

  const loading = isLoading || (showEbooks && eventsLoading) || (showAudiobooks && absLoading);

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <>
      <Flex justify="space-between" align="center" mb="xl" wrap="wrap" gap="sm">
        <Title>Calendar</Title>
        <DataSourceToggle value={dataSource} onChange={setDataSource} />
      </Flex>
      <Calendar<DayData> events={calendarEvents} dayRenderer={dayRenderer} />
    </>
  );
}
