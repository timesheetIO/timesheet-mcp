// End-to-end protocol tests against the BUILT server (run `npm run build` first):
// stdio and HTTP, protocol 2025-era and 2026-07-28, the 401 gate, CORS and cache hints.
// The Timesheet API is a local stub that answers 401, so no real API is ever called.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const pkg = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_KEY = 'ts_abc12345.xyz67890';
const MCP_URL = 'https://mcp.example.test';
const CHALLENGE = `Bearer resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource"`;
const LEGACY_VERSION = '2025-06-18';
const MODERN_VERSION = '2026-07-28';

let apiStub;
let apiUrl;

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

/** A JWT with the given payload; nothing checks its signature before the API does. */
function jwt(payload) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.sig`;
}

/** JSON-RPC results from a response body that is either JSON or an SSE stream. */
function rpcMessages(contentType, body) {
  if ((contentType || '').includes('text/event-stream')) {
    return body
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)));
  }
  const parsed = JSON.parse(body);
  return Array.isArray(parsed) ? parsed : [parsed];
}

before(async () => {
  // The API: every call is unauthorized. Timer calls answer late, to test a client disconnecting.
  apiStub = http.createServer((req, res) => {
    const reply = () => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized', message: 'Authentication failed' }));
    };
    if (req.url.includes('timer')) setTimeout(reply, 1500);
    else reply();
  });
  await new Promise((resolve) => apiStub.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${apiStub.address().port}`;
});

after(() => apiStub.close());

describe('stdio', () => {
  const env = () => ({ ...process.env, TIMESHEET_API_TOKEN: API_KEY, TIMESHEET_API_URL: apiUrl });

  test('2025-era client: initialize and three tools/list pages, JSON only on stdout', async () => {
    const child = spawn(process.execPath, [path.join(pkg, 'dist', 'index.js')], { env: env() });
    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    const send = (message) => child.stdin.write(JSON.stringify(message) + '\n');
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: LEGACY_VERSION, capabilities: {}, clientInfo: { name: 'e2e', version: '1' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    send({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: { cursor: '50' } });
    send({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: { cursor: '100' } });
    // stdin stays open while the answers arrive: the server stops answering once it closes
    await new Promise((resolve) => setTimeout(resolve, 2500));
    child.kill();

    const lines = stdout.split('\n').filter(Boolean);
    const messages = lines.map((line) => JSON.parse(line)); // throws on any non-JSON stdout
    const byId = Object.fromEntries(messages.map((m) => [m.id, m]));
    assert.equal(byId[1].result.protocolVersion, LEGACY_VERSION);
    assert.deepEqual(byId[1].result.capabilities.extensions, { 'io.modelcontextprotocol/ui': {} });
    assert.equal(byId[2].result.tools.length, 50);
    assert.equal(byId[2].result.nextCursor, '50');
    assert.equal(byId[3].result.tools.length, 50);
    assert.equal(byId[3].result.nextCursor, '100');
    assert.equal(byId[4].result.tools.length, 23);
    assert.equal(byId[4].result.nextCursor, undefined);
    for (const message of messages) {
      assert.equal('ttlMs' in (message.result ?? {}), false, 'no cache hints on 2025 responses');
    }
  });

  for (const [label, versionNegotiation, era] of [
    ['2026-07-28 client pinned', { mode: { pin: MODERN_VERSION } }, 'modern'],
    ['2026-07-28 client in auto mode', { mode: 'auto' }, 'modern'],
    ['v2 client without negotiation', undefined, 'legacy'],
  ]) {
    test(`${label}: era ${era}, tools listed, a tool error stays a tool error`, async () => {
      const client = new Client({ name: 'e2e', version: '1' }, versionNegotiation ? { versionNegotiation } : {});
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.join(pkg, 'dist', 'index.js')],
        env: env(),
        stderr: 'ignore',
      });
      await client.connect(transport);
      try {
        assert.equal(client.getProtocolEra(), era);
        // The v2 client follows the cursors itself
        const all = await client.listTools();
        assert.equal(all.tools.length, 123);
        const result = await client.callTool({ name: 'timer_status', arguments: {} });
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /401/);
      } finally {
        await client.close();
      }
    });
  }
});

