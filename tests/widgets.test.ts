import { describe, expect, jest, test } from '@jest/globals';
import {
  applyToolUiMeta,
  calendarDate,
  exportFormat,
  formatExportResultResponse,
  formatPdfReportResponse,
  formatProjectListResponse,
  formatStatisticsResponse,
  formatTaskCardResponse,
  formatTaskListResponse,
  formatTimerResponse,
  getToolUiMeta,
  getWidgetResourceMeta,
  idList,
  intToHexColor,
  MAX_ATTACHED_PDF_BYTES,
  listWidgetResources,
  parseWidgetUri,
  PROFILE_META_KEY,
  SETTINGS_META_KEY,
  STOPPED_TASK_META_KEY,
  toAbsenceCard,
  TOOL_WIDGET_LINKS,
  WIDGET_NAMES,
} from '../src/mcp-app-helpers.js';
import { dispatchExtendedTool } from '../src/extended-tools.js';
import { TOOL_DEFINITIONS } from '../src/tool-definitions.js';
import { computeStatistics, fetchAllPages, validateStatisticsRange } from '../src/statistics.js';

const PROFILE = { firstname: 'Ada' };
const SETTINGS = { timeFormat: '24h' };


describe('tool descriptors link their widget', () => {
  test('every linked tool exists', () => {
    const defined = new Set(TOOL_DEFINITIONS.map((tool) => tool.name));
    for (const name of Object.keys(TOOL_WIDGET_LINKS)) {
      expect(defined.has(name)).toBe(true);
    }
  });

  test('links match the contract', () => {
    const expected: Record<string, string> = {
      timer_start: 'TimerWidget', timer_stop: 'TimerWidget', timer_pause: 'TimerWidget',
      timer_resume: 'TimerWidget', timer_status: 'TimerWidget', timer_update: 'TimerWidget',
      project_list: 'ProjectList', project_get: 'ProjectCard',
      task_list: 'TaskList', task_get: 'TaskCard', task_create: 'TaskCard', task_update: 'TaskCard',
      statistics_get: 'Statistics', export_template_list: 'ExportWidget',
      export_generate: 'ResultCard', export_send: 'ResultCard', export_from_template: 'ResultCard',
      absence_create: 'ResultCard', absence_get: 'ResultCard', absence_update: 'ResultCard',
      absence_approve: 'ResultCard', absence_reject: 'ResultCard', absence_cancel: 'ResultCard',
    };
    expect(Object.fromEntries(Object.entries(TOOL_WIDGET_LINKS).map(([k, v]) => [k, v.widget]))).toEqual(expected);
  });

  test('descriptor _meta has the resource, visibility and short status lines', () => {
    for (const name of Object.keys(TOOL_WIDGET_LINKS)) {
      const meta = getToolUiMeta(name)!;
      expect(meta.ui.resourceUri).toBe(`ui://timesheet/${TOOL_WIDGET_LINKS[name].widget}.html`);
      expect(meta.ui.visibility).toEqual(['model', 'app']);
      for (const status of [meta['openai/toolInvocation/invoking'], meta['openai/toolInvocation/invoked']]) {
        expect(status.length).toBeGreaterThan(0);
        expect(status.length).toBeLessThanOrEqual(64);
        expect(status).not.toMatch(/—/);
      }
    }
  });

  test('applyToolUiMeta stamps linked tools, keeps other _meta and leaves plain tools alone', () => {
    const [linked, plain] = applyToolUiMeta([
      { name: 'absence_create', _meta: { other: 1 } },
      { name: 'absence_list' },
    ]);
    expect(linked._meta).toMatchObject({ other: 1, ui: { resourceUri: 'ui://timesheet/ResultCard.html' } });
    expect(plain._meta).toBeUndefined();
  });
});

describe('widget resources', () => {
  test('list has every widget, ResultCard included, with the contract _meta', () => {
    const resources = listWidgetResources();
    expect(resources.map((r) => r.uri)).toEqual(WIDGET_NAMES.map((n) => `ui://timesheet/${n}.html`));
    expect(WIDGET_NAMES).toContain('ResultCard');
    for (const resource of resources) {
      expect(resource.mimeType).toBe('text/html;profile=mcp-app');
      expect(resource._meta).toEqual({
        ui: {
          csp: { connectDomains: [], resourceDomains: ['https://assets.claude.ai'] },
          prefersBorder: false,
        },
        'openai/widgetDescription': expect.any(String),
      });
    }
  });

  test('read resolves known widgets only', () => {
    expect(parseWidgetUri('ui://timesheet/ResultCard.html')).toBe('ResultCard');
    expect(parseWidgetUri('ui://timesheet/Nope.html')).toBeNull();
    expect(parseWidgetUri('ui://other/TimerWidget.html')).toBeNull();
    expect(getWidgetResourceMeta('ResultCard')['openai/widgetDescription']).toMatch(/export|absence/i);
  });
});

