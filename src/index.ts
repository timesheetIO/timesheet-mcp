#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { TimesheetClient, TimesheetClientOptions } from '@timesheet/sdk';
import dotenv from 'dotenv';

dotenv.config();

export class TimesheetMCPServer {
  private server: Server;
  private client: TimesheetClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'timesheet-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private getClient(): TimesheetClient {
    if (!this.client) {
      const options: TimesheetClientOptions = {};

      if (process.env.TIMESHEET_API_TOKEN) {
        options.apiKey = process.env.TIMESHEET_API_TOKEN;
      }

      if (process.env.TIMESHEET_API_URL) {
        options.baseUrl = process.env.TIMESHEET_API_URL;
      }

      this.client = new TimesheetClient(options);
    }
    return this.client;
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Timer Management Tools
        {
          name: 'timer_start',
          description: 'Start the timer for a project. Use natural language like "Start timer for ProjectX" or "Start timer for ProjectX 10 minutes ago"',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID to start timer for',
              },
              startDateTime: {
                type: 'string',
                description: 'Optional start time in ISO 8601 format (defaults to now)',
              },
            },
            required: ['projectId'],
          },
          annotations: {
            openWorldHint: true,
          },
        },
        {
          name: 'timer_stop',
          description: 'Stop the currently running timer. Use phrases like "Stop timer" or "Stop working"',
          inputSchema: {
            type: 'object',
            properties: {
              endDateTime: {
                type: 'string',
                description: 'Optional end time in ISO 8601 format (defaults to now)',
              },
            },
          },
        },
        {
          name: 'timer_pause',
          description: 'Pause the timer (start a break). Use phrases like "I have a break" or "Pause timer"',
          inputSchema: {
            type: 'object',
            properties: {
              startDateTime: {
                type: 'string',
                description: 'Optional pause start time in ISO 8601 format (defaults to now)',
              },
            },
          },
        },
        {
          name: 'timer_resume',
          description: 'Resume the timer after a break. Use phrases like "Resume work" or "Back from break"',
          inputSchema: {
            type: 'object',
            properties: {
              endDateTime: {
                type: 'string',
                description: 'Optional pause end time in ISO 8601 format (defaults to now)',
              },
            },
          },
        },
        {
          name: 'timer_status',
          description: 'Get current timer status - check if timer is running, paused, or stopped',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'timer_update',
          description: 'Update the currently running timer task (description, tags, location, etc.)',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Task description',
              },
              location: {
                type: 'string',
                description: 'Start location',
              },
              locationEnd: {
                type: 'string',
                description: 'End location',
              },
              feeling: {
                type: 'number',
                description: 'Mood/satisfaction rating (1-5)',
              },
              billable: {
                type: 'boolean',
                description: 'Whether the task is billable',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags to add to the task',
              },
            },
          },
        },

        // Task Item Management
        {
          name: 'task_add_note',
          description: 'Add a note to the current running task',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Note content',
              },
              dateTime: {
                type: 'string',
                description: 'Optional timestamp for the note (defaults to now)',
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'task_add_expense',
          description: 'Add an expense to the current running task',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Expense description',
              },
              amount: {
                type: 'number',
                description: 'Expense amount',
              },
              dateTime: {
                type: 'string',
                description: 'Optional timestamp for the expense (defaults to now)',
              },
            },
            required: ['description', 'amount'],
          },
        },
        {
          name: 'task_add_pause',
          description: 'Add a manual pause/break to the current running task',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Pause description (e.g., "Lunch break")',
              },
              startDateTime: {
                type: 'string',
                description: 'Pause start time in ISO 8601 format',
              },
              endDateTime: {
                type: 'string',
                description: 'Pause end time in ISO 8601 format',
              },
            },
            required: ['startDateTime', 'endDateTime'],
          },
        },

        // Project Management
        {
          name: 'project_list',
          description: 'List all projects or search for specific projects',
          inputSchema: {
            type: 'object',
            properties: {
              teamId: {
                type: 'string',
                description: 'Filter by team ID',
              },
              search: {
                type: 'string',
                description: 'Search query for project title',
              },
              status: {
                type: 'string',
                enum: ['all', 'active', 'inactive'],
                description: 'Filter by project status',
              },
            },
          },
        },
        {
          name: 'project_create',
          description: 'Create a new project',
          inputSchema: {
            type: 'object',
            properties: {
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
                description: 'Project color code',
              },
              teamId: {
                type: 'string',
                description: 'Team ID for the project',
              },
              taskDefaultBillable: {
                type: 'boolean',
                description: 'Default billable status for tasks',
              },
            },
            required: ['title'],
          },
        },
        {
          name: 'project_update',
          description: 'Update an existing project',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Project ID',
              },
              title: {
                type: 'string',
                description: 'Updated project title',
              },
              description: {
                type: 'string',
                description: 'Updated project description',
              },
              archived: {
                type: 'boolean',
                description: 'Archive/unarchive the project',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'project_delete',
          description: 'Delete a project',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Project ID to delete',
              },
            },
            required: ['id'],
          },
          annotations: {
            destructiveHint: true,
          },
        },

        // Task Management
        {
          name: 'task_list',
          description: 'List tasks with various filters',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Filter by project ID',
              },
              startDate: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                description: 'End date (YYYY-MM-DD)',
              },
              running: {
                type: 'boolean',
                description: 'Filter only running tasks',
              },
            },
          },
        },
        {
          name: 'task_create',
          description: 'Create a new task',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'Project ID for the task',
              },
              startDateTime: {
                type: 'string',
                description: 'Start time in ISO 8601 format',
              },
              endDateTime: {
                type: 'string',
                description: 'End time in ISO 8601 format',
              },
              description: {
                type: 'string',
                description: 'Task description',
              },
              billable: {
                type: 'boolean',
                description: 'Whether the task is billable',
              },
            },
            required: ['projectId', 'startDateTime'],
          },
        },
        {
          name: 'task_update',
          description: 'Update an existing task',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Task ID',
              },
              description: {
                type: 'string',
                description: 'Updated description',
              },
              startDateTime: {
                type: 'string',
                description: 'Updated start time',
              },
              endDateTime: {
                type: 'string',
                description: 'Updated end time',
              },
              billable: {
                type: 'boolean',
                description: 'Updated billable status',
              },
              paid: {
                type: 'boolean',
                description: 'Mark as paid',
              },
              billed: {
                type: 'boolean',
                description: 'Mark as billed',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'task_delete',
          description: 'Delete a task',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Task ID to delete',
              },
            },
            required: ['id'],
          },
          annotations: {
            destructiveHint: true,
          },
        },

        // Authentication
        {
          name: 'auth_configure',
          description: 'Configure authentication for the Timesheet API',
          inputSchema: {
            type: 'object',
            properties: {
              apiKey: {
                type: 'string',
                description: 'API key for authentication',
              },
              baseUrl: {
                type: 'string',
                description: 'Optional custom API base URL',
              },
            },
            required: ['apiKey'],
          },
        },
      ],
    }));

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

          // Project operations
          case 'project_list':
            return this.handleProjectList(args);
          case 'project_create':
            return this.handleProjectCreate(args);
          case 'project_update':
            return this.handleProjectUpdate(args);
          case 'project_delete':
            return this.handleProjectDelete(args);

          // Task operations
          case 'task_list':
            return this.handleTaskList(args);
          case 'task_create':
            return this.handleTaskCreate(args);
          case 'task_update':
            return this.handleTaskUpdate(args);
          case 'task_delete':
            return this.handleTaskDelete(args);

          // Authentication
          case 'auth_configure':
            return this.handleAuthConfigure(args);

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
      const timer = await client.timer.start({ projectId, startDateTime });
      return {
        content: [
          {
            type: 'text',
            text: `Timer started for project ${timer.task?.project?.title || projectId}. Status: ${timer.status}`,
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerStop(args: any) {
    const client = this.getClient();
    const { endDateTime } = args;

    try {
      const timer = await client.timer.stop(endDateTime ? { endDateTime } : undefined);
      const duration = timer.task?.duration || 0;
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      
      return {
        content: [
          {
            type: 'text',
            text: `Timer stopped. Total time: ${hours}h ${minutes}m`,
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerPause(args: any) {
    const client = this.getClient();
    const { startDateTime } = args;

    try {
      const timer = await client.timer.pause(startDateTime ? { startDateTime } : undefined);
      return {
        content: [
          {
            type: 'text',
            text: `Timer paused. Status: ${timer.status}`,
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerResume(args: any) {
    const client = this.getClient();
    const { endDateTime } = args;

    try {
      const timer = await client.timer.resume(endDateTime ? { endDateTime } : undefined);
      return {
        content: [
          {
            type: 'text',
            text: `Timer resumed. Status: ${timer.status}`,
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerStatus() {
    const client = this.getClient();

    try {
      const timer = await client.timer.get();
      let message = `Timer status: ${timer.status}`;
      
      if (timer.task && timer.status !== 'stopped') {
        message += `\nProject: ${timer.task.project?.title || 'Unknown'}`;
        if (timer.task.description) {
          message += `\nDescription: ${timer.task.description}`;
        }
        if (timer.task.duration) {
          const hours = Math.floor(timer.task.duration / 3600);
          const minutes = Math.floor((timer.task.duration % 3600) / 60);
          message += `\nCurrent duration: ${hours}h ${minutes}m`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private async handleTimerUpdate(args: any) {
    const client = this.getClient();

    try {
      const timer = await client.timer.update(args);
      return {
        content: [
          {
            type: 'text',
            text: `Timer task updated successfully`,
          },
        ],
      };
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

      return {
        content: [
          {
            type: 'text',
            text: `Pause added to current task`,
          },
        ],
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // Project handlers
  private async handleProjectList(args: any) {
    const client = this.getClient();

    try {
      const projects = await client.projects.list(args);
      const items: any[] = [];
      for await (const project of projects) {
        items.push(project);
      }
      
      const projectList = items.map((p: any) => 
        `- ${p.title} (ID: ${p.id})${p.archived ? ' [Archived]' : ''}`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Projects:\n${projectList}`,
          },
        ],
      };
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
        ],
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
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  // Task handlers
  private async handleTaskList(args: any) {
    const client = this.getClient();

    try {
      const tasks = await client.tasks.search(args);
      const items: any[] = [];
      for await (const task of tasks) {
        items.push(task);
      }
      
      const taskList = items.map((t: any) => {
        const duration = t.duration || 0;
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        return `- ${t.description || 'No description'} (${hours}h ${minutes}m) - ${t.project?.title || 'Unknown project'}`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Tasks:\n${taskList}`,
          },
        ],
      };
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
      const task = await client.tasks.update(id, updateData);
      return {
        content: [
          {
            type: 'text',
            text: `Task updated successfully`,
          },
        ],
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
      };
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Timesheet MCP server running on stdio');
  }
}

const server = new TimesheetMCPServer();
server.run().catch(console.error);
