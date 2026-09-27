/**
 * MCP Apps Helper Functions
 * Utilities for formatting tool responses with MCP Apps metadata (SEP-1865)
 *
 * Where each piece of MCP Apps metadata lives:
 * - Tool descriptors: `_meta.ui.resourceUri` + `visibility`, plus ChatGPT's invoking/invoked status text
 * - Resources (list and read): `_meta.ui.csp` + `prefersBorder`, plus ChatGPT's widget description
 * - Tool results: only data the widget needs and the model does not, under `_meta["timesheet/..."]`
 */

import { createHash } from 'crypto';
import type { AuthInfo, CacheHint } from '@modelcontextprotocol/server';

/**
 * The MCP Apps constants, as `@modelcontextprotocol/ext-apps/server` defines them. Inlined so the
 * server does not depend on ext-apps at runtime: only the widget build (web/) needs that package.
 */
export const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';
export const EXTENSION_ID = 'io.modelcontextprotocol/ui';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Cache hints for the cacheable results of protocol 2026-07-28 (never sent on 2025-era responses,
 * never on tools/call). Only data that is identical for every user may be public: the tool list,
 * the ui:// widget resources and discover. Widget HTML changes on deploy, so it is kept shorter.
 * A per-user resource must never be served under the resources/read hint (see the ui:// test).
 */
export const CACHE_HINTS = {
  'server/discover': { ttlMs: HOUR_MS, cacheScope: 'public' },
  'tools/list': { ttlMs: HOUR_MS, cacheScope: 'public' },
  'resources/list': { ttlMs: HOUR_MS, cacheScope: 'public' },
  'resources/read': { ttlMs: 15 * 60 * 1000, cacheScope: 'public' },
} as const satisfies Record<string, CacheHint>;

/** tools/list page size. Clients follow the opaque cursor; large lists stay in small payloads. */
export const TOOLS_LIST_PAGE_SIZE = 50;

/**
 * One page of a list plus the cursor of the next one. The cursor is the offset as a base-10
 * string; anything unreadable starts from the beginning.
 */
export function paginate<T>(items: readonly T[], cursor: unknown, pageSize: number): { page: T[]; nextCursor?: string } {
  const offset = typeof cursor === 'string' ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
  const page = items.slice(offset, offset + pageSize);
  const nextOffset = offset + page.length;
  return nextOffset < items.length ? { page, nextCursor: String(nextOffset) } : { page };
}

const RESOURCE_URI_PREFIX = 'ui://timesheet';

/**
 * Every widget the server ships. Resources, the widget build and the tool links all use this list.
 */
export const WIDGET_NAMES = [
  'TimerWidget',
  'ProjectList',
  'ProjectCard',
  'TaskList',
  'TaskCard',
  'Statistics',
  'ExportWidget',
  'ResultCard',
] as const;

export type WidgetName = (typeof WIDGET_NAMES)[number];

/** Result `_meta` keys for UI-only data (the model reads content and structuredContent, not these). */
export const PROFILE_META_KEY = 'timesheet/profile';
export const SETTINGS_META_KEY = 'timesheet/settings';

/**
 * Get the resource URI for a component
 */
export function getComponentResourceUri(componentName: string): string {
  return `${RESOURCE_URI_PREFIX}/${componentName}.html`;
}

/** The widget a `ui://timesheet/<Name>.html` URI points at, or null if it names none. */
export function parseWidgetUri(uri: string): WidgetName | null {
  const match = uri.match(/^ui:\/\/timesheet\/(.+)\.html$/);
  if (!match) {
    return null;
  }
  return (WIDGET_NAMES as readonly string[]).includes(match[1]) ? (match[1] as WidgetName) : null;
}

/**
 * `_meta` for a widget resource, on resources/list entries and resources/read contents alike.
 * The resource domain lets the widget load the fonts Claude injects as host styles.
 */
export function getWidgetResourceMeta(name: WidgetName) {
  return {
    ui: {
      csp: { connectDomains: [] as string[], resourceDomains: ['https://assets.claude.ai'] },
      prefersBorder: false,
    },
    'openai/widgetDescription': getStaticWidgetDescription(name),
  };
}

/** resources/list entries for every widget. */
export function listWidgetResources() {
  return WIDGET_NAMES.map((name) => ({
    uri: getComponentResourceUri(name),
    mimeType: RESOURCE_MIME_TYPE,
    name: `${name} Component`,
    description: getStaticWidgetDescription(name),
    _meta: getWidgetResourceMeta(name),
  }));
}

interface ToolWidgetLink {
  widget: WidgetName;
  /** Status line while the tool runs (ChatGPT), at most 64 characters. */
  invoking: string;
  /** Status line once it finished (ChatGPT), at most 64 characters. */
  invoked: string;
}

/**
 * Which widget renders which tool's result. The single source of truth: tools/list stamps the
 * descriptor `_meta` from this table for tools defined in index.ts and extended-tools.ts alike.
 */
export const TOOL_WIDGET_LINKS: Record<string, ToolWidgetLink> = {
  timer_start: { widget: 'TimerWidget', invoking: 'Starting the timer', invoked: 'Timer started' },
  timer_stop: { widget: 'TimerWidget', invoking: 'Stopping the timer', invoked: 'Timer stopped' },
  timer_pause: { widget: 'TimerWidget', invoking: 'Pausing the timer', invoked: 'Timer paused' },
  timer_resume: { widget: 'TimerWidget', invoking: 'Resuming the timer', invoked: 'Timer resumed' },
  timer_status: { widget: 'TimerWidget', invoking: 'Checking the timer', invoked: 'Timer checked' },
  timer_update: { widget: 'TimerWidget', invoking: 'Updating the timer', invoked: 'Timer updated' },
  project_list: { widget: 'ProjectList', invoking: 'Loading projects', invoked: 'Projects loaded' },
  project_get: { widget: 'ProjectCard', invoking: 'Loading the project', invoked: 'Project loaded' },
  task_list: { widget: 'TaskList', invoking: 'Loading time entries', invoked: 'Time entries loaded' },
  task_get: { widget: 'TaskCard', invoking: 'Loading the time entry', invoked: 'Time entry loaded' },
  task_create: { widget: 'TaskCard', invoking: 'Adding the time entry', invoked: 'Time entry added' },
  task_update: { widget: 'TaskCard', invoking: 'Updating the time entry', invoked: 'Time entry updated' },
  statistics_get: { widget: 'Statistics', invoking: 'Adding up your hours', invoked: 'Hours added up' },
  export_template_list: { widget: 'ExportWidget', invoking: 'Loading export templates', invoked: 'Export templates loaded' },
  export_generate: { widget: 'ResultCard', invoking: 'Creating the export', invoked: 'Export ready' },
  export_send: { widget: 'ResultCard', invoking: 'Sending the export', invoked: 'Export sent' },
  export_from_template: { widget: 'ResultCard', invoking: 'Creating the export from the template', invoked: 'Export ready' },
  absence_create: { widget: 'ResultCard', invoking: 'Requesting the absence', invoked: 'Absence requested' },
  absence_get: { widget: 'ResultCard', invoking: 'Loading the absence', invoked: 'Absence loaded' },
  absence_update: { widget: 'ResultCard', invoking: 'Updating the absence', invoked: 'Absence updated' },
  absence_approve: { widget: 'ResultCard', invoking: 'Approving the absence', invoked: 'Absence approved' },
  absence_reject: { widget: 'ResultCard', invoking: 'Rejecting the absence', invoked: 'Absence rejected' },
  absence_cancel: { widget: 'ResultCard', invoking: 'Cancelling the absence', invoked: 'Absence cancelled' },
};

/** Descriptor `_meta` for a tool that renders a widget, or undefined for a plain tool. */
export function getToolUiMeta(toolName: string) {
  const link = Object.hasOwn(TOOL_WIDGET_LINKS, toolName) ? TOOL_WIDGET_LINKS[toolName] : undefined;
  if (!link) {
    return undefined;
  }
  return {
    ui: {
      resourceUri: getComponentResourceUri(link.widget),
      visibility: ['model', 'app'],
    },
    'openai/toolInvocation/invoking': link.invoking,
    'openai/toolInvocation/invoked': link.invoked,
  };
}

/** Stamps the widget link onto every tool descriptor that has one. */
export function applyToolUiMeta<T extends { name: string; _meta?: Record<string, unknown> }>(tools: T[]): T[] {
  return tools.map((tool) => {
    const meta = getToolUiMeta(tool.name);
    return meta ? { ...tool, _meta: { ...(tool._meta || {}), ...meta } } : tool;
  });
}

/**
 * Puts the profile and settings, which only the widget uses, into the result's `_meta`.
 * Keys whose value is undefined are left out.
 */
export function withUiData<T extends Record<string, any>>(result: T, profile?: unknown, settings?: unknown): T {
  const meta: Record<string, unknown> = { ...(result._meta || {}) };
  if (profile !== undefined) {
    meta[PROFILE_META_KEY] = profile;
  }
  if (settings !== undefined) {
    meta[SETTINGS_META_KEY] = settings;
  }
  return Object.keys(meta).length > 0 ? { ...result, _meta: meta } : result;
}

/** A color stored as a decimal RGB integer, as a "#rrggbb" string. */
export function intToHexColor(colorInt?: number | null): string | undefined {
  // 0 is "no colour": Project.color is a Java int, so a project nobody coloured has 0, not null.
  // Anything else is an ARGB value, signed when it comes from Android (e.g. -8420).
  if (colorInt === undefined || colorInt === null || !Number.isFinite(colorInt) || colorInt === 0) {
    return undefined;
  }
  return `#${('000000' + (colorInt & 0xffffff).toString(16)).slice(-6)}`;
}

/** YYYY-MM-DD of a Date in the process's local timezone (never via toISOString, which is UTC). */
export function toLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The calendar date of an API date-time. The API writes the user's offset into the string
 * (e.g. 2026-10-12T00:00:00+02:00), so its date part is already the user's date. A UTC "Z"
 * value is converted to the local date instead.
 */
export function calendarDate(dateTime?: string | null): string | undefined {
  if (!dateTime) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime) || /[+-]\d{2}:?\d{2}$/.test(dateTime)) {
    return dateTime.substring(0, 10);
  }
  const parsed = new Date(dateTime);
  return Number.isNaN(parsed.getTime()) ? dateTime.substring(0, 10) : toLocalDateKey(parsed);
}

