/**
 * MCP Apps Helper Functions
 * Utilities for formatting tool responses with MCP Apps metadata (SEP-1865)
 *
 * Uses the standardized MCP Apps schema:
 * - URI scheme: ui://timesheet/<component>.html
 * - MIME type: text/html;profile=mcp-app
 * - Metadata: _meta.ui.* (with OpenAI compat keys retained)
 */

import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';

export { RESOURCE_MIME_TYPE };

const RESOURCE_URI_PREFIX = 'ui://timesheet';

/**
 * Get the resource URI for a component
 */
export function getComponentResourceUri(componentName: string): string {
  return `${RESOURCE_URI_PREFIX}/${componentName}.html`;
}

// Get the component server base URL from environment or use ngrok URL
export function getComponentBaseUrl(): string {
  return process.env.COMPONENT_BASE_URL || process.env.NGROK_URL || 'http://localhost:3000';
}

/**
 * Add MCP Apps component metadata to a tool response
 */
export function addComponentMetadata(
  response: any,
  componentName: string,
  widgetDescription: string,
): any {
  const resourceUri = getComponentResourceUri(componentName);

  const result = {
    ...response,
    _meta: {
      ...((response as any)._meta || {}),
      // MCP Apps standard metadata
      ui: {
        resourceUri,
        csp: { connectDomains: [], resourceDomains: [] },
        prefersBorder: false,
        visibility: ['model', 'app'],
      },
      // Keep OpenAI-specific keys for ChatGPT backward compatibility
      'openai/widgetDescription': widgetDescription,
      'openai/toolInvocation/invoking': componentName,
      'openai/toolInvocation/invoked': componentName,
    },
  };

  // Debug logging
  console.error(`[MCP App] Component metadata for ${componentName}:`);
  console.error(`  - Resource URI: ${resourceUri}`);
  console.error(`  - Widget Description: ${widgetDescription}`);

  return result;
}

/**
 * Format timer response with component
 */
export function formatTimerResponse(timerData: any, profile?: any, settings?: any) {
  // Build text content for non-widget MCP clients
  let textContent = `Timer status: ${timerData.status}`;

  if (timerData.projectTitle) {
    textContent += `\nProject: ${timerData.projectTitle}`;
  }
  if (timerData.description) {
    textContent += `\nDescription: ${timerData.description}`;
  }
  if (timerData.duration !== undefined) {
    const hours = timerData.hours || 0;
    const minutes = timerData.minutes || 0;
    textContent += `\nDuration: ${hours}h ${minutes}m`;
  }

  return addComponentMetadata(
    {
      content: [
        {
          type: 'text',
          text: textContent,
        },
      ],
      structuredContent: {
        ...timerData,
        profile,
        settings,
      },
    },
    'TimerWidget',
    'Interactive timer display showing current status, duration, and controls to pause, resume, or stop the timer'
  );
}

/**
 * Format project list response with component
 */
export function formatProjectListResponse(projects: any[], totalCount: number, queryParams?: Record<string, any>, profile?: any, settings?: any) {
  // Build text content for non-widget MCP clients
  const projectList = projects
    .map((p: any) => {
      let line = `- ${p.title}`;
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

  return addComponentMetadata(
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
        profile,
        settings,
      },
    },
    'ProjectList',
    `List of ${totalCount} projects with color-coded indicators and clickable start buttons for each active project`
  );
}

/**
 * Format project card response with component
 */
export function formatProjectCardResponse(project: any) {
  // Build text content for non-widget MCP clients
  let textContent = `Project: ${project.title || 'Untitled'}`;

  if (project.description) {
    textContent += `\nDescription: ${project.description}`;
  }
  if (project.archived) {
    textContent += `\nStatus: Archived`;
  }

  return addComponentMetadata(
    {
      content: [
        {
          type: 'text',
          text: textContent,
        },
      ],
      structuredContent: project,
    },
    'ProjectCard',
    `Project card displaying details for "${project.title || 'project'}" including description and status`
  );
}

/**
 * Format task list response with component
 */
