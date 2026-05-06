import { darken, Tooltip, useComputedColorScheme } from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import { startOfDay, startOfWeek, subDays } from 'date-fns';
import { JSX, ReactNode, useMemo } from 'react';

import style from './dot-trail.module.css';

export type DayData = {
  percent: number;
  tooltip: ReactNode;
  accentRgb?: string;
};

type DotTrailProps = {
  percentPerDay: Record<number, DayData>;
  accentRgb?: string;
};

export function DotTrail({ percentPerDay, accentRgb = '35, 186, 175' }: DotTrailProps): JSX.Element {
  const [ref, rect] = useResizeObserver();
  const colorScheme = useComputedColorScheme();

  const today = startOfDay(new Date());

  const dotsToFit = Math.floor((rect.width - 18) / 18);
  const daysToFit = dotsToFit * 7;

  const start = startOfDay(
    startOfWeek(subDays(today, daysToFit), { locale: { options: { weekStartsOn: 1 } } })
  );

  const getOutlineColor = (percent?: number, dotAccentRgb?: string): string => {
    const background = colorScheme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)';
    const rgb = dotAccentRgb ?? accentRgb;
    return percent ? darken(`rgba(${rgb}, ${percent / 100})`, 0.4) : background;
  };
  const getBackgroundColor = (percent?: number, dotAccentRgb?: string): string => {
    const background = colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255)';
    const rgb = dotAccentRgb ?? accentRgb;
    return percent ? `rgba(${rgb}, ${percent / 100})` : background;
  };

  const allDays = useMemo(() => {
    const days = [];
    let current = start;
    while (current <= today) {
      days.push(startOfDay(current.getTime()).valueOf());
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    return days;
  }, [start, today]);

  return (
    <div className={style.DotGrid} ref={ref}>
      {allDays.map((day, id) => (
        <div key={id}>
          <Tooltip
            withArrow
            label={
              percentPerDay[day]
                ? percentPerDay[day].tooltip
                : `No data for ${new Date(day).toDateString()}`
            }
          >
            <div
              key={day}
              className={style.Dot}
              style={{
                outlineColor: getOutlineColor(percentPerDay[day]?.percent, percentPerDay[day]?.accentRgb),
                backgroundColor: getBackgroundColor(percentPerDay[day]?.percent, percentPerDay[day]?.accentRgb),
              }}
            />
          </Tooltip>
        </div>
      ))}
    </div>
  );
}
