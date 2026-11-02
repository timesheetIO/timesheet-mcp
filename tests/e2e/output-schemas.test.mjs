// Every tool's result against the outputSchema it declares, over HTTP with the v2 client, which
// checks structuredContent on each call and throws on a mismatch. Run against the BUILT server
// (`npm run build` first). The Timesheet API is a local stub that answers every route with
// plausible data, so the results are what the formatters really produce. No real API is called.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const pkg = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_KEY = 'ts_abc12345.xyz67890';

const PROJECT = { id: 'p1', title: 'Website', description: 'Client work', color: -8420, archived: false, billable: true };
const TAG = { id: 'g1', name: 'Design', color: -16776961 };
const TASK = {
  id: 't1',
  description: 'Design review',
  startDateTime: '2026-09-24T09:00:00+02:00',
  endDateTime: '2026-09-24T10:30:00+02:00',
  duration: 5400,
  durationBreak: 0,
  billable: true,
  paid: false,
  billed: false,
  typeId: 0,
  project: PROJECT,
  tags: [TAG],
};
const TIMER = { status: 'running', task: { ...TASK, endDateTime: undefined, duration: 1800 } };
const PROFILE = { id: 'u1', firstname: 'Ada', lastname: 'Lovelace', email: 'ada@example.test' };
const SETTINGS = { timezone: 'Europe/Vienna', language: 'en', theme: 'light', currency: 'EUR' };

/**
 * One object that reads as an entity of any kind and as a page of them, so that every route can
 * answer with it: formatters pick the fields they know.
 */
const ENTITY = {
  ...TASK,
  title: 'Sample',
  name: 'Sample',
  text: 'Sample note',
  displayName: 'Ada Lovelace',
  firstname: 'Ada',
  lastname: 'Lovelace',
  email: 'ada@example.test',
  role: 'member',
  status: 'PENDING',
  amount: 12.5,
  dateTime: '2026-09-24T09:00:00+02:00',
  absenceType: { id: 'at1', name: 'Vacation', color: -16711936 },
  absenceTypeId: 'at1',
  totalDays: '1',
  fullDay: true,
  format: 'xlsx',
  url: 'https://files.example.test/report.xlsx',
  created: 1_727_164_800_000,
  lastUpdate: 1_727_164_800_000,
  items: [TASK],
  params: { count: 1, page: 1, limit: 50 },
};

/** Report types: two that take columns, from the task and the project field scope, and one with fixed columns. */
const REPORT_TYPES = {
  items: [
    { id: 1, name: 'Hours', acceptFields: true, fieldScope: 'TASK', dataCategory: 'TASK' },
    { id: 4, name: 'Project summary', acceptFields: true, fieldScope: 'PROJECT', dataCategory: 'TASK' },
    { id: 12, name: 'Absences', acceptFields: false, dataCategory: 'ABSENCE' },
  ],
};
/** The export fields of each field scope, a custom field among them. */
const FIELDS = {
  task: [
    { fieldId: 'DATE', name: 'Date', type: 'DATE', category: 'TASK', scope: 'TASK' },
    { fieldId: 'DURATION', name: 'Duration', type: 'DURATION', category: 'TASK', scope: 'TASK' },
    { fieldId: 'CUSTOM_cf1', name: 'Cost center', type: 'TEXT', scope: 'TASK', customField: true, customType: 'text', customValue: 'CC-42' },
  ],
  project: [{ fieldId: 'PROJECT_TITLE', name: 'Project', type: 'TEXT', category: 'PROJECT', scope: 'PROJECT' }],
};
/** An export template with every setting, as GET /v1/export/templates/tp-full answers it. */
const TEMPLATE = {
  id: 'tp-full',
  name: 'Monthly hours',
  report: 1,
  format: 'pdf',
  teamIds: ['tm1'],
  projectIds: ['p1'],
  userIds: ['u1'],
  tagIds: ['g1'],
  type: 'task',
  filter: 'billable',
  splitTask: true,
  summarize: true,
  email: 'jane@example.test',
  filename: 'hours',
  title: 'Hours report, Jane Smith',
  exportedFields: [{ id: 'DURATION', name: 'Duration', position: 0, projectField: false, teamField: false, customField: false }],
};

