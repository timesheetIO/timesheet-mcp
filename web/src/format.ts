/**
 * Formatting for the widgets: durations, clocks, numbers, dates and times in the host's locale
 * and time zone.
 */

import i18n from './i18n';

/** A number in the locale's digits and separators (1,5 / 1.234 in German) */
export function formatNumber(value: number, locale?: string, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}

/** A share given in percent (42) as "42%" or "42 %", depending on the locale */
export function formatPercent(percent: number, locale?: string): string {
  return formatNumber((percent || 0) / 100, locale, { style: 'percent', maximumFractionDigits: 0 });
}

/** A number of hours in the locale's short unit form ("0.5h", "0,5h"), for chart axes */
export function formatHoursValue(hours: number, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'narrow', maximumFractionDigits: 2 }).format(hours);
  } catch {
    return `${formatNumber(hours, locale, { maximumFractionDigits: 2 })}h`;
  }
}

/**
 * "3h 30m", "4h 00m", "45m" in the active language (minutes padded next to hours), rounded to
 * the nearest minute: the server rounds hours to two decimals (38h 20m arrives as 38.33h), and
 * cutting the seconds off would show 38h 19m.
 */
export function formatDuration(totalSeconds: number, locale?: string): string {
  const totalMinutes = Math.max(0, Math.round((totalSeconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return i18n.t('common.durationMinutes', { minutes });
  return i18n.t('common.durationHours', {
    hours: formatNumber(hours, locale),
    minutes: String(minutes).padStart(2, '0'),
  });
}

/** Hours as a decimal number (38.5) to seconds */
export const hoursToSeconds = (hours: number) => Math.round((hours || 0) * 3600);

/** "01:24:15" */
export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

/**
 * A calendar date (YYYY-MM-DD) as a local Date at midnight. new Date('2026-10-12') would be
 * midnight UTC and show the previous day west of Greenwich.
 */
export function parseCalendarDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** A local Date as YYYY-MM-DD. toISOString() would give the UTC date, a day off east of UTC. */
export function toCalendarDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The calendar date (YYYY-MM-DD) an API date-time falls on for the user. The API writes the
 * user's offset into the string (2026-10-12T09:00:00+02:00), so its date part is that date; a
 * UTC "Z" value is converted to the host's time zone.
 */
export function calendarDateOf(dateTime: string, timeZone?: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime) || /[+-]\d{2}:?\d{2}$/.test(dateTime)) {
    return dateTime.slice(0, 10);
  }
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) {
    return dateTime.slice(0, 10);
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return toCalendarDate(date);
  }
}

/** A local Date as ISO 8601 with the local offset, e.g. 2026-10-12T09:05:00+02:00 */
export function toOffsetISOString(date: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return `${toCalendarDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

function toDate(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseCalendarDate(value);
  return new Date(value);
}

/** Time of day, e.g. "09:02" or "9:02 AM" depending on the locale */
export function formatTime(value: string | number | Date, locale: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(toDate(value));
  } catch {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(toDate(value));
  }
}

/** A date such as "Tue, Sep 23" (with the year when it is not the current one) */
export function formatDate(
  value: string | number | Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
  timeZone?: string
): string {
  const date = toDate(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const format: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    ...options,
  };
  // Calendar dates carry no time zone: format them as they are
  const isCalendarDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  try {
    return new Intl.DateTimeFormat(locale, { ...format, timeZone: isCalendarDate ? undefined : timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, format).format(date);
  }
}

/** "Oct 12 – 16, 2026" or "Sep 1 – Oct 3" using the locale's own range format */
export function formatDateRange(start: string, end: string | undefined, locale: string): string {
  const from = toDate(start);
  if (!end) return formatDate(from, locale, { weekday: undefined });
  const to = toDate(end);
  const sameYear = from.getFullYear() === to.getFullYear() && from.getFullYear() === new Date().getFullYear();
  const format = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const range = (format as any).formatRange;
  if (typeof range === 'function') {
    return range.call(format, from, to);
  }
  return `${format.format(from)} - ${format.format(to)}`;
}

/** Hex color for a Timesheet integer color (16711680 = #ff0000), or undefined */
export function projectColor(color?: number | string | null): string | undefined {
  if (typeof color === 'string' && color) return color.startsWith('#') ? color : `#${color}`;
  // Colors are ARGB integers, and Android stores them signed (e.g. -8420), so any non-zero value is a color
  if (typeof color === 'number' && Number.isFinite(color) && color !== 0) {
    return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
  }
  return undefined;
}
