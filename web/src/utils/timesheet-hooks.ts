/**
 * Typed hooks for Timesheet MCP tool calls
 * These wrap app.callServerTool() with proper TypeScript types
 *
 * IMPORTANT: These make authenticated API calls through the MCP server.
 * The OAuth token is kept secure on the server side - never exposed to the browser.
 *
 * Every operation rejects when the server answers with isError (see useCallTool), so callers
 * show an error instead of treating the failure as data.
 */

import {useCallback, useMemo} from 'react';
import {useCallTool} from '../hooks';
import type {Timer, Task, Project, Team} from '@timesheet/sdk';
import type {TimerTask} from './types';

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
  /** ISO 8601 with the user's offset, e.g. 2026-10-12T09:05:00+02:00 */
  startDateTime?: string;
  typeId?: number;
  location?: string;
  locationEnd?: string;
  distance?: number;
  phoneNumber?: string;
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

export interface TimerStopResponse {
  timer: TimerResponse;
  /** The entry the stop saved (UI-only _meta): the API clears the timer's task when it stops */
  stoppedTask?: TimerTask;
}

/** UI-only _meta key of timer_stop results */
export const STOPPED_TASK_META_KEY = 'timesheet/stoppedTask';

export function useTimerOperations() {
  const callTool = useCallTool();

  const getStatus = useCallback(async (): Promise<TimerResponse> => {
    const result = await callTool('timer_status', {});
    return result?.structuredContent;
  }, [callTool]);

  const start = useCallback(
    async (params: TimerStartParams): Promise<TimerResponse> => {
      const result = await callTool('timer_start', params);
      return result?.structuredContent;
    },
    [callTool]
  );

  const stop = useCallback(
    async (params?: TimerStopParams): Promise<TimerStopResponse> => {
      const result = await callTool('timer_stop', params || {});
      return {
        timer: result?.structuredContent,
        stoppedTask: result?._meta?.[STOPPED_TASK_META_KEY] ?? undefined,
      };
    },
    [callTool]
  );

  const pause = useCallback(
    async (params?: TimerPauseParams): Promise<TimerResponse> => {
      const result = await callTool('timer_pause', params || {});
      return result?.structuredContent;
    },
    [callTool]
  );

  const resume = useCallback(
    async (params?: TimerResumeParams): Promise<TimerResponse> => {
      const result = await callTool('timer_resume', params || {});
      return result?.structuredContent;
    },
    [callTool]
  );

  const update = useCallback(
    async (params: TimerUpdateParams): Promise<TimerResponse> => {
      const result = await callTool('timer_update', params);
      return result?.structuredContent;
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
      const result = await callTool('project_list', params || {});
      const structuredData = result?.structuredContent;
      const projects = structuredData?.projects || [];
      const totalCount = structuredData?.totalCount || projects.length;
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
  /** A decimal string, as the tool's schema and the API take it ("12.5") */
  amount: string;
  dateTime?: string;
  /** Already paid back to the user */
  refunded?: boolean;
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
      const result = await callTool('task_list', params || {});
      const structuredData = result?.structuredContent;
      const tasks = structuredData?.tasks || [];
      const totalCount = structuredData?.totalCount || tasks.length;
      return {
        tasks,
        totalCount,
      };
    },
    [callTool]
  );

  const addNote = useCallback(
    async (params: TaskAddNoteParams): Promise<void> => {
      await callTool('task_add_note', params);
    },
    [callTool]
  );

  const addExpense = useCallback(
    async (params: TaskAddExpenseParams): Promise<void> => {
      await callTool('task_add_expense', params);
    },
    [callTool]
  );

  const addPause = useCallback(
    async (params: TaskAddPauseParams): Promise<void> => {
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
      const result = await callTool('team_list', params || {});
      const structuredData = result?.structuredContent;
      const teams = structuredData?.teams || [];
      const totalCount = structuredData?.totalCount || teams.length;
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
