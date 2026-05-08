import { Book, PageStat } from '@koinsight/common/types';
import { Box, Flex, Popover, Text, useMantineTheme } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconCaretDownFilled, IconClock, IconHeadphones, IconPageBreak } from '@tabler/icons-react';
import { format, formatDate, isSameDay, startOfDay } from 'date-fns';
import { sum } from 'ramda';
import { JSX, useMemo, useState } from 'react';
import { AbsBook, AbsSession } from '../../api/audiobookshelf';
import { DayTimeline } from '../../components/calendar/day-timeline';
import { StatisticProps } from '../../components/statistics/statistic';
import { Statistics } from '../../components/statistics/statistics';
import { formatSecondsToHumanReadable } from '../../utils/dates';

type DayStatsProps = {
  stats: PageStat[];
  booksByMd5: Record<string, Book>;
  absSessions: AbsSession[];
  absBooksByItemId: Record<string, AbsBook>;
  showEbooks: boolean;
  showAudiobooks: boolean;
};

export function DayStats({
  stats,
  booksByMd5,
  absSessions,
  absBooksByItemId,
  showEbooks,
  showAudiobooks,
}: DayStatsProps): JSX.Element {
  const { colors } = useMantineTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  const dayStats = useMemo(
    () => stats.filter((s) => isSameDay(s.start_time, selectedDate)),
    [stats, selectedDate]
  );

  const daySessions = useMemo(
    () => absSessions.filter((s) => isSameDay(s.startedAt, selectedDate)),
    [absSessions, selectedDate]
  );

  const readingTime = useMemo(() => sum(dayStats.map((s) => s.duration)), [dayStats]);

  const pagesRead = useMemo(() => {
    return Math.round(
      dayStats.reduce((acc, stat) => {
        if (stat.total_pages && booksByMd5[stat.book_md5]?.reference_pages) {
          return acc + (1 / stat.total_pages) * booksByMd5[stat.book_md5].reference_pages!;
        }
        return acc + 1;
      }, 0)
    );
  }, [dayStats, booksByMd5]);

  const listeningTime = useMemo(() => sum(daySessions.map((s) => s.timeListening)), [daySessions]);

  const estimatedPages = useMemo(() => {
    if (!Object.keys(absBooksByItemId).length) return null;
    let pages = 0;
    for (const s of daySessions) {
      const book = absBooksByItemId[s.libraryItemId];
      if (!book?.reference_pages || !book.duration) continue;
      pages += s.timeListening * (book.playback_speed ?? 1.5) * (book.reference_pages / book.duration);
    }
    return Math.round(pages);
  }, [daySessions, absBooksByItemId]);

  const statsData = useMemo((): StatisticProps[] => {
    if (showEbooks && showAudiobooks) {
      const totalPages = pagesRead + (estimatedPages ?? 0);
      return [
        { label: 'Read time', value: formatSecondsToHumanReadable(readingTime), icon: IconClock },
        { label: 'Listen time', value: formatSecondsToHumanReadable(listeningTime), icon: IconHeadphones },
        { label: 'Pages read', value: totalPages, icon: IconPageBreak },
      ];
    }
    if (showEbooks) {
      return [
        { label: 'Read time', value: formatSecondsToHumanReadable(readingTime), icon: IconClock },
        { label: 'Pages read', value: pagesRead, icon: IconPageBreak },
      ];
    }
    const data: StatisticProps[] = [
      { label: 'Listen time', value: formatSecondsToHumanReadable(listeningTime), icon: IconHeadphones },
    ];
    if (estimatedPages !== null) {
      data.push({ label: 'Estimated pages', value: estimatedPages, icon: IconPageBreak });
    }
    return data;
  }, [showEbooks, showAudiobooks, readingTime, pagesRead, listeningTime, estimatedPages]);

  return (
    <>
      <Popover opened={pickerOpen} onChange={setPickerOpen} position="bottom-start">
        <Popover.Target>
          <Flex align="center" mb="md" gap={4} style={{ cursor: 'pointer' }} onClick={() => setPickerOpen((o) => !o)}>
            <Text c="koinsight.4" tt="uppercase" size="sm" fw={600}>
              {formatDate(selectedDate, 'dd MMM yyyy')}
            </Text>
            <IconCaretDownFilled size={16} color={colors.koinsight[6]} />
          </Flex>
        </Popover.Target>
        <Popover.Dropdown>
          <DatePicker
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(dateStr) => {
              if (!dateStr) return;
              const [y, m, d] = (dateStr as string).split('-').map(Number);
              setSelectedDate(new Date(y, m - 1, d));
              setPickerOpen(false);
            }}
          />
        </Popover.Dropdown>
      </Popover>
      <Statistics data={statsData} />
      <Box mt="sm">
        <DayTimeline
          chartHeight={260}
          showAxisLabels
          readingEvents={showEbooks ? dayStats : []}
          listeningEvents={showAudiobooks ? daySessions : []}
        />
      </Box>
    </>
  );
}
