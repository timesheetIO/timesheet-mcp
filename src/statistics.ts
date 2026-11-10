/**
 * Aggregation behind the statistics_get tool: totals, per-project breakdown and daily/weekly
 * hours of a date range, from the server's task totals (tasks/breakdown) plus the running timer.
 */
import type { TaskBreakdown, Timer } from '@timesheet/sdk';
import { calendarDate, intToHexColor, toLocalDateKey } from './mcp-app-helpers.js';

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

interface Totals {
  totalSec: number;
  billableSec: number;
  nonBillableSec: number;
  breakSec: number;
}

const hours = (seconds: number) => Number((seconds / 3600).toFixed(2));

/** No tasks: the billable totals under the notBillable filter. */
export const EMPTY_BREAKDOWN: TaskBreakdown = { projects: [], members: [], tags: [], locations: [], days: [] };

/** The filters statistics_get passes to tasks/breakdown. */
export interface StatisticsFilter {
  startDate: string;
  endDate: string;
  projectId?: string;
  projectIds?: string[];
  teamId?: string;
  teamIds?: string[];
  tagIds?: string[];
  userIds?: string[];
  filter?: string;
}

/**
 * The running timer's time so far. The server totals count finished tasks only, so statistics_get
 * adds the running one, as the apps' day and week totals do.
 */
export interface RunningShare {
  projectId?: string;
  projectTitle: string;
  projectColor?: number;
  day: string;
  status: string;
  duration: number;
  durationBreak: number;
  billable: boolean;
}

/** As the task query's billing filter (the backend's SqlUtils.getTaskFilterString). */
function matchesBillingFilter(task: any, filter?: string): boolean {
  const billable = task.billable === true;
  const billed = task.billed === true;
  const paid = task.paid === true;
  switch (filter) {
    case 'billable':
      return billable;
    case 'notBillable':
      return !billable;
    case 'paid':
      return billable && paid;
    case 'unpaid':
      return billable && !paid;
    case 'billed':
      return billable && billed;
    case 'notBilled':
      return billable && !billed && !paid;
    case 'outstanding':
      return billable && billed && !paid;
    default:
      return true;
  }
}

/** The task query's filters applied to the running task, which started on `day`. */
function runningTaskMatches(timer: any, task: any, day: string, filter: StatisticsFilter): boolean {
  const projectId = task.project?.id ?? task.projectId;
  const teamId = task.project?.team?.id ?? task.project?.teamId;
  if (day < filter.startDate || day > filter.endDate) return false;
  if (filter.projectId && filter.projectId !== projectId) return false;
  if (filter.projectIds?.length && !filter.projectIds.includes(projectId)) return false;
  if (filter.teamId && filter.teamId !== teamId) return false;
  if (filter.teamIds?.length && !filter.teamIds.includes(teamId)) return false;
  if (filter.userIds?.length && !filter.userIds.includes(timer.user ?? task.user)) return false;
  if (filter.tagIds?.length) {
    // A timer without its tags can't be matched to a tag filter, so it stays out.
    if (!Array.isArray(task.tags)) return false;
    const tagged = task.tags.some((tag: any) => filter.tagIds!.includes(tag?.id));
    const untaggedWanted = task.tags.length === 0 && filter.tagIds.includes('-1');
    if (!tagged && !untaggedWanted) return false;
  }
  return matchesBillingFilter(task, filter.filter);
}

/** The running or paused timer's time so far, or null when there is none or it doesn't match. */
export function runningShare(timer: Timer | null | undefined, filter: StatisticsFilter, now: number): RunningShare | null {
  const task: any = timer?.task;
  const active = timer?.status === 'running' || timer?.status === 'paused';
  const start = Date.parse(task?.startDateTime ?? '');
  const day = calendarDate(task?.startDateTime);
  if (!timer || !active || !Number.isFinite(start) || !day || !runningTaskMatches(timer, task, day, filter)) {
    return null;
  }
  const duration = Math.max(0, Math.floor((now - start) / 1000));
  let breaks = task.durationBreak || 0;
  const pauseStart = Date.parse(timer.pause?.startDateTime ?? '');
  if (timer.status === 'paused' && Number.isFinite(pauseStart)) {
    breaks += Math.max(0, Math.floor((now - pauseStart) / 1000));
  }
  return {
    projectId: task.project?.id,
    projectTitle: task.project?.title || '',
    projectColor: task.project?.color,
    day,
    status: timer.status,
    duration,
    durationBreak: Math.min(breaks, duration),
    billable: task.billable === true,
  };
}

