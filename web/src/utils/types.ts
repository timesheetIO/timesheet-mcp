/**
 * Extended types for the Enhanced Timer Widget
 */

import type {Profile, Project, Settings, Task, Timer, Tag, Rate} from '@timesheet/sdk';

export type {Profile, Project, Settings, Task, Timer, Tag, Rate};

/**
 * Extended Timer with full task and project details
 * Uses nested structure (task.project) from SDK
 */
export interface ExtendedTimer extends Omit<Timer, 'task' | 'pause'> {
  task?: Task & {
    project?: Project;
    tags?: Tag[];
    rate?: Rate;
  };
  pause?: {
    id?: string;
    startDateTime?: string;
    endDateTime?: string;
    description?: string;
  };
}

/**
 * Widget state for MCP context
 */
export interface WidgetState {
  profile: Profile | null;
  settings: Settings | null;
  timer: ExtendedTimer | null;
  projects: Project[];
  tags: Tag[];
  rates: Rate[];
  loading: boolean;
  error: string | null;
}

/**
 * Form values for task editing
 */
export interface TaskFormValues {
  project?: string;
  description?: string;
  startDate: string;
  startTime: string;
  typeId?: string;
  location?: string;
  locationEnd?: string;
  distance?: number;
  phoneNumber?: string;
  tagIds?: string[];
  rateId?: string;
}

/**
 * Form values for pause/break
 */
export interface PauseFormValues {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  description?: string;
  taskId?: string;
}

/**
 * Form values for expense
 */
export interface ExpenseFormValues {
  date: string;
  time: string;
  amount: number;
  description?: string;
  paid?: boolean;
  taskId?: string;
}

/**
 * Form values for note
 */
export interface NoteFormValues {
  date: string;
  time: string;
  description: string;
  taskId?: string;
}