export function formatTaskListResponse(tasks: any[], queryParams?: any, profile?: any, settings?: any) {
  // Build text content for non-widget MCP clients
  const taskList = tasks
    .map((t: any) => {
      const hours = t.hours || 0;
      const minutes = t.minutes || 0;
      let line = `- ${t.description || 'No description'} (${hours}h ${minutes}m)`;
      if (t.projectTitle) {
        line += ` - ${t.projectTitle}`;
      }
      if (t.billable) {
        line += ' [Billable]';
      }
      return line;
    })
    .join('\n');

  const textContent = `Found ${tasks.length} time entr${tasks.length !== 1 ? 'ies' : 'y'}:\n\n${taskList}`;

  return addComponentMetadata(
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
        profile,
        settings,
      },
    },
    'TaskList',
    `List of ${tasks.length} time entries grouped by date, showing project details, durations, tags, and billable status`
  );
}

/**
 * Format task card response with component
 */
export function formatTaskCardResponse(task: any) {
  const duration = task.duration || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);

  return addComponentMetadata(
    {
      content: [
        {
          type: 'text',
          text: `Task: ${task.description || 'No description'} (${hours}h ${minutes}m)${task.project?.title ? ` - ${task.project.title}` : ''}`,
        },
      ],
      structuredContent: task,
    },
    'TaskCard',
    `Time entry card showing "${task.description || 'task'}" with ${hours}h ${minutes}m duration${task.project?.title ? ` on ${task.project.title}` : ''}`
  );
}

/**
 * Format statistics response with component
 */
export function formatStatisticsResponse(stats: any, profile?: any, settings?: any) {
  // Build detailed text content for non-widget MCP clients
  const lines: string[] = [];

  if (stats.startDate && stats.endDate) {
    lines.push(`Period: ${stats.startDate} to ${stats.endDate}`);
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
      lines.push(`  - ${p.projectTitle}: ${p.hours.toFixed(1)}h (${p.percentage}%, ${p.taskCount} tasks)`);
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

  return addComponentMetadata(
    {
      content: [
        {
          type: 'text',
          text: textContent,
        },
      ],
      structuredContent: {
        ...stats,
        profile,
        settings,
      },
    },
    'Statistics',
    `Time tracking statistics dashboard showing ${stats.totalHours.toFixed(1)}h total (${stats.billableHours.toFixed(1)}h billable) across ${stats.totalTasks ?? 0} tasks with project breakdowns and ${stats.weeklyHours ? 'weekly' : 'daily'} charts`
  );
}

/**
 * Format export template list response with component
 */
export function formatExportTemplateListResponse(templates: any[], totalCount: number) {
  // Build text content for non-widget MCP clients
  const templateList = templates
    .slice(0, 10)
    .map((t: any) => {
      let line = `- ${t.name}`;
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

  return addComponentMetadata(
    {
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
    },
    'ExportWidget',
    `Export widget with ${totalCount} template${totalCount !== 1 ? 's' : ''} available for generating timesheet exports`
  );
}

/**
 * Get component metadata for tool definition (not response)
 */
export function getComponentMetadataForTool(componentName: string) {
  return {
    ui: {
      resourceUri: getComponentResourceUri(componentName),
      visibility: ['model', 'app'],
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
    TaskCard: 'Individual time entry card displaying task details, duration, project association, and billing information',
    Statistics: 'Time tracking statistics dashboard with total hours, billable hours, project breakdowns with progress bars, and daily time charts',
    ExportWidget: 'Interactive export widget with template selector, date range inputs, quick date presets, and generate button to create timesheet exports',
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
 * OAuth 2.1 authorization metadata for MCP Initialize response
 * This tells ChatGPT how to authenticate with this MCP server
 */
export function getOAuthMetadata() {
  const apiBaseUrl = getApiBaseUrl();
  const mcpServerUrl = getMcpServerUrl();

  return {
    // OAuth 2.1 method identifier
    method: 'oauth2',
    // Protected resource metadata for this MCP server
    resource: mcpServerUrl,
    // Authorization server metadata location
    authorization_servers: [apiBaseUrl],
    // Direct endpoints for convenience
    authorization_endpoint: `${apiBaseUrl}/oauth2/auth`,
    token_endpoint: `${apiBaseUrl}/oauth2/token`,
    registration_endpoint: `${apiBaseUrl}/oauth2/register`,
    // Well-known discovery endpoints
    metadata_uri: `${apiBaseUrl}/.well-known/oauth-authorization-server`,
    protected_resource_metadata_uri: `${mcpServerUrl}/.well-known/oauth-protected-resource`,
  };
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
function getJwtExpiry(token: string): number | null {
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