/** The key of a project in the breakdown: tasks without a project share one entry. */
const projectKey = (id?: string | null) => id || 'unknown';

/**
 * Totals, project breakdown and daily/weekly hours of a range. `all` holds the server totals of
 * the finished tasks, `billable` those of the billable ones among them; `running` adds the timer.
 */
export function computeStatistics(
  all: TaskBreakdown,
  billable: TaskBreakdown,
  startDate: string,
  endDate: string,
  running: RunningShare | null = null
) {
  const billableByProject = new Map(billable.projects.map((p) => [projectKey(p.id), p.duration]));
  const billableByDay = new Map(billable.days.map((d) => [d.id ?? '', d.duration]));

  const projectMap = new Map<string, { title: string; color?: number; totalSec: number; billableSec: number; count: number }>();
  for (const p of all.projects) {
    projectMap.set(projectKey(p.id), {
      // Empty for an entry without a project: the widget shows its own localized label
      title: p.name || '',
      color: p.color ?? undefined,
      totalSec: p.duration,
      billableSec: billableByProject.get(projectKey(p.id)) ?? 0,
      count: p.taskCount,
    });
  }

  // Daily totals, keyed by the day each task started as the user saw it
  const dailyMap = new Map<string, Totals>();
  for (const d of all.days) {
    if (!d.id) continue;
    const billableSec = billableByDay.get(d.id) ?? 0;
    dailyMap.set(d.id, {
      totalSec: d.duration,
      billableSec,
      nonBillableSec: d.duration - billableSec,
      breakSec: d.durationBreak,
    });
  }

  if (running) {
    const key = projectKey(running.projectId);
    const project = projectMap.get(key) ?? {
      title: running.projectTitle,
      color: running.projectColor,
      totalSec: 0,
      billableSec: 0,
      count: 0,
    };
    project.totalSec += running.duration;
    project.billableSec += running.billable ? running.duration : 0;
    project.count += 1;
    projectMap.set(key, project);

    const day = dailyMap.get(running.day) ?? { totalSec: 0, billableSec: 0, nonBillableSec: 0, breakSec: 0 };
    day.totalSec += running.duration;
    day.breakSec += running.durationBreak;
    if (running.billable) {
      day.billableSec += running.duration;
    } else {
      day.nonBillableSec += running.duration;
    }
    dailyMap.set(running.day, day);
  }

  let totalSeconds = 0;
  let billableSeconds = 0;
  let totalTasks = 0;
  for (const p of projectMap.values()) {
    totalSeconds += p.totalSec;
    billableSeconds += p.billableSec;
    totalTasks += p.count;
  }
  const nonBillableSeconds = totalSeconds - billableSeconds;
  let breakSeconds = 0;
  for (const d of dailyMap.values()) {
    breakSeconds += d.breakSec;
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
        nonBillableHours: hours(p.totalSec - p.billableSec),
        taskCount: p.count,
        percentage: totalHours > 0 ? Math.round((projectHours / totalHours) * 100) : 0,
      };
    });

  return {
    totalHours,
    billableHours: hours(billableSeconds),
    nonBillableHours: hours(nonBillableSeconds),
    totalTasks,
    totalBreakHours: hours(breakSeconds),
    startDate,
    endDate,
    projectBreakdown,
    dailyHours,
    weeklyHours,
    runningTimer: running
      ? { projectTitle: running.projectTitle, status: running.status, hours: hours(running.duration) }
      : undefined,
  };
}