describe('results carry UI-only data in _meta', () => {
  const results = {
    timer: formatTimerResponse({ status: 'running', duration: 60 }, PROFILE, SETTINGS),
    projects: formatProjectListResponse([], 0, {}, PROFILE, SETTINGS),
    tasks: formatTaskListResponse([], {}, PROFILE, SETTINGS),
    statistics: formatStatisticsResponse(computeStatistics([], '2026-09-21', '2026-09-27'), PROFILE, SETTINGS),
  };

  test.each(Object.entries(results))('%s', (_name, result: any) => {
    expect(result._meta[PROFILE_META_KEY]).toEqual(PROFILE);
    expect(result._meta[SETTINGS_META_KEY]).toEqual(SETTINGS);
    expect(result._meta.ui).toBeUndefined();
    expect(Object.keys(result._meta).filter((k) => k.startsWith('openai/'))).toEqual([]);
    expect(result.structuredContent.profile).toBeUndefined();
    expect(result.structuredContent.settings).toBeUndefined();
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });
});

describe('TaskCard', () => {
  const task = {
    id: 't1', description: 'Header review', duration: 12600, billable: true,
    startDateTime: '2026-09-23T09:00:00+02:00', endDateTime: '2026-09-23T12:30:00+02:00',
    project: { id: 'p1', title: 'Website redesign', color: 16746496 },
  };

  test('created and updated carry the action, task_get does not', () => {
    const created = formatTaskCardResponse(task, 'created');
    expect(created.structuredContent).toEqual({ ...task, action: 'created' });
    expect(created.content[0].text).toBe('Task created (ID: t1): Header review (3h 30m) - Website redesign');
    expect(formatTaskCardResponse(task, 'updated').structuredContent).toMatchObject({ action: 'updated' });
    expect(formatTaskCardResponse(task).structuredContent).toEqual(task);
  });
});

describe('ResultCard: export', () => {
  test('ready export with a download link keeps the legacy url field', () => {
    const result = formatExportResultResponse(
      'Export generated',
      { status: 'ready', format: 'pdf', startDate: '2026-09-01', endDate: '2026-09-30', downloadUrl: 'https://files/x.pdf', filename: undefined, reportName: 'Timesheet' },
      { url: 'https://files/x.pdf' }
    );
    expect(result.structuredContent).toEqual({
      url: 'https://files/x.pdf',
      kind: 'export',
      export: { status: 'ready', format: 'pdf', startDate: '2026-09-01', endDate: '2026-09-30', downloadUrl: 'https://files/x.pdf', reportName: 'Timesheet' },
    });
  });

  test('format comes from the request, else the file, else Excel', () => {
    expect(exportFormat('csv', 'https://f/a.pdf')).toBe('csv');
    expect(exportFormat(undefined, 'https://f/report.pdf?sig=1')).toBe('pdf');
    expect(exportFormat(undefined, undefined)).toBe('xlsx');
  });

  test('template id lists arrive as JSON strings or arrays', () => {
    expect(idList('["a","b"]')).toEqual(['a', 'b']);
    expect(idList(['a'])).toEqual(['a']);
    expect(idList('')).toBeUndefined();
    expect(idList('not json')).toBeUndefined();
  });
});

