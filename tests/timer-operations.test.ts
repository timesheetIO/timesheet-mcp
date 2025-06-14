import { describe, expect, test, jest, beforeEach } from '@jest/globals';

describe('Timer Operations', () => {
  let TimesheetMCPServer: any;
  let server: any;
  let mockTimerResource: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Mock timer resource methods
    mockTimerResource = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    };

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
        timer: mockTimerResource,
      })),
    }));

    const module = await import('../src/index.js');
    TimesheetMCPServer = module.TimesheetMCPServer;
    server = new TimesheetMCPServer();
  });

  test('starts timer with project ID', async () => {
    const mockTimer = {
      status: 'running',
      task: {
        id: 'task-123',
        project: { title: 'Test Project' },
      },
    };
    
    mockTimerResource.start.mockResolvedValue(mockTimer);

    const result = await (server as any).handleTimerStart({ 
      projectId: 'project-123' 
    });

    expect(mockTimerResource.start).toHaveBeenCalledWith({ 
      projectId: 'project-123' 
    });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Timer started for project Test Project. Status: running',
        },
      ],
    });
  });

  test('starts timer with custom start time', async () => {
    const startDateTime = '2025-01-14T10:00:00Z';
    const mockTimer = {
      status: 'running',
      task: {
        id: 'task-123',
        project: { title: 'Test Project' },
      },
    };
    
    mockTimerResource.start.mockResolvedValue(mockTimer);

    await (server as any).handleTimerStart({ 
      projectId: 'project-123',
      startDateTime 
    });

    expect(mockTimerResource.start).toHaveBeenCalledWith({ 
      projectId: 'project-123',
      startDateTime 
    });
  });

  test('stops timer and shows duration', async () => {
    const mockTimer = {
      status: 'stopped',
      task: {
        duration: 7923, // 2h 12m 3s
      },
    };
    
    mockTimerResource.stop.mockResolvedValue(mockTimer);

    const result = await (server as any).handleTimerStop({});

    expect(mockTimerResource.stop).toHaveBeenCalledWith(undefined);

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Timer stopped. Total time: 2h 12m',
        },
      ],
    });
  });

  test('pauses timer', async () => {
    const mockTimer = {
      status: 'paused',
    };
    
    mockTimerResource.pause.mockResolvedValue(mockTimer);

    const result = await (server as any).handleTimerPause({});

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Timer paused. Status: paused',
        },
      ],
    });
  });

  test('resumes timer', async () => {
    const mockTimer = {
      status: 'running',
    };
    
    mockTimerResource.resume.mockResolvedValue(mockTimer);

    const result = await (server as any).handleTimerResume({});

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Timer resumed. Status: running',
        },
      ],
    });
  });

  test('gets timer status with running task', async () => {
    const mockTimer = {
      status: 'running',
      task: {
        project: { title: 'Test Project' },
        description: 'Working on feature X',
        duration: 3665, // 1h 1m 5s
      },
    };
    
    mockTimerResource.get.mockResolvedValue(mockTimer);

    const result = await (server as any).handleTimerStatus();

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Timer status: running\nProject: Test Project\nDescription: Working on feature X\nCurrent duration: 1h 1m',
        },
      ],
    });
  });

  test('gets timer status when stopped', async () => {
    const mockTimer = {
      status: 'stopped',
    };
    
    mockTimerResource.get.mockResolvedValue(mockTimer);

    const result = await (server as any).handleTimerStatus();

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Timer status: stopped',
        },
      ],
    });
  });

  test('updates timer task details', async () => {
    const updateData = {
      description: 'Updated task description',
      billable: true,
      feeling: 4,
    };
    
    const mockTimer = {
      status: 'running',
      task: { id: 'task-123' },
    };
    
    mockTimerResource.update.mockResolvedValue(mockTimer);

    const result = await (server as any).handleTimerUpdate(updateData);

    expect(mockTimerResource.update).toHaveBeenCalledWith(updateData);

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'Timer task updated successfully',
        },
      ],
    });
  });
});