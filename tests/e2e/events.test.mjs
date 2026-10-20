// MCP Events over HTTP with a 2026-07-28 client, as ChatGPT connects: the capability in
// server/discover, the event list, and subscribe/unsubscribe forwarded to the backend, including
// how backend refusals map to the draft's error codes. Run against the BUILT server
// (`npm run build` first). The Timesheet API is a local stub; no real API is called.
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
const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const CALLBACK = 'https://chatgpt.example/mcp-events/cb_1';

let apiStub;
let child;
let baseUrl;
const backendCalls = [];

/** The backend's answers, by callback URL, for the refusal cases. */
const REFUSALS = {
  'https://chatgpt.example/fails-verification': [422, { error: 'CallbackEndpointError', message: 'challenge_failed' }],
  'https://chatgpt.example/too-many': [422, { error: 'ResourceExhausted', message: 'subscriptions' }],
  'https://chatgpt.example/private': [400, { error: 'BadRequestException', message: 'The callback URL does not resolve to a public address.' }],
  'https://chatgpt.example/basic-plan': [402, { error: 'tier_insufficient' }],
  'https://chatgpt.example/rate-limited': [429, { error: 'Too Many Requests', message: 'Rate limit exceeded.' }],
};

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
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const route = req.url.split('?')[0];
      const body = raw ? JSON.parse(raw) : undefined;
      const send = (status, payload) => {
        res.writeHead(status, payload === undefined ? {} : { 'Content-Type': 'application/json' });
        res.end(payload === undefined ? undefined : JSON.stringify(payload));
      };
      if (route === '/v1/webhooks/subscribe' || route === '/v1/webhooks/unsubscribe') {
        backendCalls.push({ route, body });
        const refusal = REFUSALS[body.url];
        if (refusal) return send(...refusal);
        return route.endsWith('/subscribe') ? send(200, { id: 'sub-1', refreshBefore: '2026-10-21T10:00:00Z' }) : send(204);
      }
      send(200, { id: 'u1', firstname: 'Ada' });
    });
  });
  await new Promise((resolve) => apiStub.listen(0, '127.0.0.1', resolve));
  const apiUrl = `http://127.0.0.1:${apiStub.address().port}`;

  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', MCP_SERVER_URL: 'https://mcp.example.test', TIMESHEET_API_URL: apiUrl, TIMESHEET_REPORTS_URL: apiUrl };
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

/** Custom methods need a result schema: this one takes the result as it is. */
const anyResult = { '~standard': { version: 1, vendor: 'test', validate: (value) => ({ value }) } };

