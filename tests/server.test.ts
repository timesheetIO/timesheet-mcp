import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('@timesheet/sdk');
jest.mock('dotenv');

describe('TimesheetMCPServer', () => {
  let mockServer: jest.Mocked<Server>;
  let mockTransport: jest.Mocked<StdioServerTransport>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock server
    mockServer = {
      connect: jest.fn().mockResolvedValue(undefined),
      setRequestHandler: jest.fn(),
    } as any;
    
    mockTransport = {} as any;
    
    (Server as jest.MockedClass<typeof Server>).mockImplementation(() => mockServer);
    (StdioServerTransport as jest.MockedClass<typeof StdioServerTransport>).mockImplementation(() => mockTransport);
  });

  test('server initializes with correct configuration', async () => {
    const { TimesheetMCPServer } = await import('../src/index.js');
    const server = new TimesheetMCPServer();

    expect(Server).toHaveBeenCalledWith(
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
  });

  test('server sets up request handlers', async () => {
    const { TimesheetMCPServer } = await import('../src/index.js');
    const server = new TimesheetMCPServer();

    expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
  });

  test('server connects to stdio transport', async () => {
    const { TimesheetMCPServer } = await import('../src/index.js');
    const server = new TimesheetMCPServer();
    
    await server.run();

    expect(StdioServerTransport).toHaveBeenCalled();
    expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
  });
});