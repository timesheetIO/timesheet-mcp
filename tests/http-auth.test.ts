import { describe, expect, jest, test } from '@jest/globals';
import {
  createDocumentProxy,
  getAuthChallenge,
  getJsonRpcRequestId,
  getProtectedResourceMetadata,
  getWWWAuthenticateHeader,
  getMcpServerUrl,
} from '../src/mcp-app-helpers.js';

const NOW = Date.UTC(2026, 8, 24, 12, 0, 0);

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.c2lnbmF0dXJl`;
}

const API_KEY = 'ts_abc12345.xyz67890abcdef123456789';

describe('401 challenge on the MCP endpoint', () => {
  test('no credentials and no environment key: challenge without an error', () => {
    expect(getAuthChallenge(null, false, NOW)).toEqual({});
  });

  test('no credentials but TIMESHEET_API_TOKEN set (local development): passes', () => {
    expect(getAuthChallenge(null, true, NOW)).toBeNull();
  });

  test('expired OAuth access token: invalid_token so the client refreshes', () => {
    const expired = jwt({ sub: 'user-1', exp: NOW / 1000 - 60 });
    expect(getAuthChallenge(expired, false, NOW)).toEqual({
      error: 'invalid_token',
      errorDescription: 'The access token expired',
    });
  });

  test('a token that expires this very second counts as expired', () => {
    expect(getAuthChallenge(jwt({ exp: NOW / 1000 }), false, NOW)?.error).toBe('invalid_token');
  });

  test('unexpired OAuth access token: passes', () => {
    expect(getAuthChallenge(jwt({ sub: 'user-1', exp: NOW / 1000 + 3600 }), false, NOW)).toBeNull();
  });

  test('API key: never challenged, the API decides', () => {
    expect(getAuthChallenge(API_KEY, false, NOW)).toBeNull();
  });

  test('JWT without exp or with an unreadable payload: passes to the API', () => {
    expect(getAuthChallenge(jwt({ sub: 'user-1' }), false, NOW)).toBeNull();
    expect(getAuthChallenge('aaaa.bm90LWpzb24.cccc', false, NOW)).toBeNull();
  });

  test('opaque token: passes to the API', () => {
    expect(getAuthChallenge('some-opaque-token', false, NOW)).toBeNull();
  });
});

describe('WWW-Authenticate header', () => {
  const resourceMetadata = `${getMcpServerUrl()}/.well-known/oauth-protected-resource`;

  test('points at the protected resource metadata', () => {
    expect(getWWWAuthenticateHeader()).toBe(`Bearer resource_metadata="${resourceMetadata}"`);
  });

  test('carries error and description for invalid tokens', () => {
    expect(getWWWAuthenticateHeader('invalid_token', 'The access token expired')).toBe(
      `Bearer resource_metadata="${resourceMetadata}", error="invalid_token", ` +
        'error_description="The access token expired"'
    );
  });

  test('escapes quotes and backslashes and drops line breaks', () => {
    const header = getWWWAuthenticateHeader('invalid_token', 'bad "token"\\ here\r\nX-Injected: 1');
    expect(header).toContain('error_description="bad \\"token\\"\\\\ here  X-Injected: 1"');
    expect(header).not.toMatch(/[\r\n]/);
  });
});

describe('JSON-RPC id of the refused request', () => {
  test('single request keeps its id', () => {
    expect(getJsonRpcRequestId({ jsonrpc: '2.0', id: 7, method: 'tools/list' })).toBe(7);
    expect(getJsonRpcRequestId({ jsonrpc: '2.0', id: 'abc', method: 'initialize' })).toBe('abc');
  });

  test('batch, notification or missing body answers with null', () => {
    expect(getJsonRpcRequestId([{ id: 1 }])).toBeNull();
    expect(getJsonRpcRequestId({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    expect(getJsonRpcRequestId(undefined)).toBeNull();
  });
});

describe('protected resource metadata', () => {
  test('documentation link points at the MCP server docs page', () => {
    expect(getProtectedResourceMetadata().resource_documentation).toBe(
      'https://docs.timesheet.io/integrations/mcp-server'
    );
  });
});

describe('authorization server metadata proxy', () => {
  const URL = 'https://api.timesheet.io/.well-known/oauth-authorization-server';
  const DOCUMENT = { issuer: 'https://api.timesheet.io', token_endpoint_auth_methods_supported: ['none'] };
  const HOUR = 60 * 60 * 1000;

  function ok(body: unknown) {
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }

  test('serves the live document', async () => {
    const fetchFn = jest.fn(async () => ok(DOCUMENT));
    const load = createDocumentProxy(URL, { fetchFn: fetchFn as unknown as typeof fetch, now: () => NOW });

    await expect(load()).resolves.toEqual({ status: 200, body: DOCUMENT });
    expect(fetchFn).toHaveBeenCalledWith(URL, expect.anything());
  });

  test('answers from the cache within the hour', async () => {
    let now = NOW;
    const fetchFn = jest.fn(async () => ok(DOCUMENT));
    const load = createDocumentProxy(URL, { fetchFn: fetchFn as unknown as typeof fetch, now: () => now });

    await load();
    now += HOUR - 1;
    await load();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    now += 1;
    await load();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('keeps serving the last good copy when a refresh fails, and retries after a minute', async () => {
    let now = NOW;
    let fail = false;
    const fetchFn = jest.fn(async () => {
      if (fail) {
        throw new Error('network down');
      }
      return ok(DOCUMENT);
    });
    const load = createDocumentProxy(URL, { fetchFn: fetchFn as unknown as typeof fetch, now: () => now });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    await load();
    fail = true;
    now += HOUR;
    await expect(load()).resolves.toEqual({ status: 200, body: DOCUMENT });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    now += 30 * 1000;
    await load();
    expect(fetchFn).toHaveBeenCalledTimes(2);

    now += 30 * 1000;
    await load();
    expect(fetchFn).toHaveBeenCalledTimes(3);
    errorLog.mockRestore();
  });

  test('answers 502 when the document was never loaded', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 503 }) as unknown as Response);
    const load = createDocumentProxy(URL, { fetchFn: fetchFn as unknown as typeof fetch, now: () => NOW });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await load();
    expect(result.status).toBe(502);
    expect(result.body).toEqual(expect.objectContaining({ error: 'temporarily_unavailable' }));
    errorLog.mockRestore();
  });
});