/*
 * The text content of a result is what the model reads, also in hosts that show a widget:
 * claude.ai hands structuredContent to the widget only. So the text names every ID a follow-up
 * call needs, such as the project for timer_start or the entry for task_update.
 */

/** " (ID: x)", or nothing when there is no ID. */
function withId(id: unknown): string {
  return typeof id === 'string' && id ? ` (ID: ${id})` : '';
}

/** "2026-09-24 08:45-10:45" from a task's local start and end, or "..., running" without an end. */
function taskWhen(task: any): string {
  const start = typeof task?.startDateTime === 'string' ? task.startDateTime : '';
  if (start.length < 16) {
    return '';
  }
  const end = typeof task.endDateTime === 'string' && task.endDateTime.length >= 16 ? task.endDateTime.slice(11, 16) : '';
  return `${start.slice(0, 10)} ${start.slice(11, 16)}${end ? `-${end}` : ', running'}`;
}

/**
 * Format timer response with component
 */
/** UI-only: which timer tool produced the result, for hosts that do not tell the widget. */
export const TOOL_META_KEY = 'timesheet/tool';

/** UI-only: the entry timer_stop just saved. The API clears the timer's task when it stops. */
export const STOPPED_TASK_META_KEY = 'timesheet/stoppedTask';

export function formatTimerResponse(timerData: any, profile?: any, settings?: any, toolName?: string, stoppedTask?: any) {
  let textContent = `Timer status: ${timerData.status}`;

  // The timer data nests the task and its project (see formatCompleteTimerData)
  const projectTitle = timerData.task?.project?.title;
  const description = timerData.task?.description;
  if (projectTitle) {
    textContent += `\nProject: ${projectTitle}${withId(timerData.task?.project?.id)}`;
  }
  if (timerData.task?.id) {
    textContent += `\nTask ID: ${timerData.task.id}`;
  }
  if (timerData.task?.startDateTime) {
    textContent += `\nStarted: ${timerData.task.startDateTime}`;
  }
  if (description) {
    textContent += `\nDescription: ${description}`;
  }
  if (timerData.duration !== undefined) {
    const hours = timerData.hours || 0;
    const minutes = timerData.minutes || 0;
    textContent += `\nDuration: ${hours}h ${minutes}m`;
  }
  if (stoppedTask) {
    const duration = stoppedTask.duration || 0;
    const title = stoppedTask.project?.title;
    textContent += `\nSaved ${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
      + `${title ? ` on ${title}` : ''}${stoppedTask.description ? ` (${stoppedTask.description})` : ''}${withId(stoppedTask.id)}`;
  }

  const result = withUiData(
    {
      content: [
        {
          type: 'text',
          text: textContent,
        },
      ],
      structuredContent: timerData,
    },
    profile,
    settings
  );
  const meta: Record<string, unknown> = { ...(result as any)._meta };
  if (toolName) {
    meta[TOOL_META_KEY] = toolName;
  }
  if (stoppedTask) {
    meta[STOPPED_TASK_META_KEY] = stoppedTask;
  }
  return Object.keys(meta).length > 0 ? { ...result, _meta: meta } : result;
}

/**
 * Format project list response with component
 */
export function formatProjectListResponse(projects: any[], totalCount: number, queryParams?: Record<string, any>, profile?: any, settings?: any) {
  const projectList = projects
    .map((p: any) => {
      let line = `- ${p.title}${withId(p.id)}`;
      if (p.employer) {
        line += `, client ${p.employer}`;
      }
      if (p.description) {
        line += ` - ${p.description}`;
      }
      if (p.archived) {
        line += ' [Archived]';
      }
      return line;
    })
    .join('\n');

  const textContent = `Found ${totalCount} project${totalCount !== 1 ? 's' : ''}:\n\n${projectList}`;

  return withUiData(
    {
      content: [
        {
          type: 'text',
          text: textContent,
        },
      ],
      structuredContent: {
        projects,
        totalCount,
        queryParams,
      },
    },
    profile,
    settings
  );
}

/**
 * Format project card response with component
 */
export function formatProjectCardResponse(project: any) {
  let textContent = `Project: ${project.title || 'Untitled'}${withId(project.id)}`;

  if (project.employer) {
    textContent += `\nClient: ${project.employer}`;
  }

  if (project.description) {
    textContent += `\nDescription: ${project.description}`;
  }
  if (project.archived) {
    textContent += `\nStatus: Archived`;
  }

  return {
    content: [
      {
        type: 'text',
        text: textContent,
      },
    ],
    structuredContent: project,
  };
}

/**
 * Format task list response with component
 */
export function formatTaskListResponse(tasks: any[], queryParams?: any, profile?: any, settings?: any, totalCount?: number) {
  const taskList = tasks
    .map((t: any) => {
      const hours = t.hours || 0;
      const minutes = t.minutes || 0;
      const when = taskWhen(t);
      let line = `- ${when ? `${when} ` : ''}${t.description || 'No description'} (${hours}h ${minutes}m)`;
      const projectTitle = t.project?.title ?? t.projectTitle;
      if (projectTitle) {
        line += ` - ${projectTitle}`;
      }
      if (t.billable) {
        line += ' [Billable]';
      }
      return line + withId(t.id);
    })
    .join('\n');

  const heading = totalCount !== undefined && totalCount > tasks.length
    ? `Showing ${tasks.length} of ${totalCount} time entries:`
    : `Found ${tasks.length} time entr${tasks.length !== 1 ? 'ies' : 'y'}:`;
  const textContent = `${heading}\n\n${taskList}`;

  return withUiData(
    {
      content: [
        {
          type: 'text',
          text: textContent,
        },
      ],
      structuredContent: {
        tasks,
        queryParams,
        // Entries matching the query across all pages, not just this one
        ...(totalCount !== undefined ? { totalCount } : {}),
      },
    },
    profile,
    settings
  );
}

export type TaskCardAction = 'created' | 'updated';

/**
 * Format task card response with component. task_create and task_update pass the action, so
 * the card can say what happened; task_get passes none.
 */
export function formatTaskCardResponse(task: any, action?: TaskCardAction) {
  const duration = task.duration || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const when = taskWhen(task);
  const summary = `${when ? `${when} ` : ''}${task.description || 'No description'} (${hours}h ${minutes}m)${task.project?.title ? ` - ${task.project.title}` : ''}`;

  let text = `Task${withId(task.id)}: ${summary}`;
  if (action === 'created') {
    text = `Task created (ID: ${task.id}): ${summary}`;
  } else if (action === 'updated') {
    text = `Task updated successfully (ID: ${task.id}): ${summary}`;
  }

  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
    structuredContent: action ? { ...task, action } : task,
  };
}

/**
 * Format statistics response with component
 */
export function formatStatisticsResponse(stats: any, profile?: any, settings?: any) {
  const lines: string[] = [];

  if (stats.startDate && stats.endDate) {
    lines.push(`Period: ${stats.startDate} to ${stats.endDate}`);
  }
  if (stats.truncated) {
    lines.push('Not every time entry of this range could be read, so these totals are too low. Narrow the range or filter by project, team or user.');
  }

  const billablePct = stats.totalHours > 0
    ? Math.round((stats.billableHours / stats.totalHours) * 100)
    : 0;

  lines.push(`Total: ${stats.totalHours.toFixed(1)}h | Billable: ${stats.billableHours.toFixed(1)}h (${billablePct}%) | Tasks: ${stats.totalTasks ?? 0}`);

  if (stats.totalBreakHours > 0) {
    lines.push(`Breaks: ${stats.totalBreakHours.toFixed(1)}h`);
  }

  if (stats.projectBreakdown && stats.projectBreakdown.length > 0) {
    lines.push('');
    lines.push('Project Breakdown:');
    for (const p of stats.projectBreakdown) {
      lines.push(`  - ${p.projectTitle || 'No project'}${withId(p.projectId)}: ${p.hours.toFixed(1)}h (${p.percentage}%, ${p.taskCount} tasks)`);
    }
  }

  if (stats.dailyHours && stats.dailyHours.length > 0) {
    lines.push('');
    lines.push('Daily Hours:');
    for (const d of stats.dailyHours.slice(0, 14)) {
      lines.push(`  - ${d.date}: ${d.hours.toFixed(1)}h`);
    }
    if (stats.dailyHours.length > 14) {
      lines.push(`  ... and ${stats.dailyHours.length - 14} more days`);
    }
  }

  const textContent = lines.join('\n');

  return withUiData(
    {
      content: [
        {
          type: 'text',
          text: textContent,
        },
      ],
      structuredContent: stats,
    },
    profile,
    settings
  );
}

/** The largest PDF a report tool attaches to its result; a bigger one would swamp the conversation. */
export const MAX_ATTACHED_PDF_BYTES = 5 * 1024 * 1024;

export type PdfReportKind = 'document' | 'task' | 'expense' | 'note';

/**
 * Result of a report_*_pdf tool: the PDF itself as an embedded resource, which hosts offer as a
 * file (and Claude can read), next to a line of text. A PDF over the limit is described instead.
 */
export function formatPdfReportResponse(kind: PdfReportKind, id: string, pdf: ArrayBuffer) {
  const size = pdf.byteLength;
  const idKey = `${kind}Id`;
  const fileName = `timesheet-${kind}-${id}.pdf`;
  const megabytes = (size / (1024 * 1024)).toFixed(1);

  if (size > MAX_ATTACHED_PDF_BYTES) {
    return {
      content: [
        {
          type: 'text',
          text: `The PDF for ${kind} ${id} is ${megabytes} MB, too large to attach. The user can download it from the ${kind} in the Timesheet app.`,
        },
      ],
      structuredContent: { success: false, [idKey]: id, size, message: 'The PDF is too large to attach.' },
    };
  }

  return {
    content: [
      { type: 'text', text: `The PDF for ${kind} ${id} is attached as ${fileName} (${megabytes} MB).` },
      {
        type: 'resource',
        resource: {
          uri: `timesheet://reports/${kind}s/${encodeURIComponent(id)}.pdf`,
          mimeType: 'application/pdf',
          blob: Buffer.from(pdf).toString('base64'),
        },
      },
    ],
    structuredContent: { success: true, [idKey]: id, size, fileName, message: 'The PDF is attached.' },
  };
}