describe('ResultCard: absence', () => {
  const absence = {
    id: 'a1', absenceTypeId: 'type-vac', contractId: 'c1',
    startDateTime: '2026-10-12T00:00:00+02:00', endDateTime: '2026-10-16T23:59:59+02:00',
    totalDays: '5', status: 'PENDING', reason: 'Family trip',
    member: { uid: 'u1', firstname: 'Ada', lastname: 'Lovelace' },
  };

  function mockClient() {
    return {
      absences: {
        create: jest.fn(async () => absence),
        get: jest.fn(async () => ({ ...absence, absenceType: { name: 'Sick leave', color: 255 } })),
        approve: jest.fn(async () => ({ ...absence, status: 'APPROVED' })),
      },
      absenceTypes: {
        get: jest.fn(async () => ({ id: 'type-vac', name: 'Vacation', color: 3066993 })),
      },
    } as any;
  }

  test('absence_create resolves the type name and keeps id and status', async () => {
    const client = mockClient();
    const result: any = await dispatchExtendedTool(client, 'absence_create', {
      organizationId: 'org', contractId: 'c1', absenceTypeId: 'type-vac',
      startDateTime: absence.startDateTime, endDateTime: absence.endDateTime,
    });
    expect(client.absenceTypes.get).toHaveBeenCalledWith('org', 'type-vac');
    expect(result.content[0].text).toBe('Absence created (ID: a1, status: PENDING)');
    expect(result.structuredContent).toEqual({
      id: 'a1',
      status: 'PENDING',
      kind: 'absence',
      action: 'requested',
      absence: {
        id: 'a1', typeName: 'Vacation', typeColor: '#2ecc71',
        startDate: '2026-10-12', endDate: '2026-10-16', totalDays: 5,
        status: 'PENDING', note: 'Family trip', userName: 'Ada Lovelace', organizationId: 'org',
      },
    });
  });

  test('the card carries what it needs to cancel the request', async () => {
    const client = mockClient();
    client.absences.get = jest.fn(async () => ({ ...absence, canCancel: true }));
    client.absences.cancel = jest.fn(async () => ({ ...absence, status: 'CANCELLED', canCancel: false }));

    const viewed: any = await dispatchExtendedTool(client, 'absence_get', { organizationId: 'org', id: 'a1' });
    expect(viewed.structuredContent.absence).toMatchObject({ organizationId: 'org', canCancel: true });

    const cancelled: any = await dispatchExtendedTool(client, 'absence_cancel', { organizationId: 'org', id: 'a1', reason: 'Plans changed' });
    expect(client.absences.cancel).toHaveBeenCalledWith('org', 'a1', { reason: 'Plans changed' });
    expect(cancelled.structuredContent).toMatchObject({
      kind: 'absence', action: 'cancelled', absence: { status: 'CANCELLED', canCancel: false },
    });
  });

  test('absence_get uses the embedded type without a lookup', async () => {
    const client = mockClient();
    const result: any = await dispatchExtendedTool(client, 'absence_get', { organizationId: 'org', id: 'a1' });
    expect(client.absenceTypes.get).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({ kind: 'absence', action: 'viewed', absence: { typeName: 'Sick leave', typeColor: '#0000ff' } });
  });

  test('absence_approve reports the new status', async () => {
    const result: any = await dispatchExtendedTool(mockClient(), 'absence_approve', { organizationId: 'org', id: 'a1' });
    expect(result.structuredContent).toMatchObject({ action: 'approved', absence: { status: 'APPROVED' } });
  });

  test('an unknown type still yields a card, and the widget names it', () => {
    expect(toAbsenceCard({ id: 'x', startDateTime: '2026-01-01T00:00:00+01:00', endDateTime: '2026-01-01T23:59:00+01:00' })).toEqual({
      id: 'x', startDate: '2026-01-01', endDate: '2026-01-01', status: '',
    });
  });

  test('part of a day carries its hours', () => {
    const card = toAbsenceCard({
      id: 'x', startDateTime: '2026-01-02T08:00:00+01:00', endDateTime: '2026-01-02T12:00:00+01:00',
      fullDay: false, totalHours: '4', totalDays: '0.5',
    });
    expect(card).toMatchObject({ fullDay: false, totalHours: 4, totalDays: 0.5 });
  });
});

