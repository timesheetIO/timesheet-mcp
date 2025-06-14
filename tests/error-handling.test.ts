import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('Error Handling', () => {
  let TimesheetMCPServer: any;
  let server: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock dependencies
    jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
      Server: jest.fn().mockImplementation(() => ({
        setRequestHandler: jest.fn(),
        connect: jest.fn(),
      })),
    }));
    
    jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
      StdioServerTransport: jest.fn(),
    }));
    
    jest.mock('@timesheet/sdk', () => ({
      TimesheetClient: jest.fn().mockImplementation(() => ({
        timer: {
          start: jest.fn().mockRejectedValue(new Error('API Error')),
          get: jest.fn().mockRejectedValue({ 
            response: { 
              status: 401, 
              data: { message: 'Unauthorized' } 
            } 
          }),
        },
      })),
    }));

    const module = await import('../src/index.js');
    TimesheetMCPServer = module.TimesheetMCPServer;
    server = new TimesheetMCPServer();
  });

  test('handles API errors with status code', async () => {
    const error = {
      response: {
        status: 401,
        data: { message: 'Invalid API token' }
      }
    };

    const result = (server as any).handleApiError(error);

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'API Error (401): Invalid API token',
        },
      ],
      isError: true,
    });
  });

  test('handles API errors without status code', async () => {
    const error = {
      message: 'Network error'
    };

    const result = (server as any).handleApiError(error);

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'API Error: Network error',
        },
      ],
      isError: true,
    });
  });

  test('handles unknown errors', async () => {
    const error = {};

    const result = (server as any).handleApiError(error);

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'API Error: Unknown error',
        },
      ],
      isError: true,
    });
  });

  test('handles timer operations when no timer is running', async () => {
    const mockClient = {
      timer: {
        get: jest.fn().mockResolvedValue({
          status: 'stopped',
          task: null,
        }),
      },
      notes: {
        create: jest.fn(),
      },
    };

    (server as any).client = mockClient;

    const result = await (server as any).handleAddNote({ text: 'Test note' });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'No running timer found. Please start a timer first.',
        },
      ],
      isError: true,
    });

    expect(mockClient.notes.create).not.toHaveBeenCalled();
  });
});