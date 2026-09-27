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

let apiStub;
let apiUrl;
let child;
let baseUrl;

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
    req.resume();
    const route = req.url.split('?')[0];
    const send = (body) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'DELETE' || route.endsWith('/send')) {
      res.writeHead(204);
      res.end();
    } else if (route.endsWith('/fields')) {
      send({ fields: [{ fieldId: 'duration', name: 'Duration', type: 'DURATION', category: 'TASK' }], totalCount: 1 });
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
