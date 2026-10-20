/**
 * MCP Events: clients such as ChatGPT subscribe to Timesheet events and receive them as signed
 * webhooks. Draft spec: github.com/modelcontextprotocol/experimental-ext-triggers-events
 * (design sketch, which ChatGPT implements) and SEP-3415.
 *
 * Only webhook delivery is offered. The backend stores each subscription as a webhook of
 * format "mcp", verifies the callback, signs deliveries (Standard Webhooks) and sends them; this
 * module lists the events and forwards events/subscribe and events/unsubscribe to it.
 */

import { ProtocolError, ProtocolErrorCode, type Server, type StandardSchemaV1 } from '@modelcontextprotocol/server';
import { TimesheetApiError, type TimesheetClient } from '@timesheet/sdk';

/** SEP-3415's extension identifier, declared under capabilities.extensions. */
export const EVENTS_EXTENSION_ID = 'io.modelcontextprotocol/events';

/**
 * Error codes of the design sketch before its 2026-10-08 renumbering, which ChatGPT implements
 * (its guide answers a failed verification with -32015). SEP-3415 moves them to -32023..-32027.
 */
export const EVENT_ERROR_CODES = {
  notFound: -32011,
  forbidden: -32012,
  resourceExhausted: -32013,
  unsupported: -32014,
  callbackEndpoint: -32015,
} as const;

const PLANS_URL = 'https://timesheet.io/en/pricing';

const NO_ARGUMENTS = { type: 'object', properties: {}, additionalProperties: false } as const;

const PROJECT_SCHEMA = {
  type: 'object',
  description: 'The project',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    employer: { type: 'string', description: 'Client' },
    description: { type: 'string' },
    archived: { type: 'boolean' },
  },
} as const;

const TASK_SCHEMA = {
  type: 'object',
  description: 'The time entry',
  properties: {
    id: { type: 'string' },
    description: { type: 'string' },
    startDateTime: { type: 'string', description: 'ISO 8601 with the user\'s offset' },
    endDateTime: { type: 'string', description: 'ISO 8601 with the user\'s offset; absent while running' },
    billable: { type: 'boolean' },
    project: PROJECT_SCHEMA,
    tags: { type: 'array', items: { type: 'object' } },
  },
} as const;

const TIMER_SCHEMA = {
  type: 'object',
  description: 'The timer',
  properties: {
    status: { type: 'string', enum: ['running', 'paused', 'stopped'] },
    task: TASK_SCHEMA,
    pause: { type: 'object', description: 'The current break, while paused' },
  },
} as const;

const TODO_SCHEMA = {
  type: 'object',
  description: 'The todo',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'integer' },
    dueDate: { type: 'string' },
    project: PROJECT_SCHEMA,
  },
} as const;

function event(name: string, description: string, payloadSchema: object) {
  return { name, description, delivery: ['webhook'], inputSchema: NO_ARGUMENTS, payloadSchema };
}

/**
 * The events a client can subscribe to. Names are the backend's event types (the same as for
 * webhooks created through the API), so they stay stable. The payload is the entity as the
 * Timesheet API returns it; the schemas name its main fields.
 */
export const EVENT_DEFINITIONS = [
  event('timer.start', 'The user started the timer. Data: the timer with its running time entry.', TIMER_SCHEMA),
  event('timer.stop', 'The user stopped the timer, which saved the time entry. Data: the stopped timer.', TIMER_SCHEMA),
  event('timer.pause', 'The user paused the timer for a break. Data: the timer and its break.', TIMER_SCHEMA),
  event('timer.resume', 'The user resumed the timer after a break. Data: the timer.', TIMER_SCHEMA),
  event('task.create', 'A time entry was created in the user\'s account or a shared project. Data: the time entry.', TASK_SCHEMA),
  event('task.update', 'A time entry was changed. Data: the time entry as it is now.', TASK_SCHEMA),
  event('project.create', 'A project was created. Data: the project.', PROJECT_SCHEMA),
  event('project.update', 'A project was changed, archived or restored. Data: the project as it is now.', PROJECT_SCHEMA),
  event('todo.create', 'A todo was created. Data: the todo.', TODO_SCHEMA),
  event('todo.update', 'A todo was changed or closed. Data: the todo as it is now.', TODO_SCHEMA),
];

const EVENT_NAMES = new Set(EVENT_DEFINITIONS.map((definition) => definition.name));

/**
 * A Standard Schema (the SDK's params contract for custom methods) from a plain validator, so
 * the server needs no schema library at runtime.
 */
function paramsSchema<T>(parse: (value: Record<string, unknown>) => T): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'timesheet',
      validate: (value: unknown) => {
        try {
          const params = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
          return { value: parse(params) };
        } catch (error) {
          return { issues: [{ message: error instanceof Error ? error.message : String(error) }] };
        }
      },
    },
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function optionalObject(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

interface SubscribeParams {
  name: string;
  arguments: Record<string, unknown>;
  delivery: { mode: string; url: string; secret: string };
  ttlMs: number | null | undefined;
}

interface UnsubscribeParams {
  name: string;
  arguments: Record<string, unknown>;
  url: string;
}

const ListParams = paramsSchema((params) => ({ cursor: params.cursor }));

const SubscribeParamsSchema = paramsSchema<SubscribeParams>((params) => {
  const delivery = optionalObject(params.delivery, 'delivery');
  const ttlMs = params.ttlMs;
  if (ttlMs !== undefined && ttlMs !== null && (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs))) {
    throw new Error('ttlMs must be a number or null');
  }
  return {
    name: requireString(params.name, 'name'),
    arguments: optionalObject(params.arguments, 'arguments'),
    delivery: {
      mode: requireString(delivery.mode, 'delivery.mode'),
      url: requireString(delivery.url, 'delivery.url'),
      secret: requireString(delivery.secret, 'delivery.secret'),
    },
    ttlMs: ttlMs as number | null | undefined,
  };
});

