/**
 * Aggregation behind the statistics_get tool: totals, per-project breakdown and daily/weekly
 * hours, computed from the time entries of a date range.
 */
import { calendarDate, intToHexColor, toLocalDateKey } from './mcp-app-helpers.js';

/** Tasks per API page, and the most pages statistics_get reads (5,000 tasks). */
export const STATISTICS_PAGE_SIZE = 100;
export const STATISTICS_MAX_PAGES = 50;
const PAGE_CONCURRENCY = 5;

/**
 * The longest range statistics_get accepts. The daily series has an entry for every day of the
 * range, so without a limit one call (1970 to 9999) builds millions of them and runs the instance
 * out of memory.
 */
export const STATISTICS_MAX_DAYS = 366;

/** Why a statistics range cannot be used, or null when it can. */
export function validateStatisticsRange(startDate: unknown, endDate: unknown): string | null {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);
  if (!start || !end) {
    return 'startDate and endDate must be calendar dates in the form YYYY-MM-DD.';
  }
  if (end < start) {
    return 'endDate must not be before startDate.';
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > STATISTICS_MAX_DAYS) {
    return `The range covers ${days} days, and statistics_get accepts up to ${STATISTICS_MAX_DAYS}. Split longer periods into one call per year.`;
  }
  return null;
}

/** A YYYY-MM-DD string as UTC midnight, or null when it is not a real calendar date. */
function parseCalendarDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? date : null;
}

interface Page<T> {
  items: T[];
  params?: { count?: number };
}