describe('statistics in a timezone east of UTC (jest.config.js pins Asia/Tokyo)', () => {
  test('the run really is east of UTC', () => {
    expect(new Date('2026-09-22T00:00:00').getTimezoneOffset()).toBe(-540);
  });

  const tasks = [
    { duration: 7200, billable: true, startDateTime: '2026-09-21T09:00:00+09:00', project: { id: 'p1', title: 'Acme', color: 16746496 } },
    { duration: 3600, billable: false, startDateTime: '2026-09-22T10:00:00+09:00', project: { id: 'p1', title: 'Acme', color: 16746496 } },
    { duration: 1800, billable: false, startDateTime: '2026-09-23T01:00:00+09:00', project: { id: 'p2', title: 'Internal' } },
  ];

  test('daily keys are the local calendar days of the range', () => {
    const stats = computeStatistics(tasks, '2026-09-21', '2026-09-27');
    expect(stats.dailyHours.map((d) => d.date)).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
    ]);
    expect(stats.dailyHours[0].hours).toBe(2);
    expect(stats.dailyHours[2].hours).toBe(0.5);
  });

  test('weekly keys are local Mondays', () => {
    const stats = computeStatistics(tasks, '2026-09-01', '2026-09-30');
    expect(stats.weeklyHours!.map((w) => w.weekStart)).toEqual([
      '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28',
    ]);
  });

  test('projects report billable hours and a hex color', () => {
    const [acme, internal] = computeStatistics(tasks, '2026-09-21', '2026-09-27').projectBreakdown;
    expect(acme).toMatchObject({ projectTitle: 'Acme', hours: 3, billableHours: 2, nonBillableHours: 1, color: '#ff8800' });
    expect(internal.billableHours).toBe(0);
    expect(internal.color).toBeUndefined();
  });

  test('an entry without a project has no title and no colour for the widget to replace', () => {
    const [entry] = computeStatistics(
      [{ duration: 600, billable: false, startDateTime: '2026-09-21T09:00:00+09:00', project: { id: 'p3', color: 0 } }],
      '2026-09-21', '2026-09-21'
    ).projectBreakdown;
    expect(entry.projectTitle).toBe('');
    expect(entry.color).toBeUndefined();
  });

  test('a UTC timestamp lands on the local day', () => {
    expect(calendarDate('2026-09-22T20:30:00Z')).toBe('2026-09-23');
    expect(calendarDate('2026-09-22T20:30:00+02:00')).toBe('2026-09-22');
  });
});