/**
 * Format export template list response with component
 */
export function formatExportTemplateListResponse(templates: any[], totalCount: number) {
  const templateList = templates
    .slice(0, 10)
    .map((t: any) => {
      let line = `- ${t.name}${withId(t.id)}`;
      if (t.format) {
        line += ` [${t.format.toUpperCase()}]`;
      }
      if (t.summarize) {
        line += ' (summarized)';
      }
      return line;
    })
    .join('\n');

  const textContent = `Found ${totalCount} export template${totalCount !== 1 ? 's' : ''}:\n\n${templateList || 'No templates found'}${totalCount > 10 ? '\n...and more' : ''}`;

  return {
    content: [
      {
        type: 'text',
        text: textContent,
      },
    ],
    structuredContent: {
      templates,
      totalCount,
    },
  };
}

/** What the ResultCard shows for an export (contract: kind "export"). */
export interface ExportCard {
  status: 'ready' | 'sent';
  format: string;
  startDate?: string;
  endDate?: string;
  email?: string;
  downloadUrl?: string;
  filename?: string;
  reportName?: string;
}

/**
 * ResultCard result for an export. `legacy` keeps the fields each tool returned before (and its
 * outputSchema declares) at the top level of structuredContent, next to the card data.
 */
export function formatExportResultResponse(text: string, card: ExportCard, legacy: Record<string, unknown>) {
  const exportCard = Object.fromEntries(
    Object.entries(card).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as unknown as ExportCard;
  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      ...legacy,
      kind: 'export',
      export: exportCard,
    },
  };
}

