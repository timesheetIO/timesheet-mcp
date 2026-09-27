#!/usr/bin/env node
import {
  Server,
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  type CallToolResult,
  type ListToolsResult,
} from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { TimesheetApiError, TimesheetClient, TimesheetClientOptions } from '@timesheet/sdk';
import dotenv from 'dotenv';
import { pathToFileURL } from 'url';
import { realpathSync } from 'fs';
import {
  formatTimerResponse,
  formatProjectListResponse,
  formatProjectCardResponse,
  formatTaskListResponse,
  formatTaskCardResponse,
  formatStatisticsResponse,
  formatExportTemplateListResponse,
  formatExportResultResponse,
  formatPdfReportResponse,
  exportFormat,
  idList,
  listWidgetResources,
  parseWidgetUri,
  getWidgetResourceMeta,
  RESOURCE_MIME_TYPE,
  EXTENSION_ID,
  CACHE_HINTS,
  TOOLS_LIST_PAGE_SIZE,
  paginate,
  resolveTokenAuthOptions,
} from './mcp-app-helpers.js';
import { dispatchExtendedTool } from './extended-tools.js';
import { TOOL_DEFINITIONS, TOOL_OUTPUT_SCHEMAS } from './tool-definitions.js';
import { computeStatistics, fetchAllPages, STATISTICS_PAGE_SIZE, validateStatisticsRange } from './statistics.js';

dotenv.config();

/**
 * Options for creating a TimesheetMCPServer instance
 */
export interface TimesheetMCPServerOptions {
  /**
   * OAuth 2.1 access token for authentication
   * Takes precedence over environment API key when provided
   */
  oauthToken?: string;
  /**
   * Serving the HTTP endpoint, where every request brings its own credentials. auth_configure is
   * not offered there: it would only swap the client of that one request and still report success.
   */
  hosted?: boolean;
}

/** The tools of the HTTP endpoint: everything except auth_configure, see TimesheetMCPServerOptions. */
const HOSTED_TOOL_DEFINITIONS = TOOL_DEFINITIONS.filter((tool) => tool.name !== 'auth_configure');

export class TimesheetMCPServer {
  private server: Server;
  private client: TimesheetClient | null = null;
  private oauthToken?: string;
  private hosted: boolean;

  /**
   * Create a new TimesheetMCPServer instance
   * @param options - Optional configuration including OAuth token
   */
  constructor(options?: TimesheetMCPServerOptions) {
    this.oauthToken = options?.oauthToken;
    this.hosted = options?.hosted ?? false;

    this.server = new Server(
      {
        name: 'timesheet-mcp',
        version: '2.0.1',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          // MCP Apps: tool results can render as the ui:// widgets listed under resources
          extensions: {
            [EXTENSION_ID]: {},
          },
        },
        // Protocol 2026-07-28 only: how long clients may cache the static lists and widgets
        cacheHints: CACHE_HINTS,
      }
    );

