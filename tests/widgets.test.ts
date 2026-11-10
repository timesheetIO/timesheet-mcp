import { describe, expect, jest, test } from '@jest/globals';
import {
  applyToolUiMeta,
  calendarDate,
  exportFormat,
  formatExportResultResponse,
  formatPdfReportResponse,
  formatProjectListResponse,
  formatRecordResultResponse,
  formatStatisticsResponse,
  formatTaskCardResponse,
  formatTaskListResponse,
  formatTimerResponse,
  getToolUiMeta,
  getWidgetResourceMeta,
  idList,
  intToHexColor,
  MAX_ATTACHED_PDF_BYTES,
  OBSERVED_AT_META_KEY,
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
import { computeStatistics, EMPTY_BREAKDOWN, runningShare, validateStatisticsRange } from '../src/statistics.js';

const PROFILE = { firstname: 'Ada' };
const SETTINGS = { timeFormat: '24h' };

/** One row of the server's task totals (tasks/breakdown). */
function total(id: string | null, name: string | null, duration: number, extra: Record<string, unknown> = {}) {
  return { id, name, duration, durationBreak: 0, salaryTotal: '0.00', salaryBreak: '0.00', taskCount: 1, ...extra };
}


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
      timer_panel: 'TimerWidget', timer_sidebar: 'TimerWidget',
      project_list: 'ProjectList', project_get: 'ProjectCard',
      task_list: 'TaskList', task_get: 'TaskCard', task_create: 'TaskCard', task_update: 'TaskCard',
      statistics_get: 'Statistics', export_template_list: 'ExportWidget',
      export_generate: 'ResultCard', export_send: 'ResultCard', export_from_template: 'ResultCard',
      absence_create: 'ResultCard', absence_get: 'ResultCard', absence_update: 'ResultCard',
      absence_approve: 'ResultCard', absence_reject: 'ResultCard', absence_cancel: 'ResultCard',
    };
    // Every other write tool confirms with the ResultCard's record card
    for (const tool of TOOL_DEFINITIONS) {
      if (tool.name !== 'auth_configure' && tool.annotations?.readOnlyHint === false && !(tool.name in expected)) {
        expected[tool.name] = 'ResultCard';
      }
    }
    expect(Object.fromEntries(Object.entries(TOOL_WIDGET_LINKS).map(([k, v]) => [k, v.widget]))).toEqual(expected);
  });

  /** Microsoft's agent store asks for a card confirming every completed action. */
  test('every write tool answers with a card', () => {
    const writes = TOOL_DEFINITIONS.filter((tool) => tool.name !== 'auth_configure' && tool.annotations?.readOnlyHint === false);
    expect(writes.length).toBeGreaterThan(60);
    expect(writes.filter((tool) => !TOOL_WIDGET_LINKS[tool.name]).map((tool) => tool.name)).toEqual([]);
  });

  test('descriptor _meta has the resource, visibility and short status lines', () => {
    for (const name of Object.keys(TOOL_WIDGET_LINKS)) {
      const meta = getToolUiMeta(name)!;
      expect(meta.ui.resourceUri).toBe(`ui://timesheet/${TOOL_WIDGET_LINKS[name].widget}.html`);
      expect(meta.ui.visibility).toEqual(TOOL_WIDGET_LINKS[name].entrypoint ? ['app'] : ['model', 'app']);
      for (const status of [meta['openai/toolInvocation/invoking'], meta['openai/toolInvocation/invoked']]) {
        expect(status.length).toBeGreaterThan(0);
        expect(status.length).toBeLessThanOrEqual(64);
        expect(status).not.toMatch(/—/);
      }
    }
  });

  // OpenAI MCP Extensions: one entrypoint per tool, titled, read-only, accepting {} (docs/spec.md)
  test('the sidebar timer opens from ChatGPT\'s sidebar and beside the conversation, for the user only', () => {
    const entrypoints = Object.entries(TOOL_WIDGET_LINKS).filter(([, link]) => link.entrypoint);
    expect(entrypoints.map(([name, link]) => [name, link.entrypoint])).toEqual([
      ['timer_panel', 'thread'],
      ['timer_sidebar', 'global'],
    ]);
    for (const [name, link] of entrypoints) {
      const tool = TOOL_DEFINITIONS.find((t) => t.name === name) as any;
      expect(tool._meta['openai/ui']).toEqual({ entrypoints: [{ type: link.entrypoint }] });
      expect(tool._meta.ui.visibility).toEqual(['app']);
      expect(tool.title).toBeTruthy();
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(tool.inputSchema.required).toBeUndefined();
      expect(tool.icons.map((icon: any) => icon.theme)).toEqual(['light', 'dark']);
      expect(tool.icons[0].src).toMatch(/^data:image\/svg\+xml,/);
    }
    // Other tools stay out of ChatGPT's entrypoints
    expect(TOOL_DEFINITIONS.filter((t: any) => t._meta?.['openai/ui']).map((t) => t.name)).toEqual(['timer_panel', 'timer_sidebar']);
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
        'openai/widgetDomain': 'https://mcp.timesheet.io',
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
    statistics: formatStatisticsResponse(computeStatistics(EMPTY_BREAKDOWN, EMPTY_BREAKDOWN, '2026-09-21', '2026-09-27'), PROFILE, SETTINGS),
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
    expect(created.content[0].text).toBe('Task created (ID: t1): 2026-09-23 09:00-12:30 Header review (3h 30m) - Website redesign');
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

describe('ResultCard: record', () => {
  test('the card sits next to the legacy fields, without empty ones', () => {
    const result = formatRecordResultResponse('Tag t1 updated.', 'updated', {
      type: 'tag', name: 'Peer review', context: ['', 'Studio'], color: undefined, changes: [],
    }, { id: 't1', name: 'Peer review' });
    expect(result.content).toEqual([{ type: 'text', text: 'Tag t1 updated.' }]);
    expect(result.structuredContent).toEqual({
      id: 't1', name: 'Peer review', kind: 'record', action: 'updated',
      record: { type: 'tag', name: 'Peer review', context: ['Studio'] },
    });
  });

  test('a delete reads the record first, so the card can name it', async () => {
    const client = {
      tags: {
        get: jest.fn(async () => ({ id: 't1', name: 'Peer review', color: 3066993 })),
        delete: jest.fn(async () => undefined),
      },
    } as any;
    const result: any = await dispatchExtendedTool(client, 'tag_delete', { id: 't1' });
    expect(client.tags.delete).toHaveBeenCalledWith('t1');
    expect(result.structuredContent).toEqual({
      deletedId: 't1', kind: 'record', action: 'deleted',
      record: { type: 'tag', name: 'Peer review', color: '#2ecc71' },
    });
  });

  test('a failed read never stops the delete', async () => {
    const client = {
      todos: {
        get: jest.fn(async () => { throw new Error('404'); }),
        delete: jest.fn(async () => undefined),
      },
    } as any;
    const result: any = await dispatchExtendedTool(client, 'todo_delete', { id: 'td1' });
    expect(client.todos.delete).toHaveBeenCalledWith('td1');
    expect(result.structuredContent.record).toEqual({ type: 'todo' });
    expect(result.structuredContent.deletedId).toBe('td1');
  });

  test('contract status changes carry their own action', async () => {
    const client = {
      contracts: {
        suspend: jest.fn(async () => ({
          id: 'c1', name: 'Part-time 2027', status: 'SUSPENDED',
          member: { firstname: 'Alex', lastname: 'Member' },
        })),
      },
    } as any;
    const result: any = await dispatchExtendedTool(client, 'contract_suspend', { organizationId: 'org', id: 'c1' });
    expect(result.structuredContent).toMatchObject({
      id: 'c1', status: 'SUSPENDED', kind: 'record', action: 'suspended',
      record: { type: 'contract', name: 'Part-time 2027', context: ['Alex Member'] },
    });
  });

  test('an invitation says so, an added member does not', async () => {
    const client = {
      organizations: { addMember: jest.fn(async () => ({ id: 'm1', email: 'sam@example.com', invited: true })) },
      projects: { addMember: jest.fn(async () => ({ id: 'm2', email: 'alex@example.com', displayName: 'Alex Member' })) },
    } as any;
    const invited: any = await dispatchExtendedTool(client, 'organization_member_add', { organizationId: 'org', email: 'sam@example.com' });
    expect(invited.structuredContent).toMatchObject({ action: 'invited', record: { type: 'organizationMember', name: 'sam@example.com' } });
    const added: any = await dispatchExtendedTool(client, 'project_member_add', { projectId: 'p1', email: 'alex@example.com' });
    expect(added.structuredContent).toMatchObject({ action: 'added', record: { type: 'projectMember', name: 'Alex Member' } });
  });

  test('the refund flag picks the action, and the amount is a number', async () => {
    const client = {
      expenses: { updateStatus: jest.fn(async () => ({ id: 'e1', description: 'Taxi', amount: '26.00', refunded: false })) },
    } as any;
    const result: any = await dispatchExtendedTool(client, 'expense_set_refunded', { id: 'e1', refunded: false });
    expect(result.structuredContent).toMatchObject({
      id: 'e1', refunded: false, action: 'unrefunded', record: { type: 'expense', name: 'Taxi', amount: 26 },
    });
  });

  test('settings list what the update changed', async () => {
    const client = { settings: { update: jest.fn(async () => ({ theme: 'dark', language: 'en' })) } } as any;
    const result: any = await dispatchExtendedTool(client, 'settings_update', { theme: 'dark', firstDay: 1 });
    expect(result.structuredContent).toEqual({
      theme: 'dark', language: 'en', kind: 'record', action: 'updated',
      record: { type: 'settings', changes: [{ key: 'theme', value: 'dark' }, { key: 'firstDay', value: '1' }] },
    });
  });
});

describe('statistics in a timezone east of UTC (jest.config.js pins Asia/Tokyo)', () => {
  test('the run really is east of UTC', () => {
    expect(new Date('2026-09-22T00:00:00').getTimezoneOffset()).toBe(-540);
  });

  // Server totals of three entries: Acme 2h billable on the 21st and 1h on the 22nd, Internal 0.5h on the 23rd
  const all = {
    ...EMPTY_BREAKDOWN,
    projects: [total('p1', 'Acme', 10800, { color: 16746496, taskCount: 2 }), total('p2', 'Internal', 1800)],
    days: [total('2026-09-21', null, 7200), total('2026-09-22', null, 3600), total('2026-09-23', null, 1800)],
  };
  const billable = {
    ...EMPTY_BREAKDOWN,
    projects: [total('p1', 'Acme', 7200, { color: 16746496 })],
    days: [total('2026-09-21', null, 7200)],
  };

  test('daily keys are the local calendar days of the range', () => {
    const stats = computeStatistics(all, billable, '2026-09-21', '2026-09-27');
    expect(stats.dailyHours.map((d) => d.date)).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27',
    ]);
    expect(stats.dailyHours[0].hours).toBe(2);
    expect(stats.dailyHours[2].hours).toBe(0.5);
  });

  test('weekly keys are local Mondays', () => {
    const stats = computeStatistics(all, billable, '2026-09-01', '2026-09-30');
    expect(stats.weeklyHours!.map((w) => w.weekStart)).toEqual([
      '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28',
    ]);
  });

  test('projects report billable hours and a hex color', () => {
    const [acme, internal] = computeStatistics(all, billable, '2026-09-21', '2026-09-27').projectBreakdown;
    expect(acme).toMatchObject({ projectTitle: 'Acme', hours: 3, billableHours: 2, nonBillableHours: 1, color: '#ff8800' });
    expect(internal.billableHours).toBe(0);
    expect(internal.color).toBeUndefined();
  });

  test('an entry without a project has no title and no colour for the widget to replace', () => {
    const [entry] = computeStatistics(
      { ...EMPTY_BREAKDOWN, projects: [total(null, null, 600, { color: 0 })] },
      EMPTY_BREAKDOWN,
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

describe('statistics count the running timer', () => {
  const NOW = Date.parse('2026-09-22T11:30:00+09:00');
  const week = { startDate: '2026-09-21', endDate: '2026-09-27' };
  const timer = (status = 'running', task: Record<string, unknown> = {}): any => ({
    status,
    user: 'u1',
    task: {
      startDateTime: '2026-09-22T10:00:00+09:00',
      durationBreak: 300,
      billable: true,
      project: { id: 'p1', title: 'Acme', team: { id: 't1' } },
      ...task,
    },
  });
  const acme = { ...EMPTY_BREAKDOWN, projects: [total('p1', 'Acme', 3600)], days: [total('2026-09-22', null, 3600)] };

  test('its time so far adds to its project, its day and the totals', () => {
    const share = runningShare(timer(), week, NOW);
    expect(share).toMatchObject({ projectId: 'p1', day: '2026-09-22', duration: 5400, durationBreak: 300, billable: true });

    const stats = computeStatistics(acme, acme, week.startDate, week.endDate, share);
    expect(stats.totalHours).toBe(2.5);
    expect(stats.billableHours).toBe(2.5);
    expect(stats.totalTasks).toBe(2);
    expect(stats.projectBreakdown[0]).toMatchObject({ projectId: 'p1', hours: 2.5, taskCount: 2 });
    expect(stats.dailyHours.find((d) => d.date === '2026-09-22')).toMatchObject({ hours: 2.5, breakHours: 0.08 });
    expect(stats.runningTimer).toEqual({ projectTitle: 'Acme', status: 'running', hours: 1.5 });
  });

  test('a paused timer counts its open break as break', () => {
    const paused = { ...timer('paused'), pause: { startDateTime: '2026-09-22T11:00:00+09:00' } };
    expect(runningShare(paused, week, NOW)).toMatchObject({ duration: 5400, durationBreak: 300 + 1800 });
  });

  test('a timer the filters leave out is not counted', () => {
    expect(runningShare(timer(), { startDate: '2026-09-23', endDate: '2026-09-27' }, NOW)).toBeNull();
    expect(runningShare(timer(), { ...week, projectIds: ['p2'] }, NOW)).toBeNull();
    expect(runningShare(timer(), { ...week, teamId: 't2' }, NOW)).toBeNull();
    expect(runningShare(timer(), { ...week, userIds: ['u2'] }, NOW)).toBeNull();
    expect(runningShare(timer(), { ...week, filter: 'notBillable' }, NOW)).toBeNull();
    expect(runningShare(timer(), { ...week, tagIds: ['g1'] }, NOW)).toBeNull();
    expect(runningShare(timer('stopped'), week, NOW)).toBeNull();
    expect(runningShare(null, week, NOW)).toBeNull();
  });

  test('a timer matching the filters is counted', () => {
    expect(runningShare(timer(), { ...week, teamIds: ['t1'], userIds: ['u1'], filter: 'unpaid' }, NOW)).not.toBeNull();
    expect(runningShare(timer('running', { tags: [{ id: 'g1' }] }), { ...week, tagIds: ['g1'] }, NOW)).not.toBeNull();
    expect(runningShare(timer('running', { tags: [] }), { ...week, tagIds: ['-1'] }, NOW)).not.toBeNull();
  });

  test('the model reads that the running timer is already counted', () => {
    const stats = computeStatistics(EMPTY_BREAKDOWN, EMPTY_BREAKDOWN, week.startDate, week.endDate, runningShare(timer(), week, NOW));
    const result = formatStatisticsResponse(stats) as any;
    expect(result.structuredContent.runningTimer).toEqual({ projectTitle: 'Acme', status: 'running', hours: 1.5 });
    expect(result.content[0].text).toContain('Includes the running timer on Acme: 1.5h so far (already counted above).');
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

describe('timer results are dated, so widgets can tell the latest copy', () => {
  test('every timer result says when the server read the timer', () => {
    const before = Date.now();
    const result = formatTimerResponse({ status: 'stopped' }, PROFILE, SETTINGS, 'timer_status') as any;
    expect(result._meta[OBSERVED_AT_META_KEY]).toBeGreaterThanOrEqual(before);
    expect(result._meta[OBSERVED_AT_META_KEY]).toBeLessThanOrEqual(Date.now());
    expect(result.structuredContent[OBSERVED_AT_META_KEY]).toBeUndefined();
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