/** An export's file format: as requested, else read from the download URL, else the Excel default. */
export function exportFormat(format?: string, url?: string): string {
  if (format) {
    return format;
  }
  const extension = url ? new URL(url, 'https://x').pathname.split('.').pop()?.toLowerCase() : undefined;
  return extension && ['pdf', 'xlsx', 'csv'].includes(extension) ? extension : 'xlsx';
}

/** Export templates store their id lists as JSON strings when read back; accept both forms. */
export function idList(value: unknown): any[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export type AbsenceCardAction = 'requested' | 'updated' | 'approved' | 'rejected' | 'cancelled' | 'viewed';

/** What the ResultCard shows for an absence (contract: kind "absence"). */
export interface AbsenceCard {
  id: string;
  /** Absent when the type is unknown; the card shows its own localized label then. */
  typeName?: string;
  typeColor?: string;
  startDate: string;
  endDate: string;
  totalDays?: number;
  /** False for an absence of part of a day, which the card shows in hours. */
  fullDay?: boolean;
  totalHours?: number;
  status: string;
  note?: string;
  userName?: string;
  /** Needed by the card to cancel the absence through absence_cancel. */
  organizationId?: string;
  /** As the API reports it for the calling user. */
  canCancel?: boolean;
}

function absenceNote(absence: any): string | undefined {
  const status = String(absence.status ?? '').toUpperCase();
  if (status === 'CANCELLED' && absence.cancellationReason) {
    return absence.cancellationReason;
  }
  if (status === 'REJECTED' && absence.rejectionReason) {
    return absence.rejectionReason;
  }
  return absence.reason;
}

/**
 * Normalizes an API absence for the ResultCard. `type` is the resolved absence type when the
 * absence itself only carries the type id.
 */
export function toAbsenceCard(
  absence: any,
  type?: { name?: string; color?: number } | null,
  organizationId?: string
): AbsenceCard {
  const absenceType = absence.absenceType ?? type ?? undefined;
  const member = absence.member ?? absence.requestedByMember;
  const memberName = member
    ? member.displayName || [member.firstname, member.lastname].filter(Boolean).join(' ') || undefined
    : undefined;
  const totalDays = absence.totalDays !== undefined && absence.totalDays !== null
    ? Number(absence.totalDays)
    : undefined;
  const totalHours = absence.totalHours !== undefined && absence.totalHours !== null
    ? Number(absence.totalHours)
    : undefined;

  const card: AbsenceCard = {
    id: absence.id,
    typeName: absenceType?.name || undefined,
    typeColor: intToHexColor(absenceType?.color),
    startDate: calendarDate(absence.startDateTime) ?? '',
    endDate: calendarDate(absence.endDateTime) ?? '',
    totalDays: totalDays !== undefined && Number.isFinite(totalDays) ? totalDays : undefined,
    fullDay: typeof absence.fullDay === 'boolean' ? absence.fullDay : undefined,
    totalHours: totalHours !== undefined && Number.isFinite(totalHours) ? totalHours : undefined,
    status: absence.status ?? '',
    // The reason that explains the current status: why it was cancelled or rejected, else the request's own
    note: absenceNote(absence) || undefined,
    userName: memberName,
    organizationId,
    canCancel: typeof absence.canCancel === 'boolean' ? absence.canCancel : undefined,
  };
  return Object.fromEntries(Object.entries(card).filter(([, value]) => value !== undefined)) as unknown as AbsenceCard;
}

/**
 * ResultCard result for an absence. `legacy` keeps the fields each tool returned before at the
 * top level of structuredContent, next to the card data.
 */
export function formatAbsenceResultResponse(
  text: string,
  action: AbsenceCardAction,
  absence: AbsenceCard,
  legacy: Record<string, unknown>
) {
  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      ...legacy,
      kind: 'absence',
      action,
      absence,
    },
  };
}

