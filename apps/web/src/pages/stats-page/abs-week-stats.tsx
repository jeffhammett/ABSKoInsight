import { AreaChart } from '@mantine/charts';
import { Flex, Popover, Text, useComputedColorScheme, useMantineTheme } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconCaretDownFilled, IconClock } from '@tabler/icons-react';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  format,
  formatDate,
  isBefore,
  isSameDay,
  startOfWeek,
} from 'date-fns';
import { sum } from 'ramda';
import { JSX, useMemo, useState } from 'react';
import { useAbsSessions } from '../../api/audiobookshelf';
import { Statistics } from '../../components/statistics/statistics';
import { formatSecondsToHumanReadable } from '../../utils/dates';

export function AbsWeekStats(): JSX.Element {
  const colorScheme = useComputedColorScheme();
  const { colors } = useMantineTheme();
  const { data: sessions = [] } = useAbsSessions();

  const [weekStart, setWeekStart] = useState<number>(
    startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
  );

  const weekEnd = useMemo(() => {
    const rawWeekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }).getTime();
    const today = endOfDay(new Date()).getTime();
    return rawWeekEnd <= today ? rawWeekEnd : today;
  }, [weekStart]);

  const weekDaysPassed = useMemo(
    () => differenceInCalendarDays(weekEnd, weekStart) + 1,
    [weekStart, weekEnd]
  );

  const weekSessions = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 }).getTime();
    return sessions.filter((s) => s.startedAt >= start && s.startedAt <= weekEnd);
  }, [sessions, weekStart, weekEnd]);

  const totalTime = useMemo(() => sum(weekSessions.map((s) => s.timeListening)), [weekSessions]);

  const perDay = useMemo(() => {
    const result = [];
    let day = weekStart;
    while (isBefore(day, weekEnd)) {
      const daySessions = sessions.filter((s) => isSameDay(s.startedAt, day));
      result.push({
        day: format(day, 'dd MMM yyyy'),
        duration: sum(daySessions.map((s) => s.timeListening)),
      });
      day = addDays(day, 1).getTime();
    }
    return result;
  }, [sessions, weekStart, weekEnd]);

  return (
    <>
      <Popover position="bottom-start">
        <Popover.Target>
          <Flex align="center" mb="md" gap={4} style={{ cursor: 'pointer' }}>
            <Text c="violet.4" tt="uppercase" size="sm" fw={600}>
              {formatDate(weekStart, 'dd MMM')} - {formatDate(weekEnd, 'dd MMM')}
            </Text>
            <IconCaretDownFilled size={16} color={colors.violet[6]} />
          </Flex>
        </Popover.Target>
        <Popover.Dropdown>
          <DatePicker
            value={new Date(weekStart)}
            maxDate={endOfWeek(new Date(), { weekStartsOn: 1 })}
            onChange={(date) =>
              date && setWeekStart(startOfWeek(date, { weekStartsOn: 1 }).getTime())
            }
          />
        </Popover.Dropdown>
      </Popover>
      <Statistics
        data={[
          {
            label: 'Listen time',
            value: formatSecondsToHumanReadable(totalTime),
            icon: IconClock,
          },
          {
            label: 'Average time per day',
            value: formatSecondsToHumanReadable(Math.round(totalTime / weekDaysPassed)),
            icon: IconClock,
          },
        ]}
      />
      <AreaChart
        h={300}
        mt="sm"
        data={perDay}
        dataKey="day"
        gridAxis="none"
        withYAxis={false}
        type="stacked"
        valueFormatter={(value) => formatSecondsToHumanReadable(value)}
        curveType="monotone"
        series={[
          {
            name: 'duration',
            label: 'Listening time',
            color: colorScheme === 'dark' ? 'violet.3' : 'violet.7',
          },
        ]}
      />
    </>
  );
}
