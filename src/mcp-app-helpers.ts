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
    resource_documentation: 'https://docs.timesheet.io/mcp',
  };
}

/**
 * Authorization Server Metadata (RFC 8414)
 * This describes the OAuth 2.1 authorization server capabilities
 * ChatGPT fetches this to discover endpoints and supported features
 */
export function getAuthorizationServerMetadata() {
  const apiBaseUrl = getApiBaseUrl();

  return {
    // Issuer identifier (authorization server URL)
    issuer: apiBaseUrl,
    // OAuth 2.1 endpoints
    authorization_endpoint: `${apiBaseUrl}/oauth2/auth`,
    token_endpoint: `${apiBaseUrl}/oauth2/token`,
    // Dynamic Client Registration (DCR) endpoint
    registration_endpoint: `${apiBaseUrl}/oauth2/register`,
    // PKCE support - REQUIRED for ChatGPT
    code_challenge_methods_supported: ['S256'],
    // Supported grant types
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // Supported response types
    response_types_supported: ['code'],
    // Token endpoint authentication methods
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    // Supported scopes
    scopes_supported: ['openid', 'profile', 'offline_access'],
    // Service documentation
    service_documentation: 'https://docs.timesheet.io/api/oauth',
  };
}

/**
 * Generate WWW-Authenticate header value for 401 responses
 * Compliant with RFC 6750 (Bearer Token Usage)
 */
export function getWWWAuthenticateHeader(error?: string, errorDescription?: string): string {
  const apiBaseUrl = getApiBaseUrl();
  const mcpServerUrl = getMcpServerUrl();

  let header = `Bearer realm="${mcpServerUrl}"`;

  // Add authorization server hint for discovery
  header += `, authorization_uri="${apiBaseUrl}/oauth2/auth"`;

  if (error) {
    header += `, error="${error}"`;
  }
  if (errorDescription) {
    header += `, error_description="${errorDescription}"`;
  }

  return header;
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