    this.setupHandlers();
  }

  /**
   * Get the MCP server instance (for HTTP server)
   */
  public getServer(): Server {
    return this.server;
  }

  /**
   * Get the Timesheet API client
   *
   * Authentication priority:
   * 1. OAuth token passed to constructor (from ChatGPT/HTTP Bearer header)
   * 2. TIMESHEET_API_TOKEN environment variable (for CLI usage)
   */
  private getClient(): TimesheetClient {
    if (!this.client) {
      const options: TimesheetClientOptions = {};

      // Set base URLs from environment
      if (process.env.TIMESHEET_API_URL) {
        options.baseUrl = process.env.TIMESHEET_API_URL;
      }
      if (process.env.TIMESHEET_REPORTS_URL) {
        options.reportsBaseUrl = process.env.TIMESHEET_REPORTS_URL;
      }

      // Priority 1: Token from constructor (HTTP Authorization header).
      // MCP clients can only send Bearer, so personal API keys (ts_...) arrive
      // here too — route them to the ApiKey scheme the backend expects.
      if (this.oauthToken) {
        const tokenAuth = resolveTokenAuthOptions(this.oauthToken);
        console.error(
          'apiKey' in tokenAuth
            ? '[Auth] Using API key from request'
            : '[Auth] Using OAuth token from request'
        );
        Object.assign(options, tokenAuth);
      }
      // Priority 2: API key from environment (CLI usage)
      else if (process.env.TIMESHEET_API_TOKEN) {
        console.error('[Auth] Using API key from environment');
        options.apiKey = process.env.TIMESHEET_API_TOKEN;
      }
      // No authentication available
      else {
        throw new ProtocolError(
          ProtocolErrorCode.InternalError,
          'Authentication required. Provide Bearer token in Authorization header or set TIMESHEET_API_TOKEN environment variable.'
        );
      }

      // Debug logging (don't log actual tokens)
      console.error('[Auth] Client configuration:', {
        hasOAuthToken: !!options.oauth2Token,
        hasApiKey: !!options.apiKey,
        baseUrl: options.baseUrl || 'default (https://api.timesheet.io)',
      });

      this.client = new TimesheetClient(options);
    }
    return this.client;
  }

  private setupHandlers() {
    this.server.setRequestHandler('tools/list', async (request): Promise<ListToolsResult> => {
      // Cursor-based pagination: the cursor is the offset of the next page (see paginate)
      const tools = this.hosted ? HOSTED_TOOL_DEFINITIONS : TOOL_DEFINITIONS;
      const { page, nextCursor } = paginate(tools, request.params?.cursor, TOOLS_LIST_PAGE_SIZE);
      console.error(`[MCP] Returning ${page.length}/${tools.length} tools${nextCursor ? ` (nextCursor=${nextCursor})` : ''}`);
      return { tools: page, ...(nextCursor ? { nextCursor } : {}) };
    });

    // Widget HTML resources, served with the MCP Apps MIME type
    this.server.setRequestHandler('resources/list', async () => {
      console.error('[MCP] ListResources request received');
      const resources = listWidgetResources();
      console.error(`[MCP] Returning ${resources.length} resources`);
      return { resources };
    });

    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;
      console.error(`[MCP] ReadResource request for: ${uri}`);

      // ui://timesheet/ComponentName.html. An unknown resource is an invalid param (-32602).
      const componentName = parseWidgetUri(uri);
      if (!componentName) {
        throw new ResourceNotFoundError(uri);
      }

      // Read the actual HTML file
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const htmlPath = path.join(__dirname, '..', 'web', 'dist', `${componentName}.html`);

      try {
        const htmlContent = await fs.readFile(htmlPath, 'utf-8');

        console.error(`[MCP] Serving ${componentName} (${htmlContent.length} bytes)`);

        return {
          contents: [
            {
              uri,
              mimeType: RESOURCE_MIME_TYPE,
              text: htmlContent,
              _meta: getWidgetResourceMeta(componentName),
            },
          ],
        };
      } catch (error) {
        console.error(`[MCP] Error reading ${htmlPath}:`, error);
        throw new ProtocolError(ProtocolErrorCode.InternalError, `Failed to read component: ${error}`);
      }
    });

    this.server.setRequestHandler('tools/call', async (request): Promise<CallToolResult> => {
      const { name } = request.params;
      // arguments is optional in tools/call, and the handlers destructure it
      const args = request.params.arguments ?? {};

      let result: unknown;
      try {
        result = await this.dispatchTool(name, args);
      } catch (error) {
        if (error instanceof ProtocolError) {
          throw error;
        }
        throw new ProtocolError(
          ProtocolErrorCode.InternalError,
          `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (result === null) {
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown tool: ${name}`);
      }
      // Era-specific wire shaping of the result (identity for our object-shaped structuredContent)
      return this.server.projectCallToolResult(result as CallToolResult, TOOL_OUTPUT_SCHEMAS.get(name));
    });
  }

  /** Runs a tool by name. Resolves to null for a tool that does not exist. */
  private async dispatchTool(name: string, args: any): Promise<unknown | null> {
    switch (name) {
      // Timer operations
      case 'timer_start':
        return this.handleTimerStart(args);
      case 'timer_stop':
        return this.handleTimerStop(args);
      case 'timer_pause':
        return this.handleTimerPause(args);
      case 'timer_resume':
        return this.handleTimerResume(args);
      case 'timer_status':
        return this.handleTimerStatus();
      case 'timer_update':
        return this.handleTimerUpdate(args);

      // Task item operations
      case 'task_add_note':
        return this.handleAddNote(args);
      case 'task_add_expense':
        return this.handleAddExpense(args);
      case 'task_add_pause':
        return this.handleAddPause(args);

      // Team operations
      case 'team_list':
        return this.handleTeamList(args);

      // Project operations
      case 'project_list':
        return this.handleProjectList(args);
      case 'project_create':
        return this.handleProjectCreate(args);
      case 'project_update':
        return this.handleProjectUpdate(args);
      case 'project_delete':
        return this.handleProjectDelete(args);
      case 'project_get':
        return this.handleProjectGet(args);

      // Task operations
      case 'task_list':
        return this.handleTaskList(args);
      case 'task_create':
        return this.handleTaskCreate(args);
      case 'task_update':
        return this.handleTaskUpdate(args);
      case 'task_delete':
        return this.handleTaskDelete(args);
      case 'task_get':
        return this.handleTaskGet(args);

      // Statistics
      case 'statistics_get':
        return this.handleStatisticsGet(args);

      // Authentication
      case 'auth_configure':
        return this.hosted ? null : this.handleAuthConfigure(args);

      // Reports API - Document Reports
      case 'report_document_get':
        return this.handleReportDocumentGet(args);
      case 'report_document_pdf':
        return this.handleReportDocumentPdf(args);
      case 'report_document_xml':
        return this.handleReportDocumentXml(args);

      // Reports API - Task Reports
      case 'report_task_get':
        return this.handleReportTaskGet(args);
      case 'report_task_pdf':
        return this.handleReportTaskPdf(args);

      // Reports API - Expense Reports
      case 'report_expense_get':
        return this.handleReportExpenseGet(args);
      case 'report_expense_pdf':
        return this.handleReportExpensePdf(args);

      // Reports API - Note Reports
      case 'report_note_get':
        return this.handleReportNoteGet(args);
      case 'report_note_pdf':
        return this.handleReportNotePdf(args);

      // Reports API - Export Generation
      case 'export_generate':
        return this.handleExportGenerate(args);
      case 'export_send':
        return this.handleExportSend(args);
      case 'export_from_template':
        return this.handleExportFromTemplate(args);

      // Reports API - Export Configuration
      case 'export_fields':
        return this.handleExportFields(args);
      case 'export_report_types':
        return this.handleExportReportTypes();

      // Reports API - Export Templates
      case 'export_template_list':
        return this.handleExportTemplateList(args);
      case 'export_template_get':
        return this.handleExportTemplateGet(args);
      case 'export_template_create':
        return this.handleExportTemplateCreate(args);
      case 'export_template_update':
        return this.handleExportTemplateUpdate(args);
      case 'export_template_delete':
        return this.handleExportTemplateDelete(args);

      default:
        return dispatchExtendedTool(this.getClient(), name, args);
    }
  }

  // Timer handlers
  private async handleTimerStart(args: any) {
    const client = this.getClient();
    const { projectId, startDateTime } = args;

    try {
      const [timer, userData] = await Promise.all([
        client.timer.start({ projectId, startDateTime }),
        this.getProfileAndSettings(),
      ]);
      const timerData = this.formatCompleteTimerData(timer);
      return formatTimerResponse(timerData, userData.profile, userData.settings, 'timer_start');
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerStop(args: any) {
    const client = this.getClient();
    const { endDateTime } = args;

    try {
      // The API clears the task when the timer stops, so note which one was running: the result
      // reports it as the entry that was just saved. Either lookup failing only drops that report.
      const running = await client.timer.get().catch(() => undefined);
      const [timer, userData] = await Promise.all([
        client.timer.stop(endDateTime ? { endDateTime } : undefined),
        this.getProfileAndSettings(),
      ]);
      const saved = running?.task?.id
        ? await client.tasks.get(running.task.id).catch(() => undefined)
        : undefined;
      const timerData = this.formatCompleteTimerData(timer);
      return formatTimerResponse(timerData, userData.profile, userData.settings, 'timer_stop',
        saved ? this.formatTimerTask(saved) : undefined);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerPause(args: any) {
    const client = this.getClient();
    const { startDateTime } = args;

    try {
      const [timer, userData] = await Promise.all([
        client.timer.pause(startDateTime ? { startDateTime } : undefined),
        this.getProfileAndSettings(),
      ]);
      const timerData = this.formatCompleteTimerData(timer);
      return formatTimerResponse(timerData, userData.profile, userData.settings, 'timer_pause');
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerResume(args: any) {
    const client = this.getClient();
    const { endDateTime } = args;

    try {
      const [timer, userData] = await Promise.all([
        client.timer.resume(endDateTime ? { endDateTime } : undefined),
        this.getProfileAndSettings(),
      ]);
      const timerData = this.formatCompleteTimerData(timer);
      return formatTimerResponse(timerData, userData.profile, userData.settings, 'timer_resume');
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * Helper to fetch profile and settings data for all widgets
   */
  private async getProfileAndSettings() {
    const client = this.getClient();

    try {
      const [profile, settings] = await Promise.all([
        client.profile.getProfile().catch(() => null),
        client.settings.get().catch(() => null),
      ]);

      return {
        profile,
        settings,
      };
    } catch (error) {
      console.error('Failed to fetch profile/settings:', error);
      return {
        profile: null,
        settings: null,
      };
    }
  }

  /**
   * Helper to format timer data consistently for all timer operations
   * Uses nested structure (timer.task.project) only
   */
  /** The task of the timer as the widget reads it, also used for the entry timer_stop saved. */
  private formatTimerTask(task: any) {
    return {
      id: task.id,
      startDateTime: task.startDateTime,
      endDateTime: task.endDateTime,
      description: task.description,
      duration: task.duration,
      durationBreak: task.durationBreak,
      typeId: task.typeId,
      location: task.location,
      locationEnd: task.locationEnd,
      distance: task.distance,
      phoneNumber: task.phoneNumber,
      billable: task.billable,
      project: task.project,
    };
  }

  private formatCompleteTimerData(timer: any) {
    const duration = timer.task?.duration || 0;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);

    return {
      status: timer.status,
      duration: duration,
      hours: hours,
      minutes: minutes,
      task: timer.task ? this.formatTimerTask(timer.task) : undefined,
      pause: timer.pause ? {
        id: timer.pause.id,
        startDateTime: timer.pause.startDateTime,
        endDateTime: timer.pause.endDateTime,
        description: timer.pause.description,
      } : undefined,
    };
  }

  private async handleTimerStatus() {
    const client = this.getClient();

    try {
      const [timer, userData] = await Promise.all([
        client.timer.get(),
        this.getProfileAndSettings(),
      ]);
      const timerData = this.formatCompleteTimerData(timer);
      return formatTimerResponse(timerData, userData.profile, userData.settings, 'timer_status');
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerUpdate(args: any) {
    const client = this.getClient();

    try {
      const [timer, userData] = await Promise.all([
        client.timer.update(args),
        this.getProfileAndSettings(),
      ]);
      const timerData = this.formatCompleteTimerData(timer);
      return formatTimerResponse(timerData, userData.profile, userData.settings, 'timer_update');
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // Task item handlers
  private async handleAddNote(args: any) {
    const client = this.getClient();
    const { text, dateTime } = args;

    try {
      // Get current timer to find the task ID
      const timer = await client.timer.get();
      if (!timer.task || timer.status === 'stopped') {
        return {
          content: [
            {
              type: 'text',
              text: 'No running timer found. Please start a timer first.',
            },
          ],
          isError: true,
        };
      }

      await client.notes.create({
        taskId: timer.task.id,
        text,
        // NoteCreateRequest.dateTime is required; default to now per tool description
        dateTime: dateTime ?? new Date().toISOString(),
      });

      return {
        content: [
          {
            type: 'text',
            text: `Note added to current task: "${text}"`,
          },
        ],
        structuredContent: {
          success: true,
          noteText: text,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleAddExpense(args: any) {
    const client = this.getClient();
    const { description, amount, dateTime, refunded } = args;

    try {
      // Get current timer to find the task ID
      const timer = await client.timer.get();
      if (!timer.task || timer.status === 'stopped') {
        return {
          content: [
            {
              type: 'text',
              text: 'No running timer found. Please start a timer first.',
            },
          ],
          isError: true,
        };
      }

      await client.expenses.create({
        taskId: timer.task.id,
        description,
        // ExpenseCreateRequest.amount is a decimal string (BigDecimal). Coerce
        // numbers for backward compatibility with older clients/tools.
        amount: amount === undefined || amount === null ? undefined : String(amount),
        // ExpenseCreateRequest.dateTime is required; default to now.
        dateTime: dateTime ?? new Date().toISOString(),
        ...(typeof refunded === 'boolean' ? { refunded } : {}),
      });

      return {
        content: [
          {
            type: 'text',
            text: `Expense added: ${description} - $${amount}`,
          },
        ],
        structuredContent: {
          success: true,
          expenseDescription: description,
          amount: amount,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleAddPause(args: any) {
    const client = this.getClient();
    const { description, startDateTime, endDateTime } = args;

    try {
      // Get current timer to find the task ID
      const timer = await client.timer.get();
      if (!timer.task || timer.status === 'stopped') {
        return {
          content: [
            {
              type: 'text',
              text: 'No running timer found. Please start a timer first.',
            },
          ],
          isError: true,
        };
      }

      await client.pauses.create({
        taskId: timer.task.id,
        description,
        startDateTime,
        endDateTime,
      });

      // Calculate duration in seconds
      const start = new Date(startDateTime).getTime();
      const end = new Date(endDateTime).getTime();
      const durationSeconds = Math.floor((end - start) / 1000);

      return {
        content: [
          {
            type: 'text',
            text: `Pause added to current task`,
          },
        ],
        structuredContent: {
          success: true,
          duration: durationSeconds,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // Team handlers
  private async handleTeamList(args: any) {
    const client = this.getClient();

    try {
      // All filter params (search, organizationId, sort, order, statistics, page, limit)
      // are passed through directly
      const page = await client.teams.search(args);
      // Use only items from the current page - don't iterate through all pages
      const items = page.items;
      const totalCount = page.params?.count || items.length;

      const teamList = items.map((t: any) =>
        `- ${t.name} (ID: ${t.id})`
      ).join('\n');

      const content: any[] = [
        {
          type: 'text',
          text: `Teams:\n${teamList}`,
        },
      ];

      // Add each team as an embedded resource
      items.forEach((t: any) => {
        content.push({
          type: 'resource',
          resource: {
            uri: `timesheet://team/${t.id}`,
            name: t.name,
            description: t.description || 'Team details',
            mimeType: 'application/json',
            text: JSON.stringify(t, null, 2),
            annotations: {
              audience: ['user', 'assistant'],
              priority: 0.7,
            },
          },
        });
      });

      // Return simple text response (no widget for teams)
      return {
        content,
        structuredContent: {
          teams: items.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            organizationId: t.organizationId,
            color: t.color,
          })),
          totalCount,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // Project handlers
  private async handleProjectList(args: any) {
    const client = this.getClient();

    try {
      // Statistics are always included in v1.1.0 (no flag needed).
      // All filter params (teamId, teamIds, projectIds, search, status, taskStartDate, etc.)
      // are passed through via the spread operator
      const [page, userData] = await Promise.all([
        client.projects.search(args),
        this.getProfileAndSettings(),
      ]);
      // Use only items from the current page - don't iterate through all pages
      const items = page.items;
      const totalCount = page.params?.count || items.length;

      // Format response with OpenAI component metadata
      const projectData = items.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        archived: p.archived,
        color: p.color,
        employer: p.employer,
        duration: p.duration,
      }));

      // Pass filter params as queryParams for web app URL generation
      const queryParams = {
        teamId: args.teamId,
        teamIds: args.teamIds,
        status: args.status,
        search: args.search,
        sort: args.sort,
        order: args.order,
      };

      return formatProjectListResponse(projectData, totalCount, queryParams, userData.profile, userData.settings);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleProjectCreate(args: any) {
    const client = this.getClient();

    try {
      const project = await client.projects.create(args);
      return {
        content: [
          {
            type: 'text',
            text: `Project created: ${project.title} (ID: ${project.id})`,
          },
          {
            type: 'resource',
            resource: {
              uri: `timesheet://project/${project.id}`,
              name: project.title,
              description: project.description || 'Newly created project',
              mimeType: 'application/json',
              text: JSON.stringify(project, null, 2),
              annotations: {
                audience: ['user', 'assistant'],
                priority: 0.9,
              },
            },
          },
        ],
        structuredContent: {
          id: project.id,
          title: project.title,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleProjectUpdate(args: any) {
    const client = this.getClient();
    const { id, ...updateData } = args;

    try {
      const project = await client.projects.update(id, updateData);
      return {
        content: [
          {
            type: 'text',
            text: `Project updated: ${project.title}`,
          },
        ],
        structuredContent: {
          id: project.id,
          title: project.title,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleProjectDelete(args: any) {
    const client = this.getClient();
    const { id } = args;

    try {
      await client.projects.delete(id);
      return {
        content: [
          {
            type: 'text',
            text: `Project ${id} deleted successfully`,
          },
        ],
        structuredContent: {
          success: true,
          deletedId: id,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleProjectGet(args: any) {
    const client = this.getClient();
    const { id } = args;

    try {
      const project = await client.projects.get(id);

      return formatProjectCardResponse(project);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // Task handlers
  private async handleTaskList(args: any) {
    const client = this.getClient();

    try {
      // All filter params (organizationId, teamId, teamIds, projectId, projectIds, userIds,
      // tagIds, taskIds, rateId, documentId, todoId, type, filter, feelings, startDate,
      // endDate, populate flags, etc.) are passed through directly
      // Enable tag population by default unless explicitly set to false
      const searchParams = {
        ...args,
        populateTags: args.populateTags !== false, // Default to true
      };
      const [page, userData] = await Promise.all([
        client.tasks.search(searchParams),
        this.getProfileAndSettings(),
      ]);
      // Use only items from the current page - don't iterate through all pages
      const items = page.items;

      // Format response with nested structure (task.project)
      const taskData = items.map((t: any) => {
        const duration = t.duration || 0;
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        return {
          id: t.id,
          description: t.description,
          duration: duration,
          durationBreak: t.durationBreak,
          hours: hours,
          minutes: minutes,
          startDateTime: t.startDateTime,
          endDateTime: t.endDateTime,
          billable: t.billable,
          paid: t.paid,
          billed: t.billed,
          tags: t.tags, // Include tags for widget display
          project: t.project, // Nested project structure
        };
      });

      // Pass query params to widget for building web app link
      return formatTaskListResponse(taskData, args, userData.profile, userData.settings, page.params?.count);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTaskCreate(args: any) {
    const client = this.getClient();

    try {
      const task = await this.readTaskBack(await client.tasks.create(args));
      const result = formatTaskCardResponse(task, 'created');
      return {
        ...result,
        content: [
          ...result.content,
          {
            type: 'resource',
            resource: {
              uri: `timesheet://task/${task.id}`,
              name: task.description || 'New Task Entry',
              description: 'Newly created task',
              mimeType: 'application/json',
              text: JSON.stringify(task, null, 2),
              annotations: {
                audience: ['user', 'assistant'],
                priority: 0.9,
              },
            },
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTaskUpdate(args: any) {
    const client = this.getClient();
    const { id, ...updateData } = args;

    try {
      const task = await this.readTaskBack(await client.tasks.update(id, updateData));
      const result = formatTaskCardResponse(task, 'updated');
      return {
        ...result,
        structuredContent: { ...result.structuredContent, success: true },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * The task card needs the project, times and billing status. When a write returns the task
   * without its project, read it back; if that fails, the card shows what the write returned.
   */
  private async readTaskBack(task: any) {
    if (!task?.id || (task.project && task.startDateTime)) {
      return task;
    }
    try {
      return await this.getClient().tasks.get(task.id);
    } catch (error) {
      console.error(`[MCP] Could not read task ${task.id} back after the write:`, error);
      return task;
    }
  }

  private async handleTaskDelete(args: any) {
    const client = this.getClient();
    const { id } = args;

    try {
      await client.tasks.delete(id);
      return {
        content: [
          {
            type: 'text',
            text: `Task ${id} deleted successfully`,
          },
        ],
        structuredContent: {
          success: true,
          deletedId: id,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTaskGet(args: any) {
    const client = this.getClient();
    const { id } = args;

    try {
      const task = await client.tasks.get(id);

      return formatTaskCardResponse(task);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // Authentication handler
  private async handleAuthConfigure(args: any) {
    const { apiKey, baseUrl } = args;
    
    const options: TimesheetClientOptions = {
      apiKey,
    };

    if (baseUrl) {
      options.baseUrl = baseUrl;
    } else if (process.env.TIMESHEET_API_URL) {
      options.baseUrl = process.env.TIMESHEET_API_URL;
    }

    this.client = new TimesheetClient(options);

    return {
      content: [
        {
          type: 'text',
          text: 'Authentication configured successfully',
        },
      ],
      structuredContent: {
        success: true,
      },
    };
  }

  // ============================================================================
  // Reports API - Document Reports
  // ============================================================================

  private async handleReportDocumentGet(args: any) {
    const client = this.getClient();
    const { documentId } = args;

    try {
      const report = await client.reports.documents.get(documentId);

      return {
        content: [
          {
            type: 'text',
            text: `Document Report: ${report.documentTitle || 'Untitled'}\nInvoice #${report.invoiceNumber || 'N/A'}\nTotal: ${report.totalAmount || 'N/A'}`,
          },
        ],
        structuredContent: report,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleReportDocumentPdf(args: any) {
    const client = this.getClient();
    const { documentId } = args;

    try {
      const pdfData = await client.reports.documents.getPdf(documentId);
      return formatPdfReportResponse('document', documentId, pdfData);
    } catch (error) {
      return this.handleApiError(error);
    }
  }


  private async handleReportDocumentXml(args: any) {
    const client = this.getClient();
    const { documentId } = args;

    try {
      const xml = await client.reports.documents.getXml(documentId);

      return {
        content: [
          {
            type: 'text',
            text: `E-Invoice XML generated successfully for document ${documentId}`,
          },
        ],
        structuredContent: {
          success: true,
          documentId,
          xml,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // ============================================================================
  // Reports API - Task Reports
  // ============================================================================

  private async handleReportTaskGet(args: any) {
    const client = this.getClient();
    const { taskId } = args;

    try {
      const report = await client.reports.tasks.get(taskId);

      return {
        content: [
          {
            type: 'text',
            text: `Task Report: ${report.projectName || 'No Project'}\nDate: ${report.taskDate || 'N/A'}\nDuration: ${report.taskDuration || 'N/A'}\nTotal: ${report.taskTotal || 'N/A'}`,
          },
        ],
        structuredContent: report,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleReportTaskPdf(args: any) {
    const client = this.getClient();
    const { taskId } = args;

    try {
      const pdfData = await client.reports.tasks.getPdf(taskId);
      return formatPdfReportResponse('task', taskId, pdfData);
    } catch (error) {
      return this.handleApiError(error);
    }
  }


  // ============================================================================
  // Reports API - Expense Reports
  // ============================================================================

  private async handleReportExpenseGet(args: any) {
    const client = this.getClient();
    const { expenseId } = args;

    try {
      const report = await client.reports.expenses.get(expenseId);

      return {
        content: [
          {
            type: 'text',
            text: `Expense Report:\nDate: ${report.expenseDate || 'N/A'}\nAmount: ${report.expenseAmount || 'N/A'}\nDescription: ${report.expenseDescription || 'No description'}`,
          },
        ],
        structuredContent: report,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleReportExpensePdf(args: any) {
    const client = this.getClient();
    const { expenseId } = args;

    try {
      const pdfData = await client.reports.expenses.getPdf(expenseId);
      return formatPdfReportResponse('expense', expenseId, pdfData);
    } catch (error) {
      return this.handleApiError(error);
    }
  }


  // ============================================================================
  // Reports API - Note Reports
  // ============================================================================

  private async handleReportNoteGet(args: any) {
    const client = this.getClient();
    const { noteId } = args;

    try {
      const report = await client.reports.notes.get(noteId);

      return {
        content: [
          {
            type: 'text',
            text: `Note Report:\nDate: ${report.noteDate || 'N/A'}\nAuthor: ${report.noteAuthor || 'Unknown'}\nContent: ${report.noteContent || 'No content'}`,
          },
        ],
        structuredContent: report,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleReportNotePdf(args: any) {
    const client = this.getClient();
    const { noteId } = args;

    try {
      const pdfData = await client.reports.notes.getPdf(noteId);
      return formatPdfReportResponse('note', noteId, pdfData);
    } catch (error) {
      return this.handleApiError(error);
    }
  }


  // ============================================================================
  // Reports API - Export Generation
  // ============================================================================

  private async handleExportGenerate(args: any) {
    const client = this.getClient();
    const { report, startDate, endDate, format, teamIds, projectIds, userIds, tagIds, type, filter, splitTask, summarize, filename } = args;

    try {
      const [result, reportName] = await Promise.all([
        client.reports.export.generate({
          report,
          startDate,
          endDate,
          format,
          teamIds,
          projectIds,
          userIds,
          tagIds,
          type,
          filter,
          splitTask,
          summarize,
          filename,
        }),
        this.getReportName(report),
      ]);

      return formatExportResultResponse(
        `Export generated successfully!\nDownload URL: ${result.url}`,
        {
          status: 'ready',
          format: exportFormat(format, result.url),
          startDate,
          endDate,
          downloadUrl: result.url,
          filename,
          reportName,
        },
        { url: result.url }
      );
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleExportSend(args: any) {
    const client = this.getClient();
    const { email, report, startDate, endDate, format, teamIds, projectIds, filename } = args;

    try {
      const [, reportName] = await Promise.all([
        client.reports.export.send({
          email,
          report,
          startDate,
          endDate,
          format,
          teamIds,
          projectIds,
          filename,
        }),
        this.getReportName(report),
      ]);

      return formatExportResultResponse(
        `Export sent successfully to ${email}`,
        {
          status: 'sent',
          format: exportFormat(format),
          startDate,
          endDate,
          email,
          filename,
          reportName,
        },
        { success: true, email }
      );
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * The from-template endpoint returns the file itself, which a tool result cannot hand to the
   * user. The template's settings go through the regular export instead, which returns a
   * download link.
   */
  private async handleExportFromTemplate(args: any) {
    const client = this.getClient();
    const { templateId, startDate, endDate } = args;

    try {
      const template = await client.reports.export.getTemplate(templateId);
      const [result, reportName] = await Promise.all([
        client.reports.export.generate({
          report: template.report,
          startDate,
          endDate,
          format: template.format as any,
          teamIds: idList(template.teamIds),
          projectIds: idList(template.projectIds),
          userIds: idList(template.userIds),
          tagIds: idList(template.tagIds),
          type: template.type,
          filter: template.filter,
          splitTask: template.splitTask,
          summarize: template.summarize,
          filename: template.filename,
          exportedFields: idList(template.exportedFields as any) as any,
        }),
        this.getReportName(template.report),
      ]);

      return formatExportResultResponse(
        `Export generated from template "${template.name}"\nDownload URL: ${result.url}`,
        {
          status: 'ready',
          format: exportFormat(template.format, result.url),
          startDate,
          endDate,
          downloadUrl: result.url,
          filename: template.filename,
          reportName: reportName ?? template.name,
        },
        { success: true, templateId, url: result.url }
      );
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /** Name of an export report type for the result card; undefined if it cannot be looked up. */
  private async getReportName(report: number | undefined): Promise<string | undefined> {
    if (report === undefined || report === null) {
      return undefined;
    }
    try {
      const types = await this.getClient().reports.export.getReportTypes();
      return types.items?.find((t: any) => t.id === Number(report))?.name;
    } catch {
      return undefined;
    }
  }

  // ============================================================================
  // Reports API - Export Configuration
  // ============================================================================

  private async handleExportFields(args: any) {
    const client = this.getClient();
    const { scope } = args;

    try {
      const result = await client.reports.export.getFields(scope);

      const fieldList = result.fields
        .slice(0, 10)
        .map((f: any) => `- ${f.name} (${f.fieldId})`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Available export fields (${result.fields.length} total):\n${fieldList}${result.fields.length > 10 ? '\n...and more' : ''}`,
          },
        ],
        structuredContent: result,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleExportReportTypes() {
    const client = this.getClient();

    try {
      const result = await client.reports.export.getReportTypes();

      const reportList = result.items
        .map((r: any) => `- ${r.id}: ${r.name}${r.description ? ` - ${r.description}` : ''}`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Available report types:\n${reportList}`,
          },
        ],
        structuredContent: result,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // ============================================================================
  // Reports API - Export Templates
  // ============================================================================

  private async handleExportTemplateList(args: any) {
    const client = this.getClient();
    const { limit, page, search, sort, order } = args;

    try {
      const result = await client.reports.export.listTemplates({
        limit: limit || 20,
        page,
        search,
        sort,
        order,
      });

      const templates = result.items;

      // Return with ExportWidget component metadata for ChatGPT
      return formatExportTemplateListResponse(templates, templates.length);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleExportTemplateGet(args: any) {
    const client = this.getClient();
    const { templateId } = args;

    try {
      const template = await client.reports.export.getTemplate(templateId);

      return {
        content: [
          {
            type: 'text',
            text: `Template: ${template.name}\nFormat: ${template.format || 'N/A'}\nReport Type: ${template.report || 'N/A'}`,
          },
        ],
        structuredContent: template,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleExportTemplateCreate(args: any) {
    const client = this.getClient();
    const { name, report, format, teamIds, projectIds, userIds, type, filter, splitTask, summarize, email, filename } = args;

    try {
      const template = await client.reports.export.createTemplate({
        name,
        report,
        format,
        teamIds,
        projectIds,
        userIds,
        type,
        filter,
        splitTask,
        summarize,
        email,
        filename,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Template "${template.name}" created successfully with ID: ${template.id}`,
          },
        ],
        structuredContent: {
          id: template.id,
          name: template.name,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleExportTemplateUpdate(args: any) {
    const client = this.getClient();
    const { templateId, name, report, format, teamIds, projectIds } = args;

    try {
      const template = await client.reports.export.updateTemplate(templateId, {
        name,
        report,
        format,
        teamIds,
        projectIds,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Template "${template.name}" updated successfully`,
          },
        ],
        structuredContent: {
          id: template.id,
          name: template.name,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleExportTemplateDelete(args: any) {
    const client = this.getClient();
    const { templateId } = args;

    try {
      await client.reports.export.deleteTemplate(templateId);

      return {
        content: [
          {
            type: 'text',
            text: `Template ${templateId} deleted successfully`,
          },
        ],
        structuredContent: {
          success: true,
          deletedId: templateId,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleStatisticsGet(args: any) {
    const { startDate, endDate, projectId, projectIds, teamId, teamIds, tagIds, userIds, filter } = args;
    const rangeError = validateStatisticsRange(startDate, endDate);
    if (rangeError) {
      return { content: [{ type: 'text', text: rangeError }], isError: true };
    }
    const client = this.getClient();

    try {
      const searchParams: any = {
        startDate,
        endDate,
        limit: STATISTICS_PAGE_SIZE,
        populateTags: false,
      };
      if (projectId) searchParams.projectId = projectId;
      if (projectIds) searchParams.projectIds = projectIds;
      if (teamId) searchParams.teamId = teamId;
      if (teamIds) searchParams.teamIds = teamIds;
      if (tagIds) searchParams.tagIds = tagIds;
      if (userIds) searchParams.userIds = userIds;
      if (filter) searchParams.filter = filter;

      const [{ items, complete }, userData] = await Promise.all([
        fetchAllPages((page) => client.tasks.search({ ...searchParams, page })),
        this.getProfileAndSettings(),
      ]);
      if (!complete) {
        console.error(`[MCP] statistics_get: only the first ${items.length} tasks of the range were read`);
      }
      // Pages are separate queries sorted by time, so entries that share a time can land on two of them
      const tasks = [...new Map(items.map((task: any) => [task.id, task])).values()];

      const stats = { ...computeStatistics(tasks, startDate, endDate), truncated: !complete };
      return formatStatisticsResponse(stats, userData.profile, userData.settings);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private handleApiError(error: any) {
    // Tier-gate rejection from the backend (402). Surface the required tier so
    // the AI client can tell the user exactly what to upgrade.
    if (error instanceof TimesheetApiError && error.statusCode === 402) {
      let body: { error?: string; required?: string; current?: string } = {};
      if (error.responseBody) {
        try {
          body = JSON.parse(error.responseBody);
        } catch {
          // Fall through with empty body
        }
      }
      const code = body.error ?? 'tier_insufficient';
      const required = body.required ?? null;
      const current = body.current ?? null;

      let text: string;
      switch (code) {
        case 'no_subscription':
          text = 'This action requires an active Timesheet subscription. Ask the user to subscribe at https://timesheet.io/subscription/edit.';
          break;
        case 'subscription_expired':
          text = `The user's${current ? ' ' + current : ''} Timesheet subscription has expired. Ask them to reactivate at https://timesheet.io/subscription/edit.`;
          break;
        case 'tier_insufficient':
        default:
          if (required && current) {
            text = `This action requires the ${required} tier. The user is on ${current}. Ask them to upgrade at https://timesheet.io/subscription/edit.`;
          } else if (required) {
            text = `This action requires the ${required} tier. Ask the user to upgrade at https://timesheet.io/subscription/edit.`;
          } else {
            text = 'This action requires a higher Timesheet subscription tier. Ask the user to upgrade at https://timesheet.io/subscription/edit.';
          }
      }

      return {
        content: [{ type: 'text', text }],
        structuredContent: {
          error: code,
          required,
          current,
          upgradeUrl: 'https://timesheet.io/subscription/edit',
        },
        isError: true,
      };
    }

    const isApiError = error instanceof TimesheetApiError;
    const errorMessage = isApiError
      ? error.message
      : error.response?.data?.message || error.message || 'Unknown error';
    const statusCode = isApiError ? error.statusCode : error.response?.status;

    return {
      content: [
        {
          type: 'text',
          text: `API Error${statusCode ? ` (${statusCode})` : ''}: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }

  /**
   * Run server with stdio transport (for Claude Desktop)
   */
  /**
   * Serves this server's configuration over stdio for both protocol eras: a 2025-era `initialize`
   * pins the connection to one instance, a 2026-07-28 client is answered per request. The factory
   * builds a fresh instance each time it is called, as serveStdio requires.
   */
  runStdio() {
    const handle = serveStdio(() => new TimesheetMCPServer({ oauthToken: this.oauthToken }).getServer(), {
      onerror: (error) => console.error('[MCP] stdio:', error),
    });
    console.error('Timesheet MCP server running on stdio (protocol 2025-* and 2026-07-28)');
    console.error('Initial environment check:', {
      TIMESHEET_API_TOKEN: process.env.TIMESHEET_API_TOKEN ? 'Set' : 'Not set',
      TIMESHEET_API_URL: process.env.TIMESHEET_API_URL || 'Not set'
    });
    return handle;
  }
}

// Only run stdio server if executed directly (not imported).
// Resolve the entry path before comparing: npx runs the bin through a symlink in
// node_modules/.bin, so process.argv[1] is the link while import.meta.url is the
// real file. Without realpathSync the guard is never true under npx and the
// process exits 0 without starting anything.
// pathToFileURL keeps the comparison working on Windows, where process.argv[1]
// is a backslash path and import.meta.url is a forward-slash file:// URL.
function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
}

if (isMainModule()) {
  new TimesheetMCPServer().runStdio();
}
