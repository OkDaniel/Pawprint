import { env } from '../config/env.js';

export const LOGICAL_DAY_CUTOFF_HOUR = 4;

export function getLogicalDate(
  date: Date,
  timeZone = env.APP_TIME_ZONE,
  cutoffHour = LOGICAL_DAY_CUTOFF_HOUR,
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hour = part('hour');
  const logicalDate = new Date(Date.UTC(year, month - 1, day - (hour < cutoffHour ? 1 : 0)));
  return logicalDate.toISOString().slice(0, 10);
}