const UnsubscribeParamsSchema = paramsSchema<UnsubscribeParams>((params) => {
  const delivery = optionalObject(params.delivery, 'delivery');
  return {
    name: requireString(params.name, 'name'),
    arguments: optionalObject(params.arguments, 'arguments'),
    url: requireString(delivery.url, 'delivery.url'),
  };
});

/** The SDK has no subscription methods yet: post with the webhooks resource's authenticated client. */
interface ApiClient {
  post<T>(path: string, data?: unknown): Promise<T>;
}

function apiClient(client: TimesheetClient): ApiClient {
  return (client.webhooks as unknown as { http: ApiClient }).http;
}

function checkEventAndArguments(name: string, args: Record<string, unknown>) {
  if (!EVENT_NAMES.has(name)) {
    throw new ProtocolError(EVENT_ERROR_CODES.notFound, `Unknown event: ${name}`, { kind: 'event' });
  }
  const unknown = Object.keys(args);
  if (unknown.length > 0) {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Timesheet events take no arguments: ${unknown.join(', ')}`);
  }
}

/** A backend refusal as the JSON-RPC error the events draft defines for it. */
function toProtocolError(error: unknown): ProtocolError {
  if (!(error instanceof TimesheetApiError)) {
    return new ProtocolError(ProtocolErrorCode.InternalError, 'The subscription could not be saved');
  }
  let body: { error?: string; message?: string } = {};
  try {
    body = error.responseBody ? JSON.parse(error.responseBody) : {};
  } catch {
    // Not JSON: the status decides
  }
  const message = body.message || error.message;
  switch (error.statusCode) {
    case 400:
      return new ProtocolError(ProtocolErrorCode.InvalidParams, message);
    case 401:
    case 403:
      return new ProtocolError(EVENT_ERROR_CODES.forbidden, 'Not allowed to subscribe to this event');
    case 402:
      return new ProtocolError(
        EVENT_ERROR_CODES.forbidden,
        `Event subscriptions are not available on the user's current Timesheet plan. The plans are described at ${PLANS_URL}.`
      );
    case 429:
      return new ProtocolError(EVENT_ERROR_CODES.resourceExhausted, 'Too many subscription requests; try again in a minute', {
        limit: 'requests',
      });
    case 422:
      if (body.error === 'CallbackEndpointError') {
        return new ProtocolError(EVENT_ERROR_CODES.callbackEndpoint, 'The callback endpoint failed verification', {
          reason: body.message,
        });
      }
      if (body.error === 'ResourceExhausted') {
        return new ProtocolError(EVENT_ERROR_CODES.resourceExhausted, 'Too many event subscriptions', {
          limit: 'subscriptions',
        });
      }
      return new ProtocolError(ProtocolErrorCode.InvalidParams, message);
    default:
      return new ProtocolError(ProtocolErrorCode.InternalError, 'The subscription could not be saved');
  }
}

/**
 * Registers events/list, events/subscribe and events/unsubscribe. getClient throws when the
 * request is not authenticated, which events/subscribe requires.
 */
export function registerEventHandlers(server: Server, getClient: () => TimesheetClient) {
  server.setRequestHandler('events/list', { params: ListParams }, async () => ({ events: EVENT_DEFINITIONS }));

  server.setRequestHandler('events/subscribe', { params: SubscribeParamsSchema }, async (params) => {
    checkEventAndArguments(params.name, params.arguments);
    if (params.delivery.mode !== 'webhook') {
      throw new ProtocolError(EVENT_ERROR_CODES.unsupported, 'Timesheet delivers events by webhook only', {
        feature: 'deliveryMode',
        value: params.delivery.mode,
      });
    }
    let result: { id: string; refreshBefore: string };
    try {
      result = await apiClient(getClient()).post('/v1/webhooks/subscribe', {
        name: params.name,
        arguments: params.arguments,
        url: params.delivery.url,
        secret: params.delivery.secret,
        // null asks for no expiry, which is not granted: the backend gives its maximum
        ttlMs: params.ttlMs ?? null,
      });
    } catch (error) {
      throw toProtocolError(error);
    }
    console.error(`[Events] Subscribed ${params.name}: ${result.id}`);
    // Timesheet events cannot be replayed: no cursor, and so never a gap
    return { id: result.id, refreshBefore: result.refreshBefore, cursor: null, truncated: false };
  });

  server.setRequestHandler('events/unsubscribe', { params: UnsubscribeParamsSchema }, async (params) => {
    checkEventAndArguments(params.name, params.arguments);
    try {
      await apiClient(getClient()).post('/v1/webhooks/unsubscribe', {
        name: params.name,
        arguments: params.arguments,
        url: params.url,
      });
    } catch (error) {
      throw toProtocolError(error);
    }
    console.error(`[Events] Unsubscribed ${params.name}`);
    return {};
  });
}