describe('fetchAllPages', () => {
  const page = (n: number, size: number, count?: number) => ({
    items: Array.from({ length: size }, (_, i) => `p${n}-${i}`),
    params: count === undefined ? {} : { count },
  });

  test('reads the pages the count announces', async () => {
    const fetchPage = jest.fn(async (n: number) => page(n, n < 3 ? 100 : 50, 250));
    const { items, complete } = await fetchAllPages(fetchPage);
    expect(items).toHaveLength(250);
    expect(complete).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  test('stops at the cap and says so', async () => {
    const fetchPage = jest.fn(async (n: number) => page(n, 100, 100_000));
    const { items, complete } = await fetchAllPages(fetchPage, 100, 4);
    expect(items).toHaveLength(400);
    expect(complete).toBe(false);
  });

  test('without a count it reads on until a short page', async () => {
    const fetchPage = jest.fn(async (n: number) => page(n, n < 2 ? 100 : 7));
    const { items, complete } = await fetchAllPages(fetchPage);
    expect(items).toHaveLength(107);
    expect(complete).toBe(true);
  });
});

describe('timer text for the model', () => {
  test('names the project and description from the nested task', () => {
    const result = formatTimerResponse(
      {
        status: 'running',
        duration: 5100,
        hours: 1,
        minutes: 25,
        task: { description: 'Header review', project: { title: 'Website redesign' } },
      },
      PROFILE,
      SETTINGS
    );
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Project: Website redesign');
    expect(text).toContain('Description: Header review');
    expect(text).toContain('Duration: 1h 25m');
  });
});

describe('timer results name their tool for the widget', () => {
  test('timer_status is marked so the widget can show the idle view', () => {
    const result = formatTimerResponse({ status: 'stopped' }, PROFILE, SETTINGS, 'timer_status') as any;
    expect(result._meta['timesheet/tool']).toBe('timer_status');
    expect(result._meta['timesheet/profile']).toEqual(PROFILE);
    expect(result.structuredContent).toEqual({ status: 'stopped' });
  });
});

describe('absence card note follows the status', () => {
  const base = { id: 'a1', startDateTime: '2026-10-12T00:00:00+02:00', endDateTime: '2026-10-16T23:59:00+02:00', reason: 'Family trip' };
  test('cancelled shows the cancellation reason', () => {
    expect(toAbsenceCard({ ...base, status: 'CANCELLED', cancellationReason: 'Plans changed' }).note).toBe('Plans changed');
  });
  test('rejected shows the rejection reason', () => {
    expect(toAbsenceCard({ ...base, status: 'REJECTED', rejectionReason: 'Team is short that week' }).note).toBe('Team is short that week');
  });
  test('pending shows the request reason', () => {
    expect(toAbsenceCard({ ...base, status: 'PENDING' }).note).toBe('Family trip');
  });
});

describe('colours', () => {
  test('0 is no colour; signed Android values are colours', () => {
    expect(intToHexColor(0)).toBeUndefined();
    expect(intToHexColor(-8420)).toBe('#ffdf1c');
    expect(intToHexColor(16746496)).toBe('#ff8800');
  });
});

describe('statistics range', () => {
  test('a year is fine, leap years included', () => {
    expect(validateStatisticsRange('2026-01-01', '2026-12-31')).toBeNull();
    expect(validateStatisticsRange('2024-01-01', '2024-12-31')).toBeNull();
    expect(validateStatisticsRange('2026-09-24', '2026-09-24')).toBeNull();
  });

  test('longer ranges, reversed ranges and non-dates are refused', () => {
    expect(validateStatisticsRange('1970-01-02', '9999-12-31')).toMatch(/up to 366/);
    expect(validateStatisticsRange('2025-01-01', '2026-01-02')).toMatch(/up to 366/);
    expect(validateStatisticsRange('2026-09-30', '2026-09-01')).toMatch(/before startDate/);
    expect(validateStatisticsRange('2026-02-30', '2026-03-01')).toMatch(/YYYY-MM-DD/);
    expect(validateStatisticsRange('24.09.2026', '2026-09-30')).toMatch(/YYYY-MM-DD/);
    expect(validateStatisticsRange(undefined, '2026-09-30')).toMatch(/YYYY-MM-DD/);
  });
});

describe('statistics text says when entries are missing', () => {
  test('a truncated read is flagged for the model', () => {
    const stats = { ...computeStatistics([], '2026-09-01', '2026-09-30'), truncated: true };
    const result = formatStatisticsResponse(stats) as any;
    expect(result.structuredContent.truncated).toBe(true);
    expect(result.content[0].text).toContain('these totals are too low');
  });
});

describe('timer_stop reports the entry it saved', () => {
  test('the stopped task goes to the widget and its summary to the model', () => {
    const saved = { id: 't1', duration: 3900, description: 'Header review', project: { title: 'Website redesign' } };
    const result = formatTimerResponse({ status: 'stopped' }, PROFILE, SETTINGS, 'timer_stop', saved) as any;
    expect(result._meta[STOPPED_TASK_META_KEY]).toEqual(saved);
    expect(result._meta['timesheet/tool']).toBe('timer_stop');
    expect(result.content[0].text).toContain('Saved 1h 5m on Website redesign (Header review)');
    expect(result.structuredContent).toEqual({ status: 'stopped' });
  });
});

describe('task_list reports the total across pages', () => {
  test('total count for the widget, and the text says it shows a part', () => {
    const result = formatTaskListResponse([{ id: 't1', hours: 1, minutes: 0 }], {}, PROFILE, SETTINGS, 42) as any;
    expect(result.structuredContent.totalCount).toBe(42);
    expect(result.content[0].text).toContain('Showing 1 of 42 time entries');
  });
});

describe('PDF reports are attached', () => {
  test('the PDF travels as an embedded resource', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 sample').buffer;
    const result = formatPdfReportResponse('task', 't1', pdf) as any;
    const resource = result.content.find((item: any) => item.type === 'resource').resource;
    expect(resource).toMatchObject({ uri: 'timesheet://reports/tasks/t1.pdf', mimeType: 'application/pdf' });
    expect(Buffer.from(resource.blob, 'base64').toString()).toBe('%PDF-1.7 sample');
    expect(result.structuredContent).toMatchObject({ success: true, taskId: 't1', fileName: 'timesheet-task-t1.pdf' });
  });

  test('a PDF over the limit is described, not attached', () => {
    const result = formatPdfReportResponse('document', 'd1', new ArrayBuffer(MAX_ATTACHED_PDF_BYTES + 1)) as any;
    expect(result.content.some((item: any) => item.type === 'resource')).toBe(false);
    expect(result.structuredContent).toMatchObject({ success: false, documentId: 'd1' });
  });
});