let apiStub;
let apiUrl;
let child;
let baseUrl;
/** Bodies the API stub received, as { method, route, body }. */
const apiRequests = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

before(async () => {
  apiStub = http.createServer((req, res) => {
    const route = req.url.split('?')[0];
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      let body = raw || undefined;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        // not JSON, such as a file upload: keep the raw text
      }
      apiRequests.push({ method: req.method, route, body });
    });
    const send = (body) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'DELETE' || route.endsWith('/send')) {
      res.writeHead(204);
      res.end();
    } else if (route === '/v1/export/fields') {
      const fields = FIELDS[new URL(req.url, apiUrl).searchParams.get('scope') ?? 'task'] ?? [];
      send({ fields, totalCount: fields.length });
    } else if (route === '/v1/export/report-types') {
      send(REPORT_TYPES);
    } else if (route === '/v1/export/templates/tp-full') {
      send(TEMPLATE);
    } else if (route.endsWith('/xml')) {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end('<?xml version="1.0" encoding="UTF-8"?><Invoice/>');
    } else if (route.startsWith('/v1/timer')) {
      send(TIMER);
    } else if (route === '/v1/profiles/me') {
      send(PROFILE);
    } else if (route === '/v1/settings') {
      send(SETTINGS);
    } else if (route.includes('/tasks/') && !route.endsWith('/search')) {
      send(TASK);
    } else {
      send(ENTITY);
    }
  });
  await new Promise((resolve) => apiStub.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${apiStub.address().port}`;

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    MCP_SERVER_URL: 'https://mcp.example.test',
    TIMESHEET_API_URL: apiUrl,
    TIMESHEET_REPORTS_URL: apiUrl,
  };
  delete env.TIMESHEET_API_TOKEN;
  child = spawn(process.execPath, [path.join(pkg, 'dist', 'http-server.js')], { env, stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('http server did not start');
});

after(() => {
  child?.kill();
  apiStub?.close();
});

/** A value for one input property that the handlers accept. */
function sampleValue(name, schema) {
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case 'number':
    case 'integer':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return [sampleValue(name, schema.items ?? { type: 'string' })];
    case 'object':
      return {};
    default:
      if (schema.format === 'date-time' || /DateTime$/.test(name)) return '2026-09-24T09:00:00+02:00';
      if (/Date$/.test(name)) return name.startsWith('end') ? '2026-09-30' : '2026-09-01';
      if (/email/i.test(name)) return 'ada@example.test';
      return `${name}-1`;
  }
}

/** Tools that need more than their required properties: one of several optional ones. */
const EXTRA_ARGUMENTS = {
  project_member_add: { email: 'ada@example.test' },
};

/** Arguments with every required property filled in. */
function sampleArguments(tool) {
  const properties = tool.inputSchema?.properties ?? {};
  const args = { ...EXTRA_ARGUMENTS[tool.name] };
  for (const name of tool.inputSchema?.required ?? []) {
    args[name] = sampleValue(name, properties[name] ?? { type: 'string' });
  }
  return args;
}

test('every tool returns structured content that matches its output schema', async () => {
  const client = new Client({ name: 'schema-check', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(baseUrl + '/'), { requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } } })
  );
  try {
    const tools = [];
    let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined);
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);

    const mismatches = [];
    const toolErrors = [];
    let checked = 0;
    for (const tool of tools) {
      try {
        const result = await client.callTool({ name: tool.name, arguments: sampleArguments(tool) });
        if (result.isError) {
          toolErrors.push(`${tool.name}: ${result.content?.[0]?.text}`);
        } else if (tool.outputSchema) {
          checked++;
        }
      } catch (error) {
        mismatches.push(`${tool.name}: ${error.message}`);
      }
    }

    assert.deepEqual(mismatches, [], 'results that break their schema, or protocol errors');
    // The stub answers every route, so a tool error here means a handler broke on real-shaped data
    assert.deepEqual(toolErrors, [], 'tools that failed on plausible API data');
    assert.ok(checked >= 100, `only ${checked} tools had their structured content checked`);
  } finally {
    await client.close();
  }
});

// claude.ai hands structuredContent to the widget only, so the model reads the text alone: it has
// to name the IDs a follow-up call needs, or Claude guesses one (timer_start then fails on the project).
test('the text of widget tools names the IDs a follow-up call needs', async () => {
  const client = new Client({ name: 'text-id-check', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(baseUrl + '/'), { requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } } })
  );
  try {
    const text = async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      return result.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
    };
    const missing = [];
    const expect = (name, value, needle) => { if (!value.includes(needle)) missing.push(`${name}: ${needle}`); };
    // The stub answers the project routes with ENTITY
    expect('project_list', await text('project_list'), `(ID: ${ENTITY.id})`);
    expect('project_get', await text('project_get', { id: ENTITY.id }), `(ID: ${ENTITY.id})`);
    const taskList = await text('task_list');
    expect('task_list', taskList, TASK.id);
    expect('task_list', taskList, '2026-09-24 09:00-10:30');
    expect('task_list', taskList, PROJECT.title);
    expect('task_get', await text('task_get', { id: TASK.id }), TASK.id);
    const timer = await text('timer_status');
    expect('timer_status', timer, `Project: ${PROJECT.title} (ID: ${PROJECT.id})`);
    expect('timer_status', timer, `Task ID: ${TASK.id}`);
    assert.deepEqual(missing, [], 'IDs and facts missing from the text the model reads');
  } finally {
    await client.close();
  }
});

// The timer in ChatGPT's sidebar, which the widgets also read to refresh a running card: the result
// is dated, and given an entry the timer no longer runs, it reports how that entry was saved.
test('timer_panel dates the timer and reports an entry the timer no longer runs', async () => {
  const client = new Client({ name: 'timer-panel-check', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(baseUrl + '/'), { requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } } })
  );
  try {
    const before = Date.now();
    const stillRunning = await client.callTool({ name: 'timer_panel', arguments: { taskId: TASK.id } });
    assert.equal(stillRunning.isError, undefined);
    assert.ok(stillRunning._meta['timesheet/observedAt'] >= before);
    assert.equal(stillRunning._meta['timesheet/tool'], 'timer_panel');
    assert.equal(stillRunning._meta['timesheet/stoppedTask'], undefined, 'the timer still runs that entry');

    // The stub answers every task route with TASK, a finished entry
    const ended = await client.callTool({ name: 'timer_panel', arguments: { taskId: 'an-earlier-entry' } });
    assert.equal(ended._meta['timesheet/stoppedTask'].endDateTime, TASK.endDateTime);

    const sidebar = await client.callTool({ name: 'timer_sidebar', arguments: {} });
    assert.equal(sidebar._meta['timesheet/tool'], 'timer_sidebar');
    assert.equal(sidebar.structuredContent.status, 'running');
  } finally {
    await client.close();
  }
});

// The heading of a PDF export. @timesheet/sdk 1.3 does not type `title`, so this checks that it
// still reaches the API, in the export params and in the template data.
test('the export title reaches the API', async () => {
  const client = new Client({ name: 'export-title-check', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(baseUrl + '/'), { requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } } })
  );
  try {
    const title = 'Hours report, Jane Smith';
    const range = { startDate: '2026-10-01', endDate: '2026-10-31' };
    /** The body of the last request the tool sent to the route. */
    const sent = async (name, args, method, route) => {
      apiRequests.length = 0;
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, undefined, `${name}: ${result.content?.[0]?.text}`);
      return apiRequests.filter((r) => r.method === method && r.route === route).at(-1)?.body;
    };

    const generated = await sent('export_generate', { report: 1, ...range, format: 'pdf', title }, 'POST', '/v1/export/data');
    assert.equal(generated?.title, title);
    const emailed = await sent('export_send', { email: 'jane@example.test', report: 1, ...range, format: 'pdf', title }, 'POST', '/v1/export/send');
    assert.equal(emailed?.title, title);
    const created = await sent('export_template_create', { name: 'Monthly hours', format: 'pdf', title }, 'POST', '/v1/export/templates');
    assert.equal(created?.title, title);

    // '' clears the template's title; leaving it out keeps it, so it is not sent at all
    const cleared = await sent('export_template_update', { templateId: 'tp1', title: '' }, 'PUT', '/v1/export/templates/tp1');
    assert.equal(cleared?.title, '');
    const renamed = await sent('export_template_update', { templateId: 'tp1', name: 'Renamed' }, 'PUT', '/v1/export/templates/tp1');
    assert.equal('title' in renamed, false);

    // The stub answers the template read with ENTITY, whose title is "Sample"
    const fromTemplate = await sent('export_from_template', { templateId: 'tp1', ...range }, 'POST', '/v1/export/data');
    assert.equal(fromTemplate?.title, ENTITY.title);
  } finally {
    await client.close();
  }
});

// export_send took fewer settings than export_generate, and export_template_update five: every
// setting a tool takes has to reach the API, the columns as the objects the API reads. A template
// update leaves out what the call leaves out, so the stored value stays.
test('every export setting reaches the API', async () => {
  const client = new Client({ name: 'export-settings-check', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(baseUrl + '/'), { requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } } })
  );
  try {
    const range = { startDate: '2026-10-01', endDate: '2026-10-31' };
    const settings = {
      format: 'pdf',
      teamIds: ['tm1'],
      projectIds: ['p1'],
      userIds: ['u1'],
      tagIds: ['g1'],
      type: 'task',
      filter: 'billable',
      splitTask: true,
      summarize: true,
      filename: 'hours',
      title: 'Hours report, Jane Smith',
    };
    const exportedFields = ['DURATION', 'CUSTOM_cf1'];
    // As the web app sends them: the field's name and scope flags, its position, custom field data
    const columns = [
      { id: 'DURATION', name: 'Duration', position: 0, projectField: false, teamField: false, customField: false },
      { id: 'CUSTOM_cf1', name: 'Cost center', position: 1, projectField: false, teamField: false, customField: true, customType: 'text', customValue: 'CC-42' },
    ];
    const call = async (name, args) => {
      apiRequests.length = 0;
      return client.callTool({ name, arguments: args });
    };
    /** The body of the last request the tool sent to the route. */
    const sent = async (name, args, method, route) => {
      const result = await call(name, args);
      assert.equal(result.isError, undefined, `${name}: ${result.content?.[0]?.text}`);
      return apiRequests.filter((r) => r.method === method && r.route === route).at(-1)?.body;
    };
    const hasSettings = (tool, body) => {
      for (const [key, value] of Object.entries(settings)) {
        assert.deepEqual(body?.[key], value, `${tool} sends ${key}`);
      }
      assert.deepEqual(body?.exportedFields, columns, `${tool} sends the columns`);
    };
    const fetchedTemplate = () => apiRequests.some((r) => r.method === 'GET' && r.route.startsWith('/v1/export/templates/'));

    hasSettings('export_generate', await sent('export_generate', { report: 1, ...range, ...settings, exportedFields }, 'POST', '/v1/export/data'));

    const emailed = await sent('export_send', { email: 'jane@example.test', report: 1, ...range, ...settings, exportedFields }, 'POST', '/v1/export/send');
    hasSettings('export_send', emailed);
    assert.equal(emailed.email, 'jane@example.test');

    const created = await sent('export_template_create', { name: 'Monthly hours', report: 1, email: 'jane@example.test', ...settings, exportedFields }, 'POST', '/v1/export/templates');
    hasSettings('export_template_create', created);
    assert.deepEqual([created.name, created.report, created.email], ['Monthly hours', 1, 'jane@example.test']);

    const updated = await sent('export_template_update', { templateId: 'tp1', name: 'Renamed', report: 1, email: 'jane@example.test', ...settings, exportedFields }, 'PUT', '/v1/export/templates/tp1');
    hasSettings('export_template_update', updated);
    assert.deepEqual([updated.name, updated.report, updated.email], ['Renamed', 1, 'jane@example.test']);
    assert.equal(fetchedTemplate(), false, 'a named update does not read the template');

    // Without a name the update reads the template and sends its name, as earlier Reports API
    // versions refuse an update without one. The settings left out stay left out.
    const partial = await sent('export_template_update', { templateId: 'tp-full', summarize: false }, 'PUT', '/v1/export/templates/tp-full');
    assert.deepEqual(partial, { name: TEMPLATE.name, summarize: false });

    // Columns without a report type are matched to the stored one
    const recolumned = await sent('export_template_update', { templateId: 'tp-full', exportedFields: ['DATE'] }, 'PUT', '/v1/export/templates/tp-full');
    assert.deepEqual(recolumned.exportedFields, [{ id: 'DATE', name: 'Date', position: 0, projectField: false, teamField: false, customField: false }]);

    // A project summary takes project columns, marked as such, or the API drops them
    const projectSummary = await sent('export_generate', { report: 4, ...range, exportedFields: ['PROJECT_TITLE'] }, 'POST', '/v1/export/data');
    assert.deepEqual(projectSummary.exportedFields, [{ id: 'PROJECT_TITLE', name: 'Project', position: 0, projectField: true, teamField: false, customField: false }]);

    // An unknown column, or columns for a report type with fixed ones, are refused before the export
    const unknown = await call('export_generate', { report: 1, ...range, exportedFields: ['NOPE'] });
    assert.equal(unknown.isError, true);
    assert.match(unknown.content[0].text, /NOPE.*export_fields with scope "task"/);
    const fixed = await call('export_generate', { report: 12, ...range, exportedFields: ['DATE'] });
    assert.equal(fixed.isError, true);
    assert.match(fixed.content[0].text, /fixed columns/);
    assert.equal(apiRequests.some((r) => r.route === '/v1/export/data'), false, 'no export after a refused column');

    // An export from a template carries every setting it stores
    const fromTemplate = await sent('export_from_template', { templateId: 'tp-full', ...range }, 'POST', '/v1/export/data');
    for (const key of ['report', 'format', 'teamIds', 'projectIds', 'userIds', 'tagIds', 'type', 'filter', 'splitTask', 'summarize', 'filename', 'title', 'exportedFields']) {
      assert.deepEqual(fromTemplate[key], TEMPLATE[key], `export_from_template sends ${key}`);
    }

    // claude.ai gives the model only the text: it names every stored setting
    const details = (await call('export_template_get', { templateId: 'tp-full' })).content[0].text;
    for (const line of [
      'Template: Monthly hours (ID: tp-full)', 'Report type: 1', 'Format: pdf', 'Team IDs: tm1', 'Project IDs: p1', 'User IDs: u1',
      'Tag IDs: g1', 'Entry type: task', 'Billing filter: billable', 'Split at breaks: yes', 'Totals row: yes',
      'Email: jane@example.test', 'File name: hours', 'PDF title: Hours report, Jane Smith', 'Columns: Duration (DURATION)',
    ]) {
      assert.ok(details.includes(line), `export_template_get text lacks "${line}":\n${details}`);
    }
    // and the columns and report types it can choose from
    const fields = (await call('export_fields', { scope: 'task' })).content[0].text;
    assert.ok(fields.includes('Cost center (CUSTOM_cf1)'), fields);
    const types = (await call('export_report_types', {})).content[0].text;
    assert.ok(types.includes('1: Hours (columns: export_fields scope "task")'), types);
    assert.ok(types.includes('12: Absences\n') || types.endsWith('12: Absences'), types);
  } finally {
    await client.close();
  }
});

// The Claude directory lists each tool by annotations.title and flags a tool that doesn't say
// whether it only reads or also changes data.
test('every tool has the title and hints the Claude directory lists', async () => {
  const client = new Client({ name: 'annotation-check', version: '1' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(baseUrl + '/'), { requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } } })
  );
  try {
    const incomplete = [];
    let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined);
      for (const tool of page.tools) {
        const { title, readOnlyHint, destructiveHint } = tool.annotations ?? {};
        if (!title || title !== tool.title || typeof readOnlyHint !== 'boolean' || typeof destructiveHint !== 'boolean') {
          incomplete.push(tool.name);
        }
      }
      cursor = page.nextCursor;
    } while (cursor);
    assert.deepEqual(incomplete, [], 'tools without annotations.title or the read-only and destructive hints');
  } finally {
    await client.close();
  }
});
