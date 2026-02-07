/**
 * Typed hooks for Timesheet MCP tool calls
 * These wrap app.callServerTool() with proper TypeScript types
 *
 * IMPORTANT: These make authenticated API calls through the MCP server.
 * The OAuth token is kept secure on the server side - never exposed to the browser.
 */

import {useCallback, useMemo} from 'react';
import {useCallTool} from '../hooks';
import type {Timer, Task, Project, Team} from '@timesheet/sdk';

/**
 * Timer Operations
 */

export interface TimerStartParams {
  projectId: string;
  startDateTime?: string;
}

export interface TimerStopParams {
  endDateTime?: string;
}

export interface TimerPauseParams {
  startDateTime?: string;
}

export interface TimerResumeParams {
  endDateTime?: string;
}

export interface TimerUpdateParams {
  description?: string;
  tags?: string[];
  location?: string;
  locationEnd?: string;
  billable?: boolean;
  feeling?: number;
}

/**
 * Extended timer response that includes profile and settings from MCP server
 */
export interface TimerResponse extends Timer {
  profile?: any;
  settings?: any;
}

export function useTimerOperations() {
  const callTool = useCallTool();

  const getStatus = useCallback(async (): Promise<TimerResponse> => {
    console.log('[useTimerOperations] getStatus - calling timer_status');
    const result = await callTool('timer_status', {});
    console.log('[useTimerOperations] getStatus - result:', result);
    // Handle response structure from MCP tool - preserve full structuredContent including settings
    const data = result?.structuredContent || result?.timer || result;
    console.log('[useTimerOperations] getStatus - data:', data);
    return data;
  }, [callTool]);

  const start = useCallback(
    async (params: TimerStartParams): Promise<TimerResponse> => {
      console.log('[useTimerOperations] start - params:', params);
      const result = await callTool('timer_start', params);
      console.log('[useTimerOperations] start - result:', result);
      const data = result?.structuredContent || result?.timer || result;
      console.log('[useTimerOperations] start - data:', data);
      return data;
    },
    [callTool]
  );

  const stop = useCallback(
    async (params?: TimerStopParams): Promise<TimerResponse> => {
      console.log('[useTimerOperations] stop - params:', params);
      const result = await callTool('timer_stop', params || {});
      return result?.structuredContent || result?.timer || result;
    },
    [callTool]
  );

  const pause = useCallback(
    async (params?: TimerPauseParams): Promise<TimerResponse> => {
      console.log('[useTimerOperations] pause - params:', params);
      const result = await callTool('timer_pause', params || {});
      return result?.structuredContent || result?.timer || result;
    },
    [callTool]
  );

  const resume = useCallback(
    async (params?: TimerResumeParams): Promise<TimerResponse> => {
      console.log('[useTimerOperations] resume - params:', params);
      const result = await callTool('timer_resume', params || {});
      return result?.structuredContent || result?.timer || result;
    },
    [callTool]
  );

  const update = useCallback(
    async (params: TimerUpdateParams): Promise<TimerResponse> => {
      console.log('[useTimerOperations] update - params:', params);
      const result = await callTool('timer_update', params);
      return result?.structuredContent || result?.timer || result;
    },
    [callTool]
  );

  // Memoize the return object to prevent infinite loops
  return useMemo(
    () => ({
      getStatus,
      start,
      stop,
      pause,
      resume,
      update,
    }),
    [getStatus, start, stop, pause, resume, update]
  );
}

/**
 * Project Operations
 */

export interface ProjectListParams {
  limit?: number;
  page?: number;
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  sort?: 'alpha' | 'alphaNum' | 'client' | 'duration' | 'created' | 'status';
  order?: 'asc' | 'desc';
  teamId?: string;
  teamIds?: string[];
  projectIds?: string[];
}

export interface ProjectListResponse {
  projects: Project[];
  totalCount: number;
}

export function useProjectOperations() {
  const callTool = useCallTool();

  const list = useCallback(
    async (params?: ProjectListParams): Promise<ProjectListResponse> => {
      console.log('[useProjectOperations] list - params:', params);
      const result = await callTool('project_list', params || {});
      console.log('[useProjectOperations] list - result:', result);

      // Handle response structure from MCP tool
      const structuredData = result?.structuredContent || result;
      const projects = structuredData?.projects || [];
      const totalCount = structuredData?.totalCount || projects.length;

      console.log('[useProjectOperations] list - projects count:', projects.length);
      return {
        projects,
        totalCount,
      };
    },
    [callTool]
  );

  // Memoize the return object to prevent infinite loops
  return useMemo(
    () => ({
      list,
    }),
    [list]
  );
}

/**
 * Task Operations
 */

export interface TaskListParams {
  limit?: number;
  page?: number;
  sort?: 'dateTime' | 'time' | 'created';
  order?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
  running?: boolean;
  projectId?: string;
  projectIds?: string[];
  populateTags?: boolean;
}

export interface TaskListResponse {
  tasks: Task[];
  totalCount: number;
}

export interface TaskAddNoteParams {
  text: string;
  dateTime?: string;
}

export interface TaskAddExpenseParams {
  description: string;
  amount: number;
  dateTime?: string;
}

export interface TaskAddPauseParams {
  startDateTime: string;
  endDateTime: string;
  description?: string;
}

export function useTaskOperations() {
  const callTool = useCallTool();

  const list = useCallback(
    async (params?: TaskListParams): Promise<TaskListResponse> => {
      console.log('[useTaskOperations] list - params:', params);
      const result = await callTool('task_list', params || {});

      const structuredData = result?.structuredContent || result;
      const tasks = structuredData?.tasks || [];
      const totalCount = structuredData?.totalCount || tasks.length;

      console.log('[useTaskOperations] list - tasks count:', tasks.length);
      return {
        tasks,
        totalCount,
      };
    },
    [callTool]
  );

  const addNote = useCallback(
    async (params: TaskAddNoteParams): Promise<void> => {
      console.log('[useTaskOperations] addNote - params:', params);
      await callTool('task_add_note', params);
    },
    [callTool]
  );

  const addExpense = useCallback(
    async (params: TaskAddExpenseParams): Promise<void> => {
      console.log('[useTaskOperations] addExpense - params:', params);
      await callTool('task_add_expense', params);
    },
    [callTool]
  );

  const addPause = useCallback(
    async (params: TaskAddPauseParams): Promise<void> => {
      console.log('[useTaskOperations] addPause - params:', params);
      await callTool('task_add_pause', params);
    },
    [callTool]
  );

  // Memoize the return object to prevent infinite loops
  return useMemo(
    () => ({
      list,
      addNote,
      addExpense,
      addPause,
    }),
    [list, addNote, addExpense, addPause]
  );
}

/**
 * Team Operations
 */

export interface TeamListParams {
  search?: string;
  limit?: number;
  page?: number;
}

export interface TeamListResponse {
  teams: Team[];
  totalCount: number;
}

export function useTeamOperations() {
  const callTool = useCallTool();

  const list = useCallback(
    async (params?: TeamListParams): Promise<TeamListResponse> => {
      console.log('[useTeamOperations] list - params:', params);
      const result = await callTool('team_list', params || {});

      const structuredData = result?.structuredContent || result;
      const teams = structuredData?.teams || [];
      const totalCount = structuredData?.totalCount || teams.length;

      console.log('[useTeamOperations] list - teams count:', teams.length);
      return {
        teams,
        totalCount,
      };
    },
    [callTool]
  );

  // Memoize the return object to prevent infinite loops
  return useMemo(
    () => ({
      list,
    }),
    [list]
  );
}
