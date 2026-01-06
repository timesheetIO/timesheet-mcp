/**
 * DataProvider - Manages all data fetching and state for TimerWidget
 * Preloads profile, settings, timer, projects, tags, rates
 */

import React, {createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode} from 'react';
import type {Project, Tag, Rate, Settings} from '@timesheet/sdk';
import type {ExtendedTimer} from '../../utils/types';
import {useTimerOperations, useProjectOperations} from '../../utils/timesheet-hooks';
import type {ViewType} from './ViewRouter';

interface DataContextType {
  timer: ExtendedTimer | null;
  projects: Project[];
  tags: Tag[];
  rates: Rate[];
  settings: Settings;
  loading: boolean;
  error: string | null;
  selectedProject: string | null;
  setSelectedProject: (projectId: string | null) => void;
  reloadTimer: () => Promise<void>;
  reloadProjects: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

// Default settings (matches SDK Settings type) - used as fallback when API settings not available
const DEFAULT_SETTINGS: Settings = {
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
  showRelatives: true, // Show relative duration (total - breaks) by default
  weeklySummary: false,
  monthlySummary: false,
  timerRounding: 0,
  timerRoundingType: 0,
  timerEditView: false,
  pauseRounding: 0,
  pauseRoundingType: 0,
  pauseEditView: false,
  autofillProjectSelection: true,
};

/**
 * Merge API settings with defaults (for any missing properties)
 */
function mergeSettings(apiSettings: Partial<Settings> | null | undefined): Settings {
  if (!apiSettings) {
    return DEFAULT_SETTINGS;
  }
  return {
    ...DEFAULT_SETTINGS,
    ...apiSettings,
  };
}

export function DataProvider({
  children,
  currentView,
}: {
  children: ReactNode;
  currentView?: ViewType;
}) {
  const timerOps = useTimerOperations();
  const projectOps = useProjectOperations();
  const [timer, setTimer] = useState<ExtendedTimer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const reloadTimer = useCallback(async () => {
    console.log('[DataProvider] reloadTimer - starting');
    try {
      const result = await timerOps.getStatus();
      console.log('[DataProvider] reloadTimer - got result:', result);
      setTimer(result as ExtendedTimer);

      // Extract and merge settings from response if available
      if (result?.settings) {
        console.log('[DataProvider] reloadTimer - received settings from API:', result.settings);
        setSettings(mergeSettings(result.settings));
      }

      // If timer has a project, set it as selected
      if (result?.task?.project?.id) {
        console.log('[DataProvider] reloadTimer - setting selected project:', result.task.project.id);
        setSelectedProject(result.task.project.id);
      }
    } catch (err) {
      console.error('[DataProvider] Failed to reload timer:', err);
      throw err;
    }
  }, [timerOps]);

  const reloadProjects = useCallback(async () => {
    try {
      const {projects: projectsData} = await projectOps.list({
        limit: 100,
        status: 'active',
        sort: 'alpha',
        order: 'asc',
      });

      console.log('[DataProvider] Loaded projects:', projectsData.length, 'projects');
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to reload projects:', err);
      throw err;
    }
  }, [projectOps]);

  const loadAllData = useCallback(async () => {
    console.log('[DataProvider] loadAllData - starting');
    try {
      setLoading(true);
      setError(null);

      // Fetch timer and projects in parallel
      await Promise.all([
        reloadTimer(),
        reloadProjects(),
      ]);

      console.log('[DataProvider] loadAllData - complete, setting loading=false');
      setLoading(false);
    } catch (err) {
      console.error('[DataProvider] Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  }, [reloadTimer, reloadProjects]);

  // Initial data load - only run once on mount
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      console.log('[DataProvider] Initial load - calling loadAllData');
      hasLoadedRef.current = true;
      loadAllData().catch((err) => {
        console.error('[DataProvider] Initial load failed:', err);
      });
    }
  }, [loadAllData]);

  // Auto-refresh timer every 30 seconds (only when running/paused)
  // Use ref to avoid recreating interval when reloadTimer changes
  const reloadTimerRef = useRef(reloadTimer);
  useEffect(() => {
    reloadTimerRef.current = reloadTimer;
  }, [reloadTimer]);

  useEffect(() => {
    console.log('[DataProvider] Auto-refresh effect - timer status:', timer?.status, 'currentView:', currentView);

    // Only auto-refresh when on the timer view (not on forms)
    const isTimerView = !currentView || currentView === 'timer';

    if (isTimerView && (timer?.status === 'running' || timer?.status === 'paused')) {
      console.log('[DataProvider] Setting up auto-refresh interval (will fire every 30 seconds)');
      const interval = setInterval(() => {
        console.log('[DataProvider] Auto-refresh triggered (30 second interval)');
        reloadTimerRef.current().catch(console.error);
      }, 30000); // 30 seconds

      return () => {
        console.log('[DataProvider] Clearing auto-refresh interval');
        clearInterval(interval);
      };
    } else {
      console.log('[DataProvider] Timer not running/paused or not on timer view - no auto-refresh');
    }
  }, [timer?.status, currentView]); // Depend on both status and currentView

  return (
    <DataContext.Provider
      value={{
        timer,
        projects,
        tags,
        rates,
        settings,
        loading,
        error,
        selectedProject,
        setSelectedProject,
        reloadTimer,
        reloadProjects,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}
