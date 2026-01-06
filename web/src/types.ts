/**
 * OpenAI Apps SDK Types
 * Based on https://developers.openai.com/apps-sdk/build/custom-ux
 */

export interface OpenAIWindow {
  // Global state and metadata
  toolInput: any;
  toolOutput: any;
  toolResponseMetadata: any;
  widgetState: any;

  // Actions
  callTool: (toolName: string, input: any) => Promise<any>;
  setWidgetState: (state: any) => void;
  sendMessage: (message: string) => void;
  navigate: (url: string) => void;
  requestDisplayMode: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void;

  // Environment
  theme: 'light' | 'dark';
  locale: string;
}

declare global {
  interface Window {
    openai: OpenAIWindow;
  }
}

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
  projectBreakdown: Array<{
    projectTitle: string;
    hours: number;
    percentage: number;
  }>;
  dailyHours: Array<{
    date: string;
    hours: number;
  }>;
}