async function connect(records) {
  const recordingFetch = async (url, init) => {
    const response = await fetch(url, init);
    records?.push({ request: init?.body ? JSON.parse(init.body) : undefined, body: await response.clone().text() });
    return response;
  };
  const client = new Client({ name: 'events-e2e', version: '1' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
  await client.connect(new StreamableHTTPClientTransport(new URL(baseUrl + '/'), {
    fetch: recordingFetch,
    requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
  }));
  return client;
}

const subscribeParams = (overrides = {}) => ({
  name: 'timer.stop',
  arguments: {},
  delivery: { mode: 'webhook', url: CALLBACK, secret: SECRET },
  cursor: null,
  ...overrides,
});

test('server/discover advertises events both ways: ChatGPT reads the top-level key, SEP-3415 the extension', async () => {
  const records = [];
  const client = await connect(records);
  try {
    const discover = records.find((r) => r.request?.method === 'server/discover');
    const result = JSON.parse(discover.body.replace(/^[\s\S]*?data: /, '').split('\n')[0] || discover.body).result
      ?? JSON.parse(discover.body).result;
    assert.deepEqual(result.capabilities.events, {});
    assert.deepEqual(result.capabilities.extensions['io.modelcontextprotocol/events'], {});
  } finally {
    await client.close();
  }
});

test('events/list names the events, webhook delivery only, without arguments', async () => {
  const client = await connect();
  try {
    const { events } = await client.request({ method: 'events/list', params: {} }, anyResult);
    assert.deepEqual(events.map((e) => e.name), [
      'timer.start', 'timer.stop', 'timer.pause', 'timer.resume', 'task.create', 'task.update',
      'project.create', 'project.update', 'todo.create', 'todo.update',
    ]);
    for (const event of events) {
      assert.deepEqual(event.delivery, ['webhook']);
      assert.deepEqual(event.inputSchema, { type: 'object', properties: {}, additionalProperties: false });
      assert.equal(event.payloadSchema.type, 'object');
      assert.ok(event.description.length > 20);
    }
  } finally {
    await client.close();
  }
});

test('events/subscribe forwards to the backend and answers without a cursor', async () => {
  const client = await connect();
  backendCalls.length = 0;
  try {
    const result = await client.request({ method: 'events/subscribe', params: subscribeParams({ ttlMs: 3_600_000 }) }, anyResult);
    assert.equal(result.id, 'sub-1');
    assert.equal(result.refreshBefore, '2026-10-21T10:00:00Z');
    assert.equal(result.cursor, null);
    assert.equal(result.truncated, false);
    assert.deepEqual(backendCalls, [{
      route: '/v1/webhooks/subscribe',
      body: { name: 'timer.stop', arguments: {}, url: CALLBACK, secret: SECRET, ttlMs: 3_600_000 },
    }]);
  } finally {
    await client.close();
  }
});

test('events/unsubscribe forwards to the backend and answers an empty result', async () => {
  const client = await connect();
  backendCalls.length = 0;
  try {
    const result = await client.request({
      method: 'events/unsubscribe',
      params: { name: 'timer.stop', arguments: {}, delivery: { mode: 'webhook', url: CALLBACK } },
    }, anyResult);
    assert.equal(Object.keys(result).filter((key) => key !== 'resultType' && key !== '_meta').length, 0);
    assert.deepEqual(backendCalls, [{ route: '/v1/webhooks/unsubscribe', body: { name: 'timer.stop', arguments: {}, url: CALLBACK } }]);
  } finally {
    await client.close();
  }
});

test('refusals carry the codes ChatGPT implements', async () => {
  const client = await connect();
  const failure = async (params) => {
    try {
      await client.request({ method: 'events/subscribe', params }, anyResult);
    } catch (error) {
      return { code: error.code, data: error.data };
    }
    assert.fail(`no error for ${JSON.stringify(params)}`);
  };
  backendCalls.length = 0;
  try {
    assert.deepEqual(await failure(subscribeParams({ name: 'invoice.paid' })), { code: -32011, data: { kind: 'event' } });
    assert.deepEqual(await failure(subscribeParams({ delivery: { mode: 'push', url: CALLBACK, secret: SECRET } })),
      { code: -32014, data: { feature: 'deliveryMode', value: 'push' } });
    assert.equal((await failure(subscribeParams({ arguments: { projectId: 'p1' } }))).code, -32602);
    assert.equal((await failure(subscribeParams({ delivery: { mode: 'webhook', url: CALLBACK } }))).code, -32602);
    // None of those reached the backend
    assert.equal(backendCalls.length, 0);

    const at = (url) => subscribeParams({ delivery: { mode: 'webhook', url, secret: SECRET } });
    assert.deepEqual(await failure(at('https://chatgpt.example/fails-verification')), { code: -32015, data: { reason: 'challenge_failed' } });
    assert.deepEqual(await failure(at('https://chatgpt.example/too-many')), { code: -32013, data: { limit: 'subscriptions' } });
    assert.equal((await failure(at('https://chatgpt.example/private'))).code, -32602);
    assert.equal((await failure(at('https://chatgpt.example/basic-plan'))).code, -32012);
    assert.deepEqual(await failure(at('https://chatgpt.example/rate-limited')), { code: -32013, data: { limit: 'requests' } });
  } finally {
    await client.close();
  }
});