describe('http', () => {
  let child;
  let baseUrl;
  const records = [];

  before(async () => {
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', MCP_SERVER_URL: MCP_URL, TIMESHEET_API_URL: apiUrl };
    delete env.TIMESHEET_API_TOKEN; // no fallback identity: a request without a token must get the 401
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

  after(() => child.kill());

  const post = (body, headers = {}) =>
    fetch(baseUrl + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
      body: JSON.stringify(body),
    });
  const withKey = { Authorization: `Bearer ${API_KEY}` };

  /** A fetch that records every exchange, for checking what went over the wire. */
  const recordingFetch = async (url, init) => {
    const response = await fetch(url, init);
    const body = await response.clone().text();
    records.push({ request: init?.body ? JSON.parse(init.body) : undefined, status: response.status, headers: response.headers, body });
    return response;
  };

  test('401 gate: a 2025 initialize without credentials', async () => {
    const response = await post({ jsonrpc: '2.0', id: 7, method: 'initialize', params: { protocolVersion: LEGACY_VERSION, capabilities: {}, clientInfo: { name: 'e2e', version: '1' } } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), CHALLENGE);
    assert.deepEqual(await response.json(), { jsonrpc: '2.0', error: { code: -32001, message: 'Authentication required' }, id: 7 });
  });

  test('401 gate: the 2026-07-28 server/discover probe without credentials', async () => {
    records.length = 0;
    const client = new Client({ name: 'e2e', version: '1' }, { versionNegotiation: { mode: { pin: MODERN_VERSION } } });
    await assert.rejects(client.connect(new StreamableHTTPClientTransport(new URL(baseUrl + '/'), { fetch: recordingFetch })));
    const probe = records.find((r) => r.request?.method === 'server/discover');
    assert.ok(probe, 'the client sent server/discover');
    assert.equal(probe.status, 401);
    assert.equal(probe.headers.get('www-authenticate'), CHALLENGE);
  });

  test('401 gate: an expired JWT is invalid_token', async () => {
    const response = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Authorization: `Bearer ${jwt({ sub: 'u', exp: 1_000_000 })}` });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), `${CHALLENGE}, error="invalid_token", error_description="The access token expired"`);
  });

  test('2025-era requests with an API key: initialize, pages, resources, errors', async () => {
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: LEGACY_VERSION, capabilities: {}, clientInfo: { name: 'e2e', version: '1' } } }, withKey);
    assert.equal(init.status, 200);
    assert.equal(init.headers.get('mcp-session-id'), null, 'stateless: no session');
    const [initResult] = rpcMessages(init.headers.get('content-type'), await init.text());
    assert.equal(initResult.result.protocolVersion, LEGACY_VERSION);

    const call = async (id, method, params) => {
      const response = await post({ jsonrpc: '2.0', id, method, params }, { ...withKey, 'MCP-Protocol-Version': LEGACY_VERSION });
      assert.equal(response.status, 200);
      return rpcMessages(response.headers.get('content-type'), await response.text())[0];
    };

    const pages = [await call(2, 'tools/list', {}), await call(3, 'tools/list', { cursor: '50' }), await call(4, 'tools/list', { cursor: '100' })];
    assert.deepEqual(pages.map((p) => p.result.tools.length), [50, 50, 23]);
    assert.equal(pages.flatMap((p) => p.result.tools).length, 123);

    const resources = await call(5, 'resources/list', {});
    assert.equal(resources.result.resources.length, 8);
    const widget = await call(6, 'resources/read', { uri: 'ui://timesheet/TimerWidget.html' });
    assert.equal(widget.result.contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.ok(widget.result.contents[0]._meta.ui.csp);

    const unknownResource = await call(7, 'resources/read', { uri: 'ui://timesheet/Nope.html' });
    assert.equal(unknownResource.error.code, -32602);
    assert.deepEqual(unknownResource.error.data, { uri: 'ui://timesheet/Nope.html' });
    const unknownTool = await call(8, 'tools/call', { name: 'no_such_tool', arguments: {} });
    assert.equal(unknownTool.error.code, -32602);

    const toolError = await call(9, 'tools/call', { name: 'project_list', arguments: {} });
    assert.equal(toolError.result.isError, true);

    for (const message of [...pages, resources, widget, toolError]) {
      assert.equal('ttlMs' in message.result, false, 'no cache hints on 2025 responses');
    }
  });

  test('a POST that is not JSON is refused with 415', async () => {
    const response = await fetch(baseUrl + '/', { method: 'POST', headers: { 'Content-Type': 'text/plain', ...withKey }, body: 'hello' });
    assert.equal(response.status, 415);
  });

  for (const [label, versionNegotiation] of [
    ['pinned', { mode: { pin: MODERN_VERSION } }],
    ['auto', { mode: 'auto' }],
  ]) {
    test(`2026-07-28 client (${label}) with an API key: modern era, cache hints only where allowed`, async () => {
      records.length = 0;
      const client = new Client({ name: 'e2e', version: '1' }, { versionNegotiation });
      await client.connect(new StreamableHTTPClientTransport(new URL(baseUrl + '/'), { fetch: recordingFetch, requestInit: { headers: withKey } }));
      try {
        assert.equal(client.getProtocolEra(), 'modern');
        const tools = await client.listTools();
        assert.equal(tools.tools.length, 123);
        const widget = await client.readResource({ uri: 'ui://timesheet/Statistics.html' });
        assert.equal(widget.contents[0].mimeType, 'text/html;profile=mcp-app');
        const result = await client.callTool({ name: 'timer_status', arguments: {} });
        assert.equal(result.isError, true);
      } finally {
        await client.close();
      }

      const resultFor = (method) => {
        const record = records.find((r) => r.request?.method === method && r.status === 200);
        assert.ok(record, `a ${method} exchange was recorded`);
        return rpcMessages(record.headers.get('content-type'), record.body).find((m) => 'result' in m).result;
      };
      assert.equal(records.filter((r) => r.request?.method === 'tools/list').length, 3, 'three pages on the wire');
      for (const method of ['server/discover', 'tools/list', 'resources/read']) {
        const result = resultFor(method);
        assert.equal(result.cacheScope, 'public', `${method} is publicly cacheable`);
        assert.ok(result.ttlMs > 0, `${method} has a ttl`);
      }
      const call = resultFor('tools/call');
      assert.equal('ttlMs' in call, false, 'tools/call is never cached');
      assert.equal('cacheScope' in call, false);
    });
  }

  test('CORS preflight allows the 2026-07-28 headers', async () => {
    const response = await fetch(baseUrl + '/', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://chatgpt.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'mcp-method, mcp-name, mcp-protocol-version, authorization, content-type',
      },
    });
    assert.equal(response.status, 204);
    const allowed = (response.headers.get('access-control-allow-headers') || '').toLowerCase();
    for (const header of ['mcp-method', 'mcp-name', 'mcp-protocol-version', 'authorization', 'content-type']) {
      assert.ok(allowed.includes(header), `${header} is allowed`);
    }
  });

  test('a browser GET gets the landing page', async () => {
    const response = await fetch(baseUrl + '/', { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<!DOCTYPE html>/i);
  });

  test('a client that disconnects mid-call does not take the server down', async () => {
    const controller = new AbortController();
    const pending = fetch(baseUrl + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...withKey },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'timer_status', arguments: {} } }),
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 200);
    await assert.rejects(pending, { name: 'AbortError' });
    // The API answers after 1.5 s, into a request nobody waits for any more
    await new Promise((resolve) => setTimeout(resolve, 2000));
    assert.equal(child.exitCode, null, 'still running');
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
  });
});
