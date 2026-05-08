import { IconClock } from '@tabler/icons-react';
import { startOfDay } from 'date-fns';
import { sum } from 'ramda';
import { JSX } from 'react';
import { AbsSession } from '../../api/audiobookshelf';
import { Calendar, CalendarEvent } from '../../components/calendar/calendar';
import { DayTimeline } from '../../components/calendar/day-timeline';
import { getDuration, shortDuration } from '../../utils/dates';

type DayData = { sessions: AbsSession[] };

export function AbsBookPageCalendar({ sessions }: { sessions: AbsSession[] }): JSX.Element {
  const calendarEvents = sessions.reduce<Record<string, CalendarEvent<DayData>>>((acc, session) => {
    const date = startOfDay(new Date(session.startedAt));
    const key = date.toISOString();
    if (!acc[key]) acc[key] = { date, data: { sessions: [] } };
    acc[key].data!.sessions.push(session);
    return acc;
  }, {});

  return (
    <Calendar<DayData>
      events={calendarEvents}
      dayRenderer={(data) => (
        <>
          <IconClock size={14} />{' '}
          {shortDuration(getDuration(sum(data.sessions.map((s) => s.timeListening))))}
          <DayTimeline readingEvents={[]} listeningEvents={data.sessions} />
        </>
      )}
    />
  );
}