/**
 * Reads every page of a search. The first page reports the total count, so the remaining pages
 * are requested a few at a time instead of one after another. Stops at maxPages; `complete` is
 * false when there was more.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  pageSize: number = STATISTICS_PAGE_SIZE,
  maxPages: number = STATISTICS_MAX_PAGES
): Promise<{ items: T[]; complete: boolean }> {
  const first = await fetchPage(1);
  const items = [...first.items];
  const count = first.params?.count;

  if (first.items.length < pageSize) {
    return { items, complete: true };
  }

  if (typeof count === 'number' && count >= 0) {
    const totalPages = Math.ceil(count / pageSize);
    const lastPage = Math.min(totalPages, maxPages);
    for (let start = 2; start <= lastPage; start += PAGE_CONCURRENCY) {
      const pages = [];
      for (let page = start; page < start + PAGE_CONCURRENCY && page <= lastPage; page++) {
        pages.push(fetchPage(page));
      }
      for (const result of await Promise.all(pages)) {
        items.push(...result.items);
      }
    }
    return { items, complete: totalPages <= maxPages };
  }

  // No count in the response: read on until a short page.
  for (let page = 2; page <= maxPages; page++) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (result.items.length < pageSize) {
      return { items, complete: true };
    }
  }
  return { items, complete: false };
}

interface Totals {
  totalSec: number;
  billableSec: number;
  nonBillableSec: number;
  breakSec: number;
}

const hours = (seconds: number) => Number((seconds / 3600).toFixed(2));

export function computeStatistics(tasks: any[], startDate: string, endDate: string) {
  let totalSeconds = 0;
  let billableSeconds = 0;
  let nonBillableSeconds = 0;
  let breakSeconds = 0;

  // Project aggregation map: projectId -> { title, color, totalSec, billableSec, nonBillableSec, count }
  const projectMap = new Map<string, {
    title: string;
    color?: number;
    totalSec: number;
    billableSec: number;
    nonBillableSec: number;
    count: number;
  }>();

  // Daily aggregation map: YYYY-MM-DD -> totals
  const dailyMap = new Map<string, Totals>();

  for (const task of tasks) {
    const duration = task.duration || 0;
    const durationBreak = task.durationBreak || 0;

    totalSeconds += duration;
    breakSeconds += durationBreak;

    if (task.billable) {
      billableSeconds += duration;
    } else {
      nonBillableSeconds += duration;
    }

    // Project aggregation
    const projId = task.project?.id || 'unknown';
    const existing = projectMap.get(projId);
    if (existing) {
      existing.totalSec += duration;
      existing.count += 1;
      if (task.billable) {
        existing.billableSec += duration;
      } else {
        existing.nonBillableSec += duration;
      }
    } else {
      projectMap.set(projId, {
        // Empty for an entry without a project: the widget shows its own localized label
        title: task.project?.title || '',
        color: task.project?.color,
        totalSec: duration,
        billableSec: task.billable ? duration : 0,
        nonBillableSec: task.billable ? 0 : duration,
        count: 1,
      });
    }

    // Daily aggregation, on the day the task started as the user saw it
    const dateKey = calendarDate(task.startDateTime);
    if (dateKey) {
      const dayEntry = dailyMap.get(dateKey);
      if (dayEntry) {
        dayEntry.totalSec += duration;
        dayEntry.breakSec += durationBreak;
        if (task.billable) {
          dayEntry.billableSec += duration;
        } else {
          dayEntry.nonBillableSec += duration;
        }
      } else {
        dailyMap.set(dateKey, {
          totalSec: duration,
          billableSec: task.billable ? duration : 0,
          nonBillableSec: task.billable ? 0 : duration,
          breakSec: durationBreak,
        });
      }
    }
  }

  // Fill zero-days within the range. Keys are local dates: toISOString() of local midnight
  // would shift every day back by one east of UTC.
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const current = new Date(start);
  while (current <= end) {
    const key = toLocalDateKey(current);
    if (!dailyMap.has(key)) {
      dailyMap.set(key, { totalSec: 0, billableSec: 0, nonBillableSec: 0, breakSec: 0 });
    }
    current.setDate(current.getDate() + 1);
  }

  // Sort daily entries
  const sortedDays = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  const dailyHours = sortedDays.map(([date, d]) => ({
    date,
    hours: hours(d.totalSec),
    billableHours: hours(d.billableSec),
    nonBillableHours: hours(d.nonBillableSec),
    breakHours: hours(d.breakSec),
  }));

  // Weekly aggregation (when range > 14 days)
  const rangeDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  let weeklyHours: Array<{
    weekStart: string;
    hours: number;
    billableHours: number;
    nonBillableHours: number;
    breakHours: number;
  }> | undefined;

  if (rangeDays > 14) {
    const weekMap = new Map<string, Totals>();

    for (const [dateStr, d] of sortedDays) {
      // Monday of the week, as a local date
      const date = new Date(dateStr + 'T00:00:00');
      const day = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
      const weekKey = toLocalDateKey(monday);

      const w = weekMap.get(weekKey);
      if (w) {
        w.totalSec += d.totalSec;
        w.billableSec += d.billableSec;
        w.nonBillableSec += d.nonBillableSec;
        w.breakSec += d.breakSec;
      } else {
        weekMap.set(weekKey, { ...d });
      }
    }

    weeklyHours = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, w]) => ({
        weekStart,
        hours: hours(w.totalSec),
        billableHours: hours(w.billableSec),
        nonBillableHours: hours(w.nonBillableSec),
        breakHours: hours(w.breakSec),
      }));
  }

  // Project breakdown sorted by hours descending
  const totalHours = hours(totalSeconds);
  const projectBreakdown = Array.from(projectMap.entries())
    .sort(([, a], [, b]) => b.totalSec - a.totalSec)
    .map(([projectId, p]) => {
      const projectHours = hours(p.totalSec);
      return {
        projectId,
        projectTitle: p.title,
        projectColor: p.color,
        color: intToHexColor(p.color),
        hours: projectHours,
        billableHours: hours(p.billableSec),
        nonBillableHours: hours(p.nonBillableSec),
        taskCount: p.count,
        percentage: totalHours > 0 ? Math.round((projectHours / totalHours) * 100) : 0,
      };
    });

  return {
    totalHours,
    billableHours: hours(billableSeconds),
    nonBillableHours: hours(nonBillableSeconds),
    totalTasks: tasks.length,
    totalBreakHours: hours(breakSeconds),
    startDate,
    endDate,
    projectBreakdown,
    dailyHours,
    weeklyHours,
  };
}
