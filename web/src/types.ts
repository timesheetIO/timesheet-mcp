/**
 * Timesheet Widget Types
 * SDK type re-exports and UI convenience extensions
 */

// Re-export types from SDK (without Task and Timer - we extend those below)
export type {
  // Core entities
  Project,
  Team,
  Member,
  Rate,
  Tag,
  Pause,
  Expense,
  Note,
  Todo,
  Activity,
} from '@timesheet/sdk';

// Import SDK types to extend
import type {
  Timer as SDKTimer,
  Task as SDKTask,
} from '@timesheet/sdk';

// Timer types with UI convenience fields
export interface TimerStatus extends SDKTimer {
  // UI convenience fields (computed/flattened from task)
  projectTitle?: string;
  projectId?: string;
  description?: string;
  duration?: number;
  hours?: number;
  minutes?: number;
  startTime?: string;
}

// Task type with UI convenience fields
export interface Task extends SDKTask {
  // UI convenience fields (computed/flattened from project)
  projectTitle?: string;
  hours?: number;
  minutes?: number;
}

// Statistics types (MCP-specific)
export interface Statistics {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  totalTasks: number;
  totalBreakHours: number;
  startDate?: string;
  endDate?: string;
  projectBreakdown: Array<{
    projectId?: string;
    projectTitle: string;
    projectColor?: number;
    hours: number;
    billableHours: number;
    nonBillableHours: number;
    taskCount: number;
    percentage: number;
  }>;
  dailyHours: Array<{
    date: string;
    hours: number;
    billableHours: number;
    nonBillableHours: number;
    breakHours: number;
  }>;
  weeklyHours?: Array<{
    weekStart: string;
    hours: number;
    billableHours: number;
    nonBillableHours: number;
    breakHours: number;
  }>;
}