/**
 * Get static widget description for resource metadata
 * These are generic descriptions that apply to the widget regardless of data
 */
export function getStaticWidgetDescription(componentName: string): string {
  const descriptions: Record<string, string> = {
    TimerWidget: 'Interactive timer widget displaying current timer status, elapsed duration, and controls to pause, resume, or stop time tracking',
    ProjectList: 'Interactive list of projects with color-coded indicators, descriptions, and clickable start buttons to begin time tracking',
    ProjectCard: 'Detailed project card showing project information, description, team, and status',
    TaskList: 'Comprehensive time entries list grouped by date, showing project details, descriptions, durations, tags, and billable status',
    TaskCard: 'Time entry card showing the project, times, duration and billing status, including entries just added or updated',
    Statistics: 'Time tracking statistics dashboard with total hours, billable hours, project breakdowns with progress bars, and daily time charts',
    ExportWidget: 'Interactive export widget with template selector, date range inputs, quick date presets, and generate button to create timesheet exports',
    ResultCard: 'Result card confirming an export (download link or recipient) or an absence request with its dates, days and approval status',
  };

  return descriptions[componentName] || `Interactive ${componentName} widget for time tracking`;
}

/**
 * Get the MCP server's public URL (for OAuth resource identifier)
 */
export function getMcpServerUrl(): string {
  return process.env.MCP_SERVER_URL || process.env.COMPONENT_BASE_URL || process.env.NGROK_URL || 'http://localhost:3000';
}

