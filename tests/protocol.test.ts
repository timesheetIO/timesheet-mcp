import { describe, expect, test } from '@jest/globals';
import { ResourceNotFoundError, ProtocolErrorCode, isSpecType } from '@modelcontextprotocol/server';
import {
  CACHE_HINTS,
  TOOLS_LIST_PAGE_SIZE,
  listWidgetResources,
  paginate,
  toAuthInfo,
} from '../src/mcp-app-helpers.js';
import { TOOL_DEFINITIONS, TOOL_OUTPUT_SCHEMAS } from '../src/tool-definitions.js';
import { dispatchExtendedTool } from '../src/extended-tools.js';

/** A JWT with the given payload; the signature is never checked here. */
function jwt(payload: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.sig`;
}

describe('cache hints (protocol 2026-07-28)', () => {
  test('only the static lists, widget reads and discover are cacheable, publicly', () => {
    expect(Object.keys(CACHE_HINTS).sort()).toEqual(['resources/list', 'resources/read', 'server/discover', 'tools/list']);
    for (const hint of Object.values(CACHE_HINTS)) {
      expect(hint.cacheScope).toBe('public');
      expect(hint.ttlMs).toBeGreaterThan(0);
    }
    expect(CACHE_HINTS).not.toHaveProperty('tools/call');
  });

  // resources/read is hinted per operation, so a per-user resource would be cached publicly.
  // This fails the moment a resource that is not a static ui:// widget shows up.
  test('every resource is a static ui:// widget', () => {
    for (const resource of listWidgetResources()) {
      expect(resource.uri.startsWith('ui://timesheet/')).toBe(true);
    }
  });
});

describe('toAuthInfo', () => {
  test('an API key', () => {
    const info = toAuthInfo('ts_abc123.def456');
    expect(info).toMatchObject({ token: 'ts_abc123.def456', scopes: [], extra: { scheme: 'apiKey' } });
    expect(info.expiresAt).toBeUndefined();
  });

  test('an OAuth JWT carries its expiry', () => {
    const token = jwt({ sub: 'u1', exp: 1_900_000_000 });
    expect(toAuthInfo(token)).toMatchObject({ token, expiresAt: 1_900_000_000, extra: { scheme: 'oauth' } });
  });

  test('an opaque token', () => {
    const info = toAuthInfo('opaque-token');
    expect(info.extra).toEqual({ scheme: 'oauth' });
    expect(info.expiresAt).toBeUndefined();
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 123 }, (_, i) => i);

  test('pages of 50, 50 and 23 with offset cursors', () => {
    const first = paginate(items, undefined, 50);
    expect(first.page).toHaveLength(50);
    expect(first.nextCursor).toBe('50');
    const second = paginate(items, first.nextCursor, 50);
    expect(second.page[0]).toBe(50);
    expect(second.nextCursor).toBe('100');
    const third = paginate(items, second.nextCursor, 50);
    expect(third.page).toHaveLength(23);
    expect(third.nextCursor).toBeUndefined();
  });

  test('an unreadable cursor starts from the beginning', () => {
    expect(paginate(items, 'nonsense', 50).page[0]).toBe(0);
    expect(paginate(items, 42, 50).page[0]).toBe(0);
  });

  test('a cursor past the end gives an empty last page', () => {
    expect(paginate(items, '500', 50)).toEqual({ page: [] });
  });
});

describe('tool definitions', () => {
  test('123 tools with unique names, pageable in three pages', () => {
    const names = TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(names).toHaveLength(123);
    expect(new Set(names).size).toBe(names.length);
    expect(Math.ceil(names.length / TOOLS_LIST_PAGE_SIZE)).toBe(3);
  });

  test('every definition is a valid Tool and every outputSchema an object schema', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(isSpecType.Tool(tool)).toBe(true);
      expect(tool.inputSchema.type).toBe('object');
      const outputSchema = TOOL_OUTPUT_SCHEMAS.get(tool.name);
      if (outputSchema) {
        expect(outputSchema.type).toBe('object');
      }
    }
  });
});

describe('protocol errors', () => {
  test('an unknown resource is -32602 with the uri', () => {
    const error = new ResourceNotFoundError('ui://timesheet/Nope.html');
    expect(error.code).toBe(ProtocolErrorCode.InvalidParams);
    expect(error.code).toBe(-32602);
    expect(error.data).toEqual({ uri: 'ui://timesheet/Nope.html' });
  });

  test('a tool named after an Object.prototype member is unknown, not the client', async () => {
    const client = { authentication: { apiKey: 'ts_secret.key' } } as any;
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(await dispatchExtendedTool(client, name, {})).toBeNull();
    }
  });

  test('a missing argument is a tool error the model can fix, not a protocol error', async () => {
    const result = (await dispatchExtendedTool({} as any, 'project_member_add', { projectId: 'p1' })) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('email or userId');
  });
});
