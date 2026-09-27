/**
 * Every tool the server offers, built once per process. Descriptor _meta (widget links, invocation
 * status text) is stamped from TOOL_WIDGET_LINKS in mcp-app-helpers.
 */
import type { Tool } from '@modelcontextprotocol/server';
import { applyToolUiMeta } from './mcp-app-helpers.js';
import { EXTENDED_TOOL_DEFINITIONS } from './extended-tools.js';

/**
 * What every timer tool returns (formatCompleteTimerData in index.ts): the timer, its running task
 * and its pause. Clients check structuredContent against this, so it describes the real shape.
 */
const TIMER_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['running', 'paused', 'stopped'],
      description: 'Current timer status',
    },
    duration: { type: 'number', description: 'Duration of the running task in seconds' },
    hours: { type: 'number', description: 'Hours component of duration' },
    minutes: { type: 'number', description: 'Minutes component of duration' },
    task: {
      type: 'object',
      description: 'The running task, with its project. Absent when no timer runs.',
    },
    pause: {
      type: 'object',
      description: 'The current break, while the timer is paused',
    },
  },
  required: ['status'],
} as const;

/**
 * The Claude directory lists a tool by annotations.title, which the tools below only give at the
 * top level: copy it into the annotations. The extended tools set both already.
 */
function withAnnotationTitles<T extends Record<string, unknown>>(tools: T[]): T[] {
  return tools.map((tool) => {
    const annotations = tool.annotations as Record<string, unknown> | undefined;
    return typeof tool.title === 'string' && !annotations?.title
      ? ({ ...tool, annotations: { ...annotations, title: tool.title } } as T)
      : tool;
  });
}

export const TOOL_DEFINITIONS: readonly Tool[] = applyToolUiMeta(withAnnotationTitles([
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
    outputSchema: TIMER_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
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
    outputSchema: TIMER_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
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
    outputSchema: TIMER_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
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
    outputSchema: TIMER_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  {
    name: 'timer_status',
    title: 'Get Timer Status',
    description: 'Use this when the user wants to check the current state of their timer, including whether it\'s running, paused, or stopped, and details about the active task.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: TIMER_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
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
        startDateTime: {
          type: 'string',
          format: 'date-time',
          description: 'New start time of the running task in ISO 8601 with offset (e.g., "2026-09-24T09:15:00+02:00")',
        },
        typeId: {
          type: 'number',
          description: 'Entry type: 0 for work time, 1 for a trip (mileage), 2 for a call',
        },
        distance: {
          type: 'number',
          description: 'Distance travelled, for a trip entry',
        },
        phoneNumber: {
          type: 'string',
          description: 'Phone number, for a call entry',
        },
      },
    },
    outputSchema: TIMER_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
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
          type: 'string',
          description: 'Expense amount as a decimal string in the user\'s default currency (e.g. "12.50"). The API stores amounts as BigDecimal strings.',
        },
        dateTime: {
          type: 'string',
          format: 'date-time',
          description: 'Optional timestamp for when the expense occurred in ISO 8601 format. If not provided, uses current time.',
        },
        refunded: {
          type: 'boolean',
          description: 'Whether the expense has already been refunded (paid back to the user)',
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
          type: 'string',
          description: 'The expense amount recorded (decimal string)',
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
      idempotentHint: true,
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
        totalCount: { type: 'number', description: 'Entries matching the criteria across all pages' },
      },
      required: ['tasks'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
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
        action: {
          type: 'string',
          enum: ['created'],
          description: 'What happened to the task (the rest of the object is the full task)',
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
        action: {
          type: 'string',
          enum: ['updated'],
          description: 'What happened to the task (the rest of the object is the full task)',
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
      idempotentHint: true,
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
    description: 'Use this when the user wants to generate and download a PDF version of a document/invoice. The PDF is attached to the result as a file (up to 5 MB).',
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
        fileName: { type: 'string', description: 'File name of the attached PDF' },
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
    description: 'Use this when the user wants to generate and download a PDF report for a specific task. The PDF is attached to the result as a file (up to 5 MB).',
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
        fileName: { type: 'string', description: 'File name of the attached PDF' },
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
    description: 'Use this when the user wants to generate and download a PDF report for a specific expense including receipt images. The PDF is attached to the result as a file (up to 5 MB).',
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
        fileName: { type: 'string', description: 'File name of the attached PDF' },
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
    description: 'Use this when the user wants to generate and download a PDF report for a specific note including images. The PDF is attached to the result as a file (up to 5 MB).',
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
        fileName: { type: 'string', description: 'File name of the attached PDF' },
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
          description: 'Whether to add a totals row at the end. Individual entries are still listed',
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
        url: { type: 'string', description: 'Signed download URL for the export file' },
      },
      required: ['url'],
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
    description: 'Use this when the user wants to generate and send a timesheet export directly to an email address, as an Excel, CSV, or PDF file.',
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
        templateId: { type: 'string', description: 'The template the export was generated from' },
        url: { type: 'string', description: 'Signed download URL for the export file' },
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
          enum: ['project', 'team', 'task', 'todo'],
          description: 'Scope filter for fields. Defaults to "task" on the server.',
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
          description: 'Add a totals row at the end (entries are still listed)',
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
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // Statistics
  {
    name: 'statistics_get',
    title: 'Get Statistics',
    description: 'Use this when the user wants to see time tracking statistics, summaries, or reports for a date range of up to one year (366 days). For a longer period, call it once per year. Returns aggregated totals, project breakdowns, and daily/weekly hour charts.',
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
        truncated: { type: 'boolean', description: 'True when not every entry of the range could be read (over 5,000), so the totals are too low' },
      },
      required: ['totalHours', 'billableHours', 'startDate', 'endDate'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  ...EXTENDED_TOOL_DEFINITIONS,
] as Array<{ name: string; _meta?: Record<string, unknown> } & Record<string, unknown>>)) as unknown as Tool[];

/** outputSchema per tool name, for projecting tools/call results through the protocol codec. */
export const TOOL_OUTPUT_SCHEMAS: ReadonlyMap<string, Tool['outputSchema']> = new Map(
  TOOL_DEFINITIONS.map((tool) => [tool.name, tool.outputSchema])
);