/**
 * Get the Timesheet API base URL
 */
export function getApiBaseUrl(): string {
  return process.env.TIMESHEET_API_URL || 'https://api.timesheet.io';
}

/**
 * Protected Resource Metadata (RFC 9728)
 * This describes this MCP server as an OAuth 2.1 protected resource
 * ChatGPT fetches this to discover how to authenticate
 */
export function getProtectedResourceMetadata() {
  const apiBaseUrl = getApiBaseUrl();
  const mcpServerUrl = getMcpServerUrl();

  return {
    // The resource identifier (this MCP server)
    resource: mcpServerUrl,
    // Authorization servers that can issue tokens for this resource
    authorization_servers: [apiBaseUrl],
    // Supported scopes (optional - Timesheet uses data-level permissions)
    scopes_supported: ['openid', 'profile'],
    // How Bearer tokens can be transmitted
    bearer_methods_supported: ['header'],
    // Documentation link
    resource_documentation: 'https://docs.timesheet.io/integrations/mcp-server',
  };
}

/**
 * WWW-Authenticate value for 401 responses (RFC 6750 section 3, RFC 9728 section 5.1).
 * resource_metadata points MCP clients at the protected resource metadata, where their
 * OAuth discovery starts.
 */
export function getWWWAuthenticateHeader(error?: string, errorDescription?: string): string {
  const params = [
    `resource_metadata="${quoteAuthParam(`${getMcpServerUrl()}/.well-known/oauth-protected-resource`)}"`,
  ];
  if (error) {
    params.push(`error="${quoteAuthParam(error)}"`);
  }
  if (errorDescription) {
    params.push(`error_description="${quoteAuthParam(errorDescription)}"`);
  }
  return `Bearer ${params.join(', ')}`;
}

