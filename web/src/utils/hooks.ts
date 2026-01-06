/**
 * Custom hooks for state management in the Enhanced Timer Widget
 */

import {useState, useEffect, useCallback} from 'react';
import {useCallTool} from '../hooks';
import type {
  Profile,
  Project,
  Settings,
  ExtendedTimer,
  Tag,
  Rate,
  WidgetState
} from './types';

/**
 * Hook to manage widget state with data hydration
 * Fetches profile, settings, timer, and projects on mount
 */
export function useWidgetData() {
  const callTool = useCallTool();
  const [state, setState] = useState<WidgetState>({
    profile: null,
    settings: null,
    timer: null,
    projects: [],
    tags: [],
    rates: [],
    loading: true,
    error: null,
  });

  const loadData = useCallback(async () => {
    try {
      setState(prev => ({...prev, loading: true, error: null}));

      // Fetch all required data in parallel
      const [timerResult, profileResult] = await Promise.all([
        callTool('timer_status', {}).catch(() => null),
        // We don't have a direct profile endpoint, so we'll get it from timer or set defaults
        Promise.resolve(null),
      ]);

      // For now, we'll work with what we have from the timer
      // In a real implementation, you'd fetch profile, settings, etc.

      setState({
        profile: null, // Will be populated if we add a profile endpoint
        settings: {
          dateFormat: 'yyyy-MM-dd',
          timeFormat: 'HH:mm',
          theme: 'light',
          language: 'en',
          currency: 'USD',
          firstDay: 1,
          durationFormat: 'h:mm',
          distance: 'km',
          timezone: 'UTC',
          csvSeparator: ',',
          slotDuration: 30,
          snapDuration: 15,
          entriesPerPage: 50,
          defaultTaskDuration: 60,
          defaultBreakDuration: 15,
          showRelatives: true,
          weeklySummary: false,
          monthlySummary: false,
          timerRounding: 0,
          timerRoundingType: 0,
          timerEditView: false,
          pauseRounding: 0,
          pauseRoundingType: 0,
          pauseEditView: false,
          autofillProjectSelection: true,
        } as Settings,
        timer: timerResult as ExtendedTimer,
        projects: [],
        tags: [],
        rates: [],
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load widget data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
      }));
    }
  }, [callTool]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    ...state,
    reload: loadData,
  };
}

/**
 * Hook to manage timer actions (start, stop, pause, resume)
 */
export function useTimerActions() {
  const callTool = useCallTool();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startTimer = useCallback(
    async (projectId: string, startDateTime?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool('timer_start', {
          projectId,
          startDateTime,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start timer';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [callTool]
  );

  const stopTimer = useCallback(
    async (endDateTime?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool('timer_stop', {endDateTime});
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to stop timer';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [callTool]
  );

  const pauseTimer = useCallback(
    async (startDateTime?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool('timer_pause', {startDateTime});
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to pause timer';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [callTool]
  );

  const resumeTimer = useCallback(
    async (endDateTime?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool('timer_resume', {endDateTime});
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to resume timer';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [callTool]
  );

  return {
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    loading,
    error,
    clearError: () => setError(null),
  };
}

/**
 * Hook to manage task-related actions (add notes, expenses, pauses, edit)
 */
export function useTaskActions() {
  const callTool = useCallTool();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addNote = useCallback(
    async (text: string, dateTime?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool('task_add_note', {text, dateTime});
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add note';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [callTool]
  );

  const addExpense = useCallback(
    async (description: string, amount: number, dateTime?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool('task_add_expense', {
          description,
          amount,
          dateTime,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add expense';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [callTool]
  );

  const addPause = useCallback(
    async (startDateTime: string, endDateTime: string, description?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool('task_add_pause', {
          startDateTime,
          endDateTime,
          description,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add pause';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [callTool]
  );

  const updateTimer = useCallback(
    async (data: {
      description?: string;
      tags?: string[];
      location?: string;
      billable?: boolean;
      feeling?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool('timer_update', data);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update timer';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [callTool]
  );

  return {
    addNote,
    addExpense,
    addPause,
    updateTimer,
    loading,
    error,
    clearError: () => setError(null),
  };
}
