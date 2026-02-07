#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TimesheetClient, TimesheetClientOptions } from '@timesheet/sdk';
import dotenv from 'dotenv';
import {
  formatTimerResponse,
  formatProjectListResponse,
  formatProjectCardResponse,
  formatTaskListResponse,
  formatTaskCardResponse,
  formatStatisticsResponse,
  formatExportTemplateListResponse,
  getOAuthMetadata,
  getComponentMetadataForTool,
  getStaticWidgetDescription,
  getComponentResourceUri,
  RESOURCE_MIME_TYPE,
} from './mcp-app-helpers.js';

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
}

export class TimesheetMCPServer {
  private server: Server;
  private client: TimesheetClient | null = null;
  private oauthToken?: string;

  /**
   * Create a new TimesheetMCPServer instance
   * @param options - Optional configuration including OAuth token
   */
  constructor(options?: TimesheetMCPServerOptions) {
    this.oauthToken = options?.oauthToken;

    this.server = new Server(
      {
        name: 'timesheet-mcp',
        version: '1.0.3',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
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

      // Set base URL from environment
      if (process.env.TIMESHEET_API_URL) {
        options.baseUrl = process.env.TIMESHEET_API_URL;
      }

      // Priority 1: OAuth token from constructor (ChatGPT/HTTP)
      if (this.oauthToken) {
        console.error('[Auth] Using OAuth token from request');
        options.oauth2Token = this.oauthToken;
      }
      // Priority 2: API key from environment (CLI usage)
      else if (process.env.TIMESHEET_API_TOKEN) {
        console.error('[Auth] Using API key from environment');
        options.apiKey = process.env.TIMESHEET_API_TOKEN;
      }
      // No authentication available
      else {
        throw new McpError(
          ErrorCode.InternalError,
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
    // Initialize request handler with OAuth metadata
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      const oauthMeta = getOAuthMetadata();

      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'timesheet-mcp',
          version: '1.0.3',
        },
        // Add OAuth 2.1 authorization metadata for ChatGPT
        authorization: oauthMeta,
      };
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        console.error('[MCP] ListTools request received');
        const tools = [
          // Timer Management Tools
        {
          name: 'timer_start',
          title: 'Start Timer',
          description: 'Use this when the user wants to begin tracking time on a specific project. The user can optionally specify a custom start time in the past, otherwise it defaults to now.',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'The unique identifier of the project to track time for. Use project_list to find available projects.',
              },
              startDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Optional start time in ISO 8601 format (e.g., "2025-10-08T10:30:00Z"). If not provided, uses current time.',
              },
            },
            required: ['projectId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['running', 'paused', 'stopped'],
                description: 'Current timer status',
              },
              projectTitle: {
                type: 'string',
                description: 'Name of the project being tracked',
              },
              projectId: {
                type: 'string',
                description: 'ID of the project',
              },
              duration: {
                type: 'number',
                description: 'Current duration in seconds',
              },
              startTime: {
                type: 'string',
                format: 'date-time',
                description: 'When the timer was started',
              },
            },
            required: ['status'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('TimerWidget'),
        },
        {
          name: 'timer_stop',
          title: 'Stop Timer',
          description: 'Use this when the user wants to stop the currently active timer and complete the time tracking session. The user can optionally specify when the timer should be stopped.',
          inputSchema: {
            type: 'object',
            properties: {
              endDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Optional end time in ISO 8601 format (e.g., "2025-10-08T18:00:00Z"). If not provided, uses current time.',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['stopped'],
                description: 'Timer status after stopping',
              },
              duration: {
                type: 'number',
                description: 'Total duration tracked in seconds',
              },
              hours: {
                type: 'number',
                description: 'Hours component of duration',
              },
              minutes: {
                type: 'number',
                description: 'Minutes component of duration',
              },
            },
            required: ['status', 'duration'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('TimerWidget'),
        },
        {
          name: 'timer_pause',
          title: 'Pause Timer',
          description: 'Use this when the user wants to pause the timer to take a break. This temporarily stops time tracking while keeping the task active.',
          inputSchema: {
            type: 'object',
            properties: {
              startDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Optional pause start time in ISO 8601 format (e.g., "2025-10-08T12:00:00Z"). If not provided, uses current time.',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['paused'],
                description: 'Timer status after pausing',
              },
            },
            required: ['status'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('TimerWidget'),
        },
        {
          name: 'timer_resume',
          title: 'Resume Timer',
          description: 'Use this when the user wants to resume time tracking after a break or pause. This restarts the timer from its paused state.',
          inputSchema: {
            type: 'object',
            properties: {
              endDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Optional pause end time in ISO 8601 format (e.g., "2025-10-08T13:00:00Z"). If not provided, uses current time.',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['running'],
                description: 'Timer status after resuming',
              },
            },
            required: ['status'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('TimerWidget'),
        },
        {
          name: 'timer_status',
          title: 'Get Timer Status',
          description: 'Use this when the user wants to check the current state of their timer, including whether it\'s running, paused, or stopped, and details about the active task.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          outputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['running', 'paused', 'stopped'],
                description: 'Current timer status',
              },
              projectTitle: {
                type: 'string',
                description: 'Name of the project being tracked (if active)',
              },
              projectId: {
                type: 'string',
                description: 'ID of the project (if active)',
              },
              description: {
                type: 'string',
                description: 'Task description (if provided)',
              },
              duration: {
                type: 'number',
                description: 'Current duration in seconds (if active)',
              },
              hours: {
                type: 'number',
                description: 'Hours component of duration',
              },
              minutes: {
                type: 'number',
                description: 'Minutes component of duration',
              },
            },
            required: ['status'],
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('TimerWidget'),
        },
        {
          name: 'timer_update',
          title: 'Update Timer Task',
          description: 'Use this when the user wants to modify details of the currently running timer task, such as description, location, billability, or mood rating.',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Task description or notes about what work is being done',
              },
              location: {
                type: 'string',
                description: 'Physical location where work started (e.g., "Office", "Home", "Client site")',
              },
              locationEnd: {
                type: 'string',
                description: 'Physical location where work ended',
              },
              feeling: {
                type: 'number',
                minimum: 1,
                maximum: 5,
                description: 'Mood or satisfaction rating from 1 (poor) to 5 (excellent)',
              },
              billable: {
                type: 'boolean',
                description: 'Whether this time should be billed to the client',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags or categories to help organize this task (e.g., ["meeting", "development", "urgent"])',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the update was successful',
              },
            },
            required: ['success'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('TimerWidget'),
        },

        // Task Item Management
        {
          name: 'task_add_note',
          title: 'Add Note to Task',
          description: 'Use this when the user wants to add a text note or comment to the currently running task for future reference or documentation.',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'The note content or comment to attach to the task',
                minLength: 1,
              },
              dateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Optional timestamp for the note in ISO 8601 format. If not provided, uses current time.',
              },
            },
            required: ['text'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the note was added successfully',
              },
              noteText: {
                type: 'string',
                description: 'The note text that was added',
              },
            },
            required: ['success'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'task_add_expense',
          title: 'Add Expense to Task',
          description: 'Use this when the user wants to record an expense or cost associated with the currently running task, such as travel, materials, or client entertainment.',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description of what the expense was for (e.g., "Taxi to client site", "Lunch meeting", "Materials")',
                minLength: 1,
              },
              amount: {
                type: 'number',
                description: 'Expense amount in the user\'s default currency',
                minimum: 0,
              },
              dateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Optional timestamp for when the expense occurred in ISO 8601 format. If not provided, uses current time.',
              },
            },
            required: ['description', 'amount'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the expense was added successfully',
              },
              expenseDescription: {
                type: 'string',
                description: 'The expense description',
              },
              amount: {
                type: 'number',
                description: 'The expense amount recorded',
              },
            },
            required: ['success'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'task_add_pause',
          title: 'Add Manual Pause to Task',
          description: 'Use this when the user wants to manually record a past break or pause period that was not tracked in real-time.',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Reason for the pause (e.g., "Lunch break", "Meeting", "Coffee break")',
              },
              startDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'When the pause started in ISO 8601 format',
              },
              endDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'When the pause ended in ISO 8601 format',
              },
            },
            required: ['startDateTime', 'endDateTime'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the pause was added successfully',
              },
              duration: {
                type: 'number',
                description: 'Duration of the pause in seconds',
              },
            },
            required: ['success'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // Team Management
        {
          name: 'team_list',
          title: 'List Teams',
          description: 'Use this when the user wants to view or search for teams. IMPORTANT: Use this tool to find team IDs by searching team names, which can then be used to filter projects. Supports text search and pagination.',
          inputSchema: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Search query to filter teams by name (partial match supported)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of teams to return. Defaults to 20 if not specified.',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (1-based). Use with limit to fetch subsequent pages.',
              },
              organizationId: {
                type: 'string',
                description: 'Filter teams by organization ID',
              },
              sort: {
                type: 'string',
                enum: ['alpha', 'permission', 'created'],
                description: 'Sort field: alpha=alphabetical by name, permission=by user permission level, created=by creation date',
              },
              order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort order (ascending or descending)',
              },
              statistics: {
                type: 'boolean',
                description: 'Include statistics with team data',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              teams: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Team ID' },
                    name: { type: 'string', description: 'Team name' },
                    description: { type: 'string', description: 'Team description' },
                    organizationId: { type: 'string', description: 'Organization ID' },
                    color: { type: 'number', description: 'Team color code' },
                  },
                },
                description: 'List of teams matching the criteria',
              },
              totalCount: {
                type: 'number',
                description: 'Total number of teams returned',
              },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // Project Management
        {
          name: 'project_list',
          title: 'List Projects',
          description: 'Use this when the user wants to view their projects. IMPORTANT: When the user asks for a specific number (e.g., "show me 5 projects"), use the limit parameter to control how many projects are returned. Always use pagination to avoid loading all projects unnecessarily. Supports filtering by team, status, date ranges, and text search.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of projects to return. Use this when user asks for a specific number (e.g., "5 projects" = limit: 5). Defaults to 20 if not specified.',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (1-based). Use with limit to fetch subsequent pages.',
              },
              teamId: {
                type: 'string',
                description: 'Optional team ID to filter projects belonging to a specific team',
              },
              teamIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of team IDs to filter projects belonging to multiple teams',
              },
              projectIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of project IDs to filter specific projects',
              },
              search: {
                type: 'string',
                description: 'Optional search query to filter projects by title (partial match supported)',
              },
              status: {
                type: 'string',
                enum: ['all', 'active', 'inactive'],
                description: 'Filter by project status. "active" = non-archived, "inactive" = archived, "all" = both. Defaults to "all" if not specified.',
              },
              sort: {
                type: 'string',
                enum: ['alpha', 'alphaNum', 'client', 'duration', 'created', 'status'],
                description: 'Sort field for projects: alpha=alphabetical, alphaNum=alphanumeric, client=by client name, duration=total time tracked, created=creation date, status=active/inactive',
              },
              order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort order (ascending or descending)',
              },
              taskStartDate: {
                type: 'string',
                description: 'Filter projects with tasks starting on or after this date (ISO 8601 format: YYYY-MM-DD)',
              },
              taskEndDate: {
                type: 'string',
                description: 'Filter projects with tasks ending on or before this date (ISO 8601 format: YYYY-MM-DD)',
              },
              taskRateId: {
                type: 'string',
                description: 'Filter projects containing tasks with this specific rate ID',
              },
              taskType: {
                type: 'string',
                description: 'Filter projects containing tasks of a specific type',
              },
              taskFilter: {
                type: 'string',
                description: 'Additional task-level filter for projects',
              },
              taskUserIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter projects containing tasks assigned to these user IDs',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              projects: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Project ID' },
                    title: { type: 'string', description: 'Project name' },
                    description: { type: 'string', description: 'Project description' },
                    archived: { type: 'boolean', description: 'Whether project is archived' },
                    color: { type: 'number', description: 'Project color code' },
                  },
                },
                description: 'List of projects matching the criteria',
              },
              totalCount: {
                type: 'number',
                description: 'Total number of projects returned',
              },
            },
            required: ['projects'],
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('ProjectList'),
        },
        {
          name: 'project_create',
          title: 'Create Project',
          description: 'Use this when the user wants to create a new project to organize their time tracking.',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'The project name or title',
                minLength: 1,
              },
              description: {
                type: 'string',
                description: 'Optional description providing more details about the project',
              },
              color: {
                type: 'number',
                description: 'Optional color code for visual identification (typically 0-23)',
                minimum: 0,
              },
              teamId: {
                type: 'string',
                description: 'Optional team ID if this project belongs to a team',
              },
              taskDefaultBillable: {
                type: 'boolean',
                description: 'Whether tasks in this project should be billable by default',
              },
            },
            required: ['title'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The ID of the newly created project',
              },
              title: {
                type: 'string',
                description: 'The project title',
              },
            },
            required: ['id', 'title'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'project_update',
          title: 'Update Project',
          description: 'Use this when the user wants to modify an existing project\'s details such as title, description, or archive status.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The project ID to update',
              },
              title: {
                type: 'string',
                description: 'Updated project title',
                minLength: 1,
              },
              description: {
                type: 'string',
                description: 'Updated project description',
              },
              archived: {
                type: 'boolean',
                description: 'Set to true to archive the project, false to unarchive it',
              },
            },
            required: ['id'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The updated project ID',
              },
              title: {
                type: 'string',
                description: 'The updated project title',
              },
            },
            required: ['id'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'project_delete',
          title: 'Delete Project',
          description: 'Use this when the user wants to permanently delete a project. WARNING: This is a destructive operation that cannot be undone. All associated tasks will remain but will lose their project association.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The project ID to delete permanently',
              },
            },
            required: ['id'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the deletion was successful',
              },
              deletedId: {
                type: 'string',
                description: 'The ID of the deleted project',
              },
            },
            required: ['success'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
        },
        {
          name: 'project_get',
          title: 'Get Project',
          description: 'Use this when the user wants to view detailed information about a specific project.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The project ID to retrieve',
              },
            },
            required: ['id'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Project ID',
              },
              title: {
                type: 'string',
                description: 'Project title',
              },
              description: {
                type: 'string',
                description: 'Project description',
              },
              color: {
                type: 'number',
                description: 'Project color as decimal integer',
              },
              archived: {
                type: 'boolean',
                description: 'Whether the project is archived',
              },
            },
            required: ['id', 'title'],
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('ProjectCard'),
        },

        // Task Management
        {
          name: 'task_list',
          title: 'List Tasks',
          description: 'Use this when the user wants to view their time entries. IMPORTANT: When the user asks for a specific number (e.g., "show me 10 tasks"), use the limit parameter to control how many tasks are returned. Always use pagination to avoid loading all tasks unnecessarily. Supports extensive filtering by organization, team, project, user, tags, and more.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of tasks to return. Use this when user asks for a specific number (e.g., "10 tasks" = limit: 10). Defaults to 20 if not specified.',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (1-based). Use with limit to fetch subsequent pages.',
              },
              sort: {
                type: 'string',
                enum: ['dateTime', 'time', 'created'],
                description: 'Sort field for tasks: dateTime=by start/end time, time=by duration, created=by creation date',
              },
              order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort order (ascending or descending)',
              },
              startDate: {
                type: 'string',
                format: 'date',
                description: 'Filter tasks starting on or after this date (YYYY-MM-DD format)',
              },
              endDate: {
                type: 'string',
                format: 'date',
                description: 'Filter tasks ending on or before this date (YYYY-MM-DD format)',
              },
              running: {
                type: 'boolean',
                description: 'If true, only return currently running tasks',
              },
              organizationId: {
                type: 'string',
                description: 'Filter tasks by organization ID',
              },
              teamId: {
                type: 'string',
                description: 'Filter tasks by team ID',
              },
              teamIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter tasks by multiple team IDs',
              },
              projectId: {
                type: 'string',
                description: 'Filter tasks for a specific project',
              },
              projectIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter tasks by multiple project IDs',
              },
              todoId: {
                type: 'string',
                description: 'Filter tasks associated with a specific todo/task item',
              },
              taskIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter specific tasks by IDs',
              },
              rateId: {
                type: 'string',
                description: 'Filter tasks by rate/billing rate ID',
              },
              documentId: {
                type: 'string',
                description: 'Filter tasks associated with a specific document',
              },
              type: {
                type: 'string',
                enum: ['all', 'task', 'mileage', 'call'],
                description: 'Filter tasks by type: all=all types, task=regular time entries, mileage=mileage entries, call=call entries',
              },
              filter: {
                type: 'string',
                enum: ['all', 'billable', 'notBillable', 'paid', 'unpaid', 'billed', 'outstanding'],
                description: 'Filter tasks by billing/payment status: all=all tasks, billable=only billable, notBillable=non-billable, paid=payment received, unpaid=not paid, billed=invoice sent, outstanding=billed but unpaid',
              },
              excludeTaskIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Exclude specific task IDs from results',
              },
              tagIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter tasks by tag IDs',
              },
              userIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter tasks by user IDs (task owners)',
              },
              feelings: {
                type: 'array',
                items: { type: 'number' },
                description: 'Filter tasks by feeling/satisfaction ratings (1-5)',
              },
              populatePauses: {
                type: 'boolean',
                description: 'Include pause/break information in task details',
              },
              populateExpenses: {
                type: 'boolean',
                description: 'Include expense information in task details',
              },
              populateNotes: {
                type: 'boolean',
                description: 'Include notes in task details',
              },
              populateTags: {
                type: 'boolean',
                description: 'Include tag details in task information',
              },
              performance: {
                type: 'boolean',
                description: 'Include performance metrics in task details',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Task ID' },
                    description: { type: 'string', description: 'Task description' },
                    projectTitle: { type: 'string', description: 'Project name' },
                    duration: { type: 'number', description: 'Duration in seconds' },
                    hours: { type: 'number', description: 'Hours component' },
                    minutes: { type: 'number', description: 'Minutes component' },
                  },
                },
                description: 'List of tasks matching the criteria',
              },
            },
            required: ['tasks'],
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('TaskList'),
        },
        {
          name: 'task_create',
          title: 'Create Task',
          description: 'Use this when the user wants to manually create a time entry for past work, rather than using the timer.',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'The project ID this task belongs to',
              },
              startDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'When the work started in ISO 8601 format (e.g., "2025-10-08T09:00:00Z")',
              },
              endDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Optional end time in ISO 8601 format. If provided, creates a completed task.',
              },
              description: {
                type: 'string',
                description: 'Optional description of what work was done',
              },
              billable: {
                type: 'boolean',
                description: 'Whether this task should be billable to the client. Defaults to project setting.',
              },
            },
            required: ['projectId', 'startDateTime'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The ID of the newly created task',
              },
              duration: {
                type: 'number',
                description: 'Duration of the task in seconds (if endDateTime was provided)',
              },
            },
            required: ['id'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'task_update',
          title: 'Update Task',
          description: 'Use this when the user wants to modify details of an existing time entry such as times, description, or billing status.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The task ID to update',
              },
              description: {
                type: 'string',
                description: 'Updated task description',
              },
              startDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Updated start time in ISO 8601 format',
              },
              endDateTime: {
                type: 'string',
                format: 'date-time',
                description: 'Updated end time in ISO 8601 format',
              },
              billable: {
                type: 'boolean',
                description: 'Updated billable status',
              },
              paid: {
                type: 'boolean',
                description: 'Mark task as paid (for invoicing)',
              },
              billed: {
                type: 'boolean',
                description: 'Mark task as billed (invoice sent to client)',
              },
            },
            required: ['id'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the update was successful',
              },
              id: {
                type: 'string',
                description: 'The updated task ID',
              },
            },
            required: ['success'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'task_delete',
          title: 'Delete Task',
          description: 'Use this when the user wants to permanently delete a time entry. WARNING: This is a destructive operation that cannot be undone.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The task ID to delete permanently',
              },
            },
            required: ['id'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether the deletion was successful',
              },
              deletedId: {
                type: 'string',
                description: 'The ID of the deleted task',
              },
            },
            required: ['success'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
        },
        {
          name: 'task_get',
          title: 'Get Task',
          description: 'Use this when the user wants to view detailed information about a specific time entry/task.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The task ID to retrieve',
              },
            },
            required: ['id'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Task ID',
              },
              description: {
                type: 'string',
                description: 'Task description',
              },
              projectTitle: {
                type: 'string',
                description: 'Associated project title',
              },
              startDateTime: {
                type: 'string',
                description: 'Start date and time',
              },
              endDateTime: {
                type: 'string',
                description: 'End date and time',
              },
              duration: {
                type: 'number',
                description: 'Duration in seconds',
              },
              billable: {
                type: 'boolean',
                description: 'Whether the task is billable',
              },
            },
            required: ['id'],
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('TaskCard'),
        },

        // Authentication
        {
          name: 'auth_configure',
          title: 'Configure API Authentication',
          description: 'Use this when the user needs to configure API key authentication for the Timesheet MCP server. NOTE: This will be deprecated once OAuth 2.1 is implemented.',
          inputSchema: {
            type: 'object',
            properties: {
              apiKey: {
                type: 'string',
                description: 'The API key for authenticating with the Timesheet API',
                minLength: 1,
              },
              baseUrl: {
                type: 'string',
                format: 'uri',
                description: 'Optional custom API base URL (e.g., "https://api-test.timesheet.io" for testing)',
              },
            },
            required: ['apiKey'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                description: 'Whether authentication was configured successfully',
              },
            },
            required: ['success'],
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // ============================================================================
        // Reports API - Document Reports
        // ============================================================================
        {
          name: 'report_document_get',
          title: 'Get Document Report Data',
          description: 'Use this when the user wants to retrieve formatted document/invoice data including tasks, expenses, and financial calculations. Returns JSON data ready for display.',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: {
                type: 'string',
                description: 'The unique identifier of the document/invoice to retrieve',
              },
            },
            required: ['documentId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              documentTitle: { type: 'string', description: 'Document title' },
              invoiceNumber: { type: 'string', description: 'Invoice number' },
              totalAmount: { type: 'string', description: 'Formatted total amount' },
              tasks: { type: 'array', description: 'List of task items' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'report_document_pdf',
          title: 'Generate Document PDF',
          description: 'Use this when the user wants to generate and download a PDF version of a document/invoice. Returns a download URL for the PDF file.',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: {
                type: 'string',
                description: 'The unique identifier of the document/invoice to generate PDF for',
              },
            },
            required: ['documentId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether PDF was generated successfully' },
              size: { type: 'number', description: 'PDF file size in bytes' },
              message: { type: 'string', description: 'Status message' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'report_document_xml',
          title: 'Generate Document XML',
          description: 'Use this when the user wants to generate XML representation of a document for e-invoicing (Zugferd, XRechnung, ebInterface). Returns XML data for electronic invoice processing.',
          inputSchema: {
            type: 'object',
            properties: {
              documentId: {
                type: 'string',
                description: 'The unique identifier of the document/invoice to generate XML for',
              },
            },
            required: ['documentId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether XML was generated successfully' },
              xml: { type: 'string', description: 'XML content' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // ============================================================================
        // Reports API - Task Reports
        // ============================================================================
        {
          name: 'report_task_get',
          title: 'Get Task Report Data',
          description: 'Use this when the user wants to retrieve formatted task data including time tracking, rates, and project details.',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'The unique identifier of the task to retrieve report data for',
              },
            },
            required: ['taskId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              taskDate: { type: 'string', description: 'Formatted task date' },
              taskDuration: { type: 'string', description: 'Formatted duration' },
              projectName: { type: 'string', description: 'Project name' },
              taskTotal: { type: 'string', description: 'Formatted total amount' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'report_task_pdf',
          title: 'Generate Task PDF',
          description: 'Use this when the user wants to generate and download a PDF report for a specific task.',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'The unique identifier of the task to generate PDF for',
              },
            },
            required: ['taskId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether PDF was generated successfully' },
              size: { type: 'number', description: 'PDF file size in bytes' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // ============================================================================
        // Reports API - Expense Reports
        // ============================================================================
        {
          name: 'report_expense_get',
          title: 'Get Expense Report Data',
          description: 'Use this when the user wants to retrieve formatted expense data including amounts and receipt information.',
          inputSchema: {
            type: 'object',
            properties: {
              expenseId: {
                type: 'string',
                description: 'The unique identifier of the expense to retrieve report data for',
              },
            },
            required: ['expenseId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              expenseDate: { type: 'string', description: 'Formatted expense date' },
              expenseAmount: { type: 'string', description: 'Formatted amount' },
              expenseDescription: { type: 'string', description: 'Expense description' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'report_expense_pdf',
          title: 'Generate Expense PDF',
          description: 'Use this when the user wants to generate and download a PDF report for a specific expense including receipt images.',
          inputSchema: {
            type: 'object',
            properties: {
              expenseId: {
                type: 'string',
                description: 'The unique identifier of the expense to generate PDF for',
              },
            },
            required: ['expenseId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether PDF was generated successfully' },
              size: { type: 'number', description: 'PDF file size in bytes' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // ============================================================================
        // Reports API - Note Reports
        // ============================================================================
        {
          name: 'report_note_get',
          title: 'Get Note Report Data',
          description: 'Use this when the user wants to retrieve formatted note data including content and attachments.',
          inputSchema: {
            type: 'object',
            properties: {
              noteId: {
                type: 'string',
                description: 'The unique identifier of the note to retrieve report data for',
              },
            },
            required: ['noteId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              noteDate: { type: 'string', description: 'Formatted note date' },
              noteContent: { type: 'string', description: 'Note content' },
              noteAuthor: { type: 'string', description: 'Note author name' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'report_note_pdf',
          title: 'Generate Note PDF',
          description: 'Use this when the user wants to generate and download a PDF report for a specific note including images.',
          inputSchema: {
            type: 'object',
            properties: {
              noteId: {
                type: 'string',
                description: 'The unique identifier of the note to generate PDF for',
              },
            },
            required: ['noteId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether PDF was generated successfully' },
              size: { type: 'number', description: 'PDF file size in bytes' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // ============================================================================
        // Reports API - Export Generation
        // ============================================================================
        {
          name: 'export_generate',
          title: 'Generate Timesheet Export',
          description: 'Use this when the user wants to export their timesheet data in Excel (xlsx), CSV, or PDF format. Returns a download URL for the export file.',
          inputSchema: {
            type: 'object',
            properties: {
              report: {
                type: 'number',
                description: 'Report type identifier. Use export_report_types to get available types.',
              },
              startDate: {
                type: 'string',
                description: 'Start date for the export period (YYYY-MM-DD format)',
              },
              endDate: {
                type: 'string',
                description: 'End date for the export period (YYYY-MM-DD format)',
              },
              format: {
                type: 'string',
                enum: ['xlsx', 'xlsx1904', 'csv', 'pdf'],
                description: 'Export file format. xlsx=Excel, xlsx1904=Excel 1904 date system, csv=comma-separated, pdf=PDF document',
              },
              teamIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by team IDs',
              },
              projectIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by project IDs',
              },
              userIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by user IDs',
              },
              tagIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tag IDs',
              },
              type: {
                type: 'string',
                enum: ['all', 'task', 'mileage', 'call'],
                description: 'Task type filter',
              },
              filter: {
                type: 'string',
                enum: ['all', 'billable', 'notBillable', 'paid', 'unpaid', 'billed', 'outstanding'],
                description: 'Status filter for billing/payment',
              },
              splitTask: {
                type: 'boolean',
                description: 'Whether to split multi-day tasks into separate rows',
              },
              summarize: {
                type: 'boolean',
                description: 'Whether to summarize data instead of showing individual entries',
              },
              filename: {
                type: 'string',
                description: 'Custom filename for the export',
              },
            },
            required: ['report', 'startDate', 'endDate'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Download URL for the export file' },
              filename: { type: 'string', description: 'Export filename' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'export_send',
          title: 'Send Export via Email',
          description: 'Use this when the user wants to generate and send a timesheet export directly to an email address.',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Email address to send the export to',
              },
              report: {
                type: 'number',
                description: 'Report type identifier',
              },
              startDate: {
                type: 'string',
                description: 'Start date for the export period (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                description: 'End date for the export period (YYYY-MM-DD)',
              },
              format: {
                type: 'string',
                enum: ['xlsx', 'xlsx1904', 'csv', 'pdf'],
                description: 'Export file format',
              },
              teamIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by team IDs',
              },
              projectIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by project IDs',
              },
              filename: {
                type: 'string',
                description: 'Custom filename for the export',
              },
            },
            required: ['email', 'report', 'startDate', 'endDate'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether email was sent successfully' },
              email: { type: 'string', description: 'Email address the export was sent to' },
            },
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'export_from_template',
          title: 'Export from Template',
          description: 'Use this when the user wants to generate an export using a previously saved template with specific date range.',
          inputSchema: {
            type: 'object',
            properties: {
              templateId: {
                type: 'string',
                description: 'The template ID to use. Use export_template_list to find available templates.',
              },
              startDate: {
                type: 'string',
                description: 'Start date for the export period (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                description: 'End date for the export period (YYYY-MM-DD)',
              },
            },
            required: ['templateId', 'startDate', 'endDate'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether export was generated successfully' },
              size: { type: 'number', description: 'File size in bytes' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // ============================================================================
        // Reports API - Export Configuration
        // ============================================================================
        {
          name: 'export_fields',
          title: 'Get Export Fields',
          description: 'Use this when the user wants to see what fields/columns are available for customizing exports.',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                enum: ['all', 'project', 'team'],
                description: 'Scope filter for fields',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    fieldId: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string' },
                  },
                },
              },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'export_report_types',
          title: 'Get Export Report Types',
          description: 'Use this when the user wants to see what report types are available for export (e.g., detailed, summary, by project).',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          outputSchema: {
            type: 'object',
            properties: {
              reports: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number', description: 'Report type ID to use with export_generate' },
                    name: { type: 'string', description: 'Report name' },
                    description: { type: 'string', description: 'Report description' },
                  },
                },
              },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },

        // ============================================================================
        // Reports API - Export Templates
        // ============================================================================
        {
          name: 'export_template_list',
          title: 'List Export Templates',
          description: 'Use this when the user wants to see their saved export templates for quick recurring exports.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of templates to return',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (1-based)',
              },
              search: {
                type: 'string',
                description: 'Search templates by name',
              },
              sort: {
                type: 'string',
                enum: ['alpha', 'name', 'created', 'lastUpdate'],
                description: 'Sort field',
              },
              order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort order',
              },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              templates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Template ID' },
                    name: { type: 'string', description: 'Template name' },
                    format: { type: 'string', description: 'Export format' },
                  },
                },
              },
              totalCount: { type: 'number', description: 'Total number of templates' },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('ExportWidget'),
        },
        {
          name: 'export_template_get',
          title: 'Get Export Template',
          description: 'Use this when the user wants to view details of a specific export template.',
          inputSchema: {
            type: 'object',
            properties: {
              templateId: {
                type: 'string',
                description: 'The template ID to retrieve',
              },
            },
            required: ['templateId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              report: { type: 'number' },
              format: { type: 'string' },
              teamIds: { type: 'array', items: { type: 'string' } },
              projectIds: { type: 'array', items: { type: 'string' } },
            },
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'export_template_create',
          title: 'Create Export Template',
          description: 'Use this when the user wants to save their export configuration as a reusable template.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Template name',
              },
              report: {
                type: 'number',
                description: 'Report type identifier',
              },
              format: {
                type: 'string',
                enum: ['xlsx', 'xlsx1904', 'csv', 'pdf'],
                description: 'Export format',
              },
              teamIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Team IDs filter',
              },
              projectIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Project IDs filter',
              },
              userIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'User IDs filter',
              },
              type: {
                type: 'string',
                enum: ['all', 'task', 'mileage', 'call'],
                description: 'Task type filter',
              },
              filter: {
                type: 'string',
                enum: ['all', 'billable', 'notBillable', 'paid', 'unpaid', 'billed', 'outstanding'],
                description: 'Status filter',
              },
              splitTask: {
                type: 'boolean',
                description: 'Split multi-day tasks',
              },
              summarize: {
                type: 'boolean',
                description: 'Summarize data',
              },
              email: {
                type: 'string',
                description: 'Default email for sending exports',
              },
              filename: {
                type: 'string',
                description: 'Default filename',
              },
            },
            required: ['name'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Created template ID' },
              name: { type: 'string', description: 'Template name' },
            },
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'export_template_update',
          title: 'Update Export Template',
          description: 'Use this when the user wants to modify an existing export template.',
          inputSchema: {
            type: 'object',
            properties: {
              templateId: {
                type: 'string',
                description: 'Template ID to update',
              },
              name: {
                type: 'string',
                description: 'Updated template name',
              },
              report: {
                type: 'number',
                description: 'Updated report type',
              },
              format: {
                type: 'string',
                enum: ['xlsx', 'xlsx1904', 'csv', 'pdf'],
                description: 'Updated export format',
              },
              teamIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Updated team IDs filter',
              },
              projectIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Updated project IDs filter',
              },
            },
            required: ['templateId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
        },
        {
          name: 'export_template_delete',
          title: 'Delete Export Template',
          description: 'Use this when the user wants to delete an export template. This cannot be undone.',
          inputSchema: {
            type: 'object',
            properties: {
              templateId: {
                type: 'string',
                description: 'Template ID to delete',
              },
            },
            required: ['templateId'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether deletion was successful' },
              deletedId: { type: 'string', description: 'Deleted template ID' },
            },
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: true,
          },
        },

        // Statistics
        {
          name: 'statistics_get',
          title: 'Get Statistics',
          description: 'Use this when the user wants to see time tracking statistics, summaries, or reports for a date range. Returns aggregated totals, project breakdowns, and daily/weekly hour charts.',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                format: 'date',
                description: 'Start date for the statistics period (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                format: 'date',
                description: 'End date for the statistics period (YYYY-MM-DD)',
              },
              projectId: {
                type: 'string',
                description: 'Filter statistics for a specific project',
              },
              projectIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter statistics for multiple projects',
              },
              teamId: {
                type: 'string',
                description: 'Filter statistics for a specific team',
              },
              teamIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter statistics for multiple teams',
              },
              tagIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter statistics by tag IDs',
              },
              userIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter statistics by user IDs',
              },
              filter: {
                type: 'string',
                enum: ['all', 'billable', 'notBillable', 'paid', 'unpaid', 'billed', 'outstanding'],
                description: 'Filter by billing/payment status',
              },
            },
            required: ['startDate', 'endDate'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              totalHours: { type: 'number', description: 'Total hours tracked' },
              billableHours: { type: 'number', description: 'Billable hours' },
              nonBillableHours: { type: 'number', description: 'Non-billable hours' },
              totalTasks: { type: 'number', description: 'Total number of tasks' },
              totalBreakHours: { type: 'number', description: 'Total break hours' },
              startDate: { type: 'string', description: 'Period start date' },
              endDate: { type: 'string', description: 'Period end date' },
            },
            required: ['totalHours', 'billableHours', 'startDate', 'endDate'],
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
          },
          _meta: getComponentMetadataForTool('Statistics'),
        },
      ];

        console.error(`[MCP] Returning ${tools.length} tools`);
        return { tools };
      } catch (error) {
        console.error('[MCP] Error in ListTools handler:', error);
        throw error;
      }
    });

    // Register widget HTML resources with MCP Apps MIME type
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      console.error('[MCP] ListResources request received');

      const components = ['TimerWidget', 'ProjectList', 'ProjectCard', 'TaskList', 'TaskCard', 'Statistics', 'ExportWidget'];
      const resources = components.map(name => ({
        uri: getComponentResourceUri(name),
        mimeType: RESOURCE_MIME_TYPE,
        name: `${name} Component`,
        description: `Interactive ${name} widget`,
        _meta: {
          ui: {
            csp: { connectDomains: [], resourceDomains: [] },
            prefersBorder: false,
          },
        },
      }));

      console.error(`[MCP] Returning ${resources.length} resources`);
      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      console.error(`[MCP] ReadResource request for: ${uri}`);

      // Extract component name from ui://timesheet/ComponentName.html
      const match = uri.match(/^ui:\/\/timesheet\/(.+)\.html$/);
      if (!match) {
        throw new McpError(ErrorCode.InvalidRequest, `Invalid widget URI: ${uri}`);
      }

      const componentName = match[1];
      const validComponents = ['TimerWidget', 'ProjectList', 'ProjectCard', 'TaskList', 'TaskCard', 'Statistics', 'ExportWidget'];

      if (!validComponents.includes(componentName)) {
        throw new McpError(ErrorCode.InvalidRequest, `Unknown component: ${componentName}`);
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
        const staticDescription = getStaticWidgetDescription(componentName);

        console.error(`[MCP] Serving ${componentName} (${htmlContent.length} bytes)`);
        console.error(`[MCP] Static widget description: ${staticDescription}`);

        return {
          contents: [
            {
              uri,
              mimeType: RESOURCE_MIME_TYPE,
              text: htmlContent,
              _meta: {
                ui: {
                  csp: { connectDomains: [], resourceDomains: [] },
                  prefersBorder: false,
                },
              },
            },
          ],
        };
      } catch (error) {
        console.error(`[MCP] Error reading ${htmlPath}:`, error);
        throw new McpError(ErrorCode.InternalError, `Failed to read component: ${error}`);
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
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
            return this.handleAuthConfigure(args);

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
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
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
      return formatTimerResponse(timerData, userData.profile, userData.settings);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerStop(args: any) {
    const client = this.getClient();
    const { endDateTime } = args;

    try {
      const [timer, userData] = await Promise.all([
        client.timer.stop(endDateTime ? { endDateTime } : undefined),
        this.getProfileAndSettings(),
      ]);
      const timerData = this.formatCompleteTimerData(timer);
      return formatTimerResponse(timerData, userData.profile, userData.settings);
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
      return formatTimerResponse(timerData, userData.profile, userData.settings);
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
      return formatTimerResponse(timerData, userData.profile, userData.settings);
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
  private formatCompleteTimerData(timer: any) {
    const duration = timer.task?.duration || 0;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);

    return {
      status: timer.status,
      duration: duration,
      hours: hours,
      minutes: minutes,
      task: timer.task ? {
        id: timer.task.id,
        startDateTime: timer.task.startDateTime,
        endDateTime: timer.task.endDateTime,
        description: timer.task.description,
        duration: timer.task.duration,
        durationBreak: timer.task.durationBreak,
        typeId: timer.task.typeId,
        location: timer.task.location,
        locationEnd: timer.task.locationEnd,
        distance: timer.task.distance,
        phoneNumber: timer.task.phoneNumber,
        billable: timer.task.billable,
        project: timer.task.project,
      } : undefined,
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
      return formatTimerResponse(timerData, userData.profile, userData.settings);
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
      return formatTimerResponse(timerData, userData.profile, userData.settings);
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

      const note = await client.notes.create({
        taskId: timer.task.id,
        text,
        dateTime,
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
    const { description, amount, dateTime } = args;

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

      const expense = await client.expenses.create({
        taskId: timer.task.id,
        description,
        amount,
        dateTime,
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

      const pause = await client.pauses.create({
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
      const page = await client.teams.list(args);
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
      // Enable statistics to get duration data
      // All filter params (teamId, teamIds, projectIds, search, status, taskStartDate, etc.)
      // are passed through via the spread operator
      const [page, userData] = await Promise.all([
        client.projects.list({ ...args, statistics: true }),
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
      // endDate, populate flags, performance, etc.) are passed through directly
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
      return formatTaskListResponse(taskData, args, userData.profile, userData.settings);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTaskCreate(args: any) {
    const client = this.getClient();

    try {
      const task = await client.tasks.create(args);
      return {
        content: [
          {
            type: 'text',
            text: `Task created (ID: ${task.id})`,
          },
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
        structuredContent: {
          id: task.id,
          duration: task.duration || 0,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTaskUpdate(args: any) {
    const client = this.getClient();
    const { id, ...updateData } = args;

    try {
      const task = await client.tasks.update(id, updateData);
      return {
        content: [
          {
            type: 'text',
            text: `Task updated successfully`,
          },
        ],
        structuredContent: {
          success: true,
          id: task.id,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
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
      const size = pdfData.byteLength;

      return {
        content: [
          {
            type: 'text',
            text: `PDF generated successfully for document ${documentId} (${size} bytes). Use the Timesheet app or API to download.`,
          },
        ],
        structuredContent: {
          success: true,
          documentId,
          size,
          message: 'PDF generated. Download available via Timesheet app.',
        },
      };
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
      const size = pdfData.byteLength;

      return {
        content: [
          {
            type: 'text',
            text: `PDF generated successfully for task ${taskId} (${size} bytes)`,
          },
        ],
        structuredContent: {
          success: true,
          taskId,
          size,
        },
      };
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
      const size = pdfData.byteLength;

      return {
        content: [
          {
            type: 'text',
            text: `PDF generated successfully for expense ${expenseId} (${size} bytes)`,
          },
        ],
        structuredContent: {
          success: true,
          expenseId,
          size,
        },
      };
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
      const size = pdfData.byteLength;

      return {
        content: [
          {
            type: 'text',
            text: `PDF generated successfully for note ${noteId} (${size} bytes)`,
          },
        ],
        structuredContent: {
          success: true,
          noteId,
          size,
        },
      };
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
      const result = await client.reports.export.generate({
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
      });

      return {
        content: [
          {
            type: 'text',
            text: `Export generated successfully!\nDownload URL: ${result.url}\nFilename: ${result.filename || 'export'}`,
          },
        ],
        structuredContent: {
          url: result.url,
          filename: result.filename,
          contentType: result.contentType,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleExportSend(args: any) {
    const client = this.getClient();
    const { email, report, startDate, endDate, format, teamIds, projectIds, filename } = args;

    try {
      await client.reports.export.send({
        email,
        report,
        startDate,
        endDate,
        format,
        teamIds,
        projectIds,
        filename,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Export sent successfully to ${email}`,
          },
        ],
        structuredContent: {
          success: true,
          email,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleExportFromTemplate(args: any) {
    const client = this.getClient();
    const { templateId, startDate, endDate } = args;

    try {
      const pdfData = await client.reports.export.generateFromTemplate({
        templateId,
        startDate,
        endDate,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Export generated from template ${templateId} (${pdfData.byteLength} bytes)`,
          },
        ],
        structuredContent: {
          success: true,
          templateId,
          size: pdfData.byteLength,
        },
      };
    } catch (error) {
      return this.handleApiError(error);
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

      const reportList = result.reports
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
    const client = this.getClient();
    const { startDate, endDate, projectId, projectIds, teamId, teamIds, tagIds, userIds, filter } = args;

    try {
      // Fetch tasks with pagination (up to 5 pages / 500 tasks)
      const allTasks: any[] = [];
      const limit = 100;
      const maxPages = 5;

      for (let page = 1; page <= maxPages; page++) {
        const searchParams: any = {
          startDate,
          endDate,
          limit,
          page,
          populateTags: false,
        };
        if (projectId) searchParams.projectId = projectId;
        if (projectIds) searchParams.projectIds = projectIds;
        if (teamId) searchParams.teamId = teamId;
        if (teamIds) searchParams.teamIds = teamIds;
        if (tagIds) searchParams.tagIds = tagIds;
        if (userIds) searchParams.userIds = userIds;
        if (filter) searchParams.filter = filter;

        const result = await client.tasks.search(searchParams);
        const items = result.items;
        allTasks.push(...items);

        // Stop if we got fewer than limit (last page)
        if (items.length < limit) break;
      }

      const [stats, userData] = await Promise.all([
        Promise.resolve(this.computeStatistics(allTasks, startDate, endDate)),
        this.getProfileAndSettings(),
      ]);

      return formatStatisticsResponse(stats, userData.profile, userData.settings);
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private computeStatistics(tasks: any[], startDate: string, endDate: string) {
    let totalSeconds = 0;
    let billableSeconds = 0;
    let nonBillableSeconds = 0;
    let breakSeconds = 0;

    // Project aggregation map: projectId -> { title, color, totalSec, billableSec, nonBillableSec, count }
    const projectMap = new Map<string, {
      title: string;
      color?: number;
      totalSec: number;
      billableSec: number;
      nonBillableSec: number;
      count: number;
    }>();

    // Daily aggregation map: YYYY-MM-DD -> { totalSec, billableSec, nonBillableSec, breakSec }
    const dailyMap = new Map<string, {
      totalSec: number;
      billableSec: number;
      nonBillableSec: number;
      breakSec: number;
    }>();

    for (const task of tasks) {
      const duration = task.duration || 0;
      const durationBreak = task.durationBreak || 0;

      totalSeconds += duration;
      breakSeconds += durationBreak;

      if (task.billable) {
        billableSeconds += duration;
      } else {
        nonBillableSeconds += duration;
      }

      // Project aggregation
      const projId = task.project?.id || task.projectId || 'unknown';
      const projTitle = task.project?.title || 'Unknown Project';
      const projColor = task.project?.color;
      const existing = projectMap.get(projId);
      if (existing) {
        existing.totalSec += duration;
        existing.count += 1;
        if (task.billable) {
          existing.billableSec += duration;
        } else {
          existing.nonBillableSec += duration;
        }
      } else {
        projectMap.set(projId, {
          title: projTitle,
          color: projColor,
          totalSec: duration,
          billableSec: task.billable ? duration : 0,
          nonBillableSec: task.billable ? 0 : duration,
          count: 1,
        });
      }

      // Daily aggregation - use task start date
      if (task.startDateTime) {
        const dateKey = task.startDateTime.substring(0, 10); // YYYY-MM-DD
        const dayEntry = dailyMap.get(dateKey);
        if (dayEntry) {
          dayEntry.totalSec += duration;
          dayEntry.breakSec += durationBreak;
          if (task.billable) {
            dayEntry.billableSec += duration;
          } else {
            dayEntry.nonBillableSec += duration;
          }
        } else {
          dailyMap.set(dateKey, {
            totalSec: duration,
            billableSec: task.billable ? duration : 0,
            nonBillableSec: task.billable ? 0 : duration,
            breakSec: durationBreak,
          });
        }
      }
    }

    // Fill zero-days within the range
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const current = new Date(start);
    while (current <= end) {
      const key = current.toISOString().substring(0, 10);
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { totalSec: 0, billableSec: 0, nonBillableSec: 0, breakSec: 0 });
      }
      current.setDate(current.getDate() + 1);
    }

    // Sort daily entries
    const sortedDays = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    const dailyHours = sortedDays.map(([date, d]) => ({
      date,
      hours: Number((d.totalSec / 3600).toFixed(2)),
      billableHours: Number((d.billableSec / 3600).toFixed(2)),
      nonBillableHours: Number((d.nonBillableSec / 3600).toFixed(2)),
      breakHours: Number((d.breakSec / 3600).toFixed(2)),
    }));

    // Weekly aggregation (when range > 14 days)
    const rangeDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    let weeklyHours: Array<{
      weekStart: string;
      hours: number;
      billableHours: number;
      nonBillableHours: number;
      breakHours: number;
    }> | undefined;

    if (rangeDays > 14) {
      const weekMap = new Map<string, {
        totalSec: number;
        billableSec: number;
        nonBillableSec: number;
        breakSec: number;
      }>();

      for (const [dateStr, d] of sortedDays) {
        // Get ISO week Monday
        const date = new Date(dateStr + 'T00:00:00');
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        const monday = new Date(date);
        monday.setDate(diff);
        const weekKey = monday.toISOString().substring(0, 10);

        const w = weekMap.get(weekKey);
        if (w) {
          w.totalSec += d.totalSec;
          w.billableSec += d.billableSec;
          w.nonBillableSec += d.nonBillableSec;
          w.breakSec += d.breakSec;
        } else {
          weekMap.set(weekKey, { ...d });
        }
      }

      weeklyHours = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, w]) => ({
          weekStart,
          hours: Number((w.totalSec / 3600).toFixed(2)),
          billableHours: Number((w.billableSec / 3600).toFixed(2)),
          nonBillableHours: Number((w.nonBillableSec / 3600).toFixed(2)),
          breakHours: Number((w.breakSec / 3600).toFixed(2)),
        }));
    }

    // Project breakdown sorted by hours descending
    const totalHours = Number((totalSeconds / 3600).toFixed(2));
    const projectBreakdown = Array.from(projectMap.entries())
      .sort(([, a], [, b]) => b.totalSec - a.totalSec)
      .map(([projectId, p]) => {
        const hours = Number((p.totalSec / 3600).toFixed(2));
        return {
          projectId,
          projectTitle: p.title,
          projectColor: p.color,
          hours,
          billableHours: Number((p.billableSec / 3600).toFixed(2)),
          nonBillableHours: Number((p.nonBillableSec / 3600).toFixed(2)),
          taskCount: p.count,
          percentage: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0,
        };
      });

    return {
      totalHours,
      billableHours: Number((billableSeconds / 3600).toFixed(2)),
      nonBillableHours: Number((nonBillableSeconds / 3600).toFixed(2)),
      totalTasks: tasks.length,
      totalBreakHours: Number((breakSeconds / 3600).toFixed(2)),
      startDate,
      endDate,
      projectBreakdown,
      dailyHours,
      weeklyHours,
    };
  }

  private handleApiError(error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    const statusCode = error.response?.status;
    
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
  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Timesheet MCP server running on stdio (Claude Desktop mode)');
    console.error('Initial environment check:', {
      TIMESHEET_API_TOKEN: process.env.TIMESHEET_API_TOKEN ? 'Set' : 'Not set',
      TIMESHEET_API_URL: process.env.TIMESHEET_API_URL || 'Not set'
    });
  }
}

// Only run stdio server if executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new TimesheetMCPServer();
  server.runStdio().catch(console.error);
}