/**
 * Makes a value safe inside a quoted auth-param. Anything outside printable ASCII becomes a
 * space (a newline would make setHeader throw), then backslashes and quotes are escaped.
 */
function quoteAuthParam(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, ' ').replace(/[\\"]/g, '\\$&');
}

/**
 * Why a POST to the MCP endpoint is refused before any work is done. Without an error the
 * client simply has to sign in; invalid_token tells it to refresh or sign in again.
 */
export interface AuthChallenge {
  error?: 'invalid_token';
  errorDescription?: string;
}

/**
 * Decides whether a POST to the MCP endpoint has to be answered with 401.
 *
 * - No credentials at all: 401. MCP clients only start OAuth on a 401, so answering 200 and
 *   failing inside the tool call left OAuth clients such as Claude unable to sign in.
 *   A server started with TIMESHEET_API_TOKEN (local development) keeps working without one.
 * - An OAuth JWT whose exp has passed: 401 invalid_token, so the client refreshes it. The
 *   payload is only decoded, not verified; the API still checks the signature.
 * - Everything else passes: API keys, unexpired or undecodable JWTs, and opaque tokens are
 *   left to the API, exactly as before.
 */
export function getAuthChallenge(
  bearerToken: string | null,
  hasEnvApiKey: boolean,
  nowMs: number = Date.now()
): AuthChallenge | null {
  if (!bearerToken) {
    return hasEnvApiKey ? null : {};
  }
  if (isApiKeyToken(bearerToken) || !isJwtToken(bearerToken)) {
    return null;
  }
  const exp = getJwtExpiry(bearerToken);
  if (exp !== null && exp * 1000 <= nowMs) {
    return { error: 'invalid_token', errorDescription: 'The access token expired' };
  }
  return null;
}

/** The exp claim of a JWT in seconds, or null when the payload cannot be read. */
export function getJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload?.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** The id of a single JSON-RPC request, so an error response can answer it. */
export function getJsonRpcRequestId(body: unknown): string | number | null {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const id = (body as { id?: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') {
      return id;
    }
  }
  return null;
}

/**
 * Whether an Origin header comes from this machine. A request without one (anything but a browser)
 * counts as local too: the check is about web pages, including DNS rebinding.
 */
export function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

/** The API's answer about a token: it accepts it, it rejects it, or it could not be asked. */
export type TokenVerdict = 'accepted' | 'rejected' | 'unknown';

/**
 * Asks the API whether it accepts a bearer token. A 401 is the only no: any other answer, 402 or
 * 403 included, means the token itself is fine. Unreachable or failing means unknown.
 */
export function checkTokenWithApi(apiBaseUrl: string, timeoutMs = 3000) {
  return async (token: string): Promise<TokenVerdict> => {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/profiles/me`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.body?.cancel();
      if (response.status === 401) {
        return 'rejected';
      }
      return response.status >= 500 ? 'unknown' : 'accepted';
    } catch {
      return 'unknown';
    }
  };
}

/**
 * Whether the API still accepts an OAuth access token. The 401 gate sees only an expired JWT; a
 * revoked one (a signed-out session, a disconnected app) looks valid until it expires, and its
 * tool calls fail while the client never learns that it has to refresh. So each JWT is checked
 * with the API, and the verdict is kept for a few minutes. When the API cannot be asked, the
 * request goes through: its tool calls fail on their own.
 */
export function createTokenValidator(
  check: (token: string) => Promise<TokenVerdict>,
  { ttlMs = 5 * 60_000, maxEntries = 10_000 }: { ttlMs?: number; maxEntries?: number } = {}
) {
  // Keyed by a hash, so the cache never holds a usable token
  const verdicts = new Map<string, { accepted: boolean; until: number }>();
  return async function isTokenAccepted(token: string, nowMs: number = Date.now()): Promise<boolean> {
    const key = createHash('sha256').update(token).digest('hex');
    const cached = verdicts.get(key);
    if (cached && cached.until > nowMs) {
      return cached.accepted;
    }
    const verdict = await check(token);
    if (verdict === 'unknown') {
      return true;
    }
    verdicts.delete(key);
    if (verdicts.size >= maxEntries) {
      // A Map iterates in insertion order, so the first key is the oldest verdict
      verdicts.delete(verdicts.keys().next().value as string);
    }
    verdicts.set(key, { accepted: verdict === 'accepted', until: nowMs + ttlMs });
    return verdict === 'accepted';
  };
}

/** What a proxied authorization server document resolves to. */
export interface ProxiedDocument {
  status: number;
  body: unknown;
}

/**
 * Serves a document of the authorization server from this origin.
 *
 * Clients written against the 2025-03-26 MCP spec look for the authorization server metadata
 * on the MCP server's own origin. This used to be a hand-written copy that drifted from the
 * real one (it lacked the "none" auth method every public DCR client uses), so it is now the
 * live document, cached for ttlMs. When a refresh fails the last good copy is served and the
 * next attempt waits a minute; without any copy yet the answer is 502.
 */
export function createDocumentProxy(
  url: string,
  options: { ttlMs?: number; fetchFn?: typeof fetch; now?: () => number } = {}
): () => Promise<ProxiedDocument> {
  const { ttlMs = 60 * 60 * 1000, fetchFn = fetch, now = Date.now } = options;
  const retryAfterFailureMs = 60 * 1000;
  let cached: { body: unknown; fetchedAt: number } | null = null;

  return async () => {
    if (cached && now() - cached.fetchedAt < ttlMs) {
      return { status: 200, body: cached.body };
    }
    try {
      const response = await fetchFn(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.json();
      cached = { body, fetchedAt: now() };
      return { status: 200, body };
    } catch (error) {
      console.error(`[OAuth] Could not load ${url}:`, error);
      if (cached) {
        cached.fetchedAt = now() - ttlMs + retryAfterFailureMs;
        return { status: 200, body: cached.body };
      }
      return {
        status: 502,
        body: {
          error: 'temporarily_unavailable',
          error_description: 'The authorization server metadata could not be loaded',
        },
      };
    }
  };
}

/**
 * Extract Bearer token from Authorization header
 * Returns null if no valid Bearer token found
 */
export function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }

  // Check for Bearer scheme (case-insensitive per RFC 6750)
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return match[1];
}

/**
 * Check if a token looks like a valid JWT (basic format check)
 */
export function isJwtToken(token: string): boolean {
  // JWT has 3 base64url-encoded parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  // Each part should be non-empty and base64url-ish
  return parts.every(part => part.length > 0 && /^[A-Za-z0-9_-]+$/.test(part));
}

/**
 * Check if a token looks like a Timesheet API key
 */
export function isApiKeyToken(token: string): boolean {
  // Timesheet API keys have format: ts_{prefix}.{secret}
  return /^ts_[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/.test(token);
}

/**
 * What the MCP handler passes to the per-request server factory for a bearer token that got past
 * the 401 gate. No verification happens here: the API checks the token on every call.
 */
export function toAuthInfo(token: string): AuthInfo {
  const exp = isJwtToken(token) ? getJwtExpiry(token) : null;
  return {
    token,
    clientId: 'unknown',
    scopes: [],
    ...(exp !== null ? { expiresAt: exp } : {}),
    extra: { scheme: isApiKeyToken(token) ? 'apiKey' : 'oauth' },
  };
}

/**
 * Build SDK auth options for a token received via the HTTP Authorization header.
 *
 * MCP clients can only send the Bearer scheme, so personal API keys (ts_...)
 * arrive as Bearer tokens too. The backend only accepts them with the ApiKey
 * scheme, so route by token format.
 */
export function resolveTokenAuthOptions(
  token: string
): { apiKey: string } | { oauth2Token: string } {
  return isApiKeyToken(token) ? { apiKey: token } : { oauth2Token: token };
}
