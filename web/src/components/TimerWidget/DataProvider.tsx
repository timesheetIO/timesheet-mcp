/**
 * DataProvider - timer state for the TimerWidget.
 *
 * The timer comes from the tool result the host pushes to the widget. The widget never polls:
 * the clock ticks client-side, and the timer is fetched again only after the user acts in the
 * widget. Projects are loaded when the start path needs them.
 */

import React, {createContext, useContext, useState, useCallback, useEffect, ReactNode} from 'react';
import type {Project, Tag, Rate, Settings} from '@timesheet/sdk';
import type {ExtendedTimer} from '../../utils/types';
import {useTimerOperations, useProjectOperations} from '../../utils/timesheet-hooks';
import {useLifecycle, useProfileAndSettings, useToolOutput} from '../../hooks';
import type {ViewType} from './ViewRouter';
import i18n from '../../i18n';

interface DataContextType {
  timer: ExtendedTimer | null;
  projects: Project[];
  projectsLoaded: boolean;
  tags: Tag[];
  rates: Rate[];
  settings: Settings;
  loading: boolean;
  error: string | null;
  selectedProject: string | null;
  setSelectedProject: (projectId: string | null) => void;
  /** Replace the timer with the one a timer tool just returned */
  applyTimer: (timer: ExtendedTimer | null | undefined) => void;
  /** The user started, paused, resumed or stopped the timer from this widget */
  changedInWidget: boolean;
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

function mergeSettings(apiSettings: Partial<Settings> | null | undefined): Settings {
  return apiSettings ? {...DEFAULT_SETTINGS, ...apiSettings} : DEFAULT_SETTINGS;
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
  const pushed = useToolOutput<ExtendedTimer>();
  const {settings: pushedSettings} = useProfileAndSettings<unknown, Partial<Settings>>();
  const {cancelled} = useLifecycle();

  const [timer, setTimer] = useState<ExtendedTimer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [changedInWidget, setChangedInWidget] = useState(false);

  // The result the host pushed for the tool call that rendered this widget
  useEffect(() => {
    if (pushed && typeof pushed === 'object' && 'status' in pushed) {
      setTimer(pushed);
      setError(null);
    }
  }, [pushed]);

  useEffect(() => {
    if (pushedSettings) {
      setSettings(mergeSettings(pushedSettings));
    }
  }, [pushedSettings]);

  useEffect(() => {
    if (timer?.task?.project?.id) {
      setSelectedProject(timer.task.project.id);
    }
  }, [timer?.task?.project?.id]);

  const applyTimer = useCallback((next: ExtendedTimer | null | undefined) => {
    if (next && typeof next === 'object' && 'status' in next) {
      setTimer(next);
      setChangedInWidget(true);
      const nextSettings = (next as any).settings;
      if (nextSettings) setSettings(mergeSettings(nextSettings));
    }
  }, []);

  const reloadTimer = useCallback(async () => {
    const result = await timerOps.getStatus();
    applyTimer(result as ExtendedTimer);
  }, [timerOps, applyTimer]);

  const reloadProjects = useCallback(async () => {
    try {
      const {projects: projectsData} = await projectOps.list({
        limit: 100,
        status: 'active',
        sort: 'alpha',
        order: 'asc',
      });
      setProjects(projectsData);
    } catch (err) {
      console.error('[TimerWidget] Failed to load projects:', err);
      setError(i18n.t('timerWidget.projectsLoadFailed'));
    } finally {
      setProjectsLoaded(true);
    }
  }, [projectOps]);

  // Projects are only needed to start a timer or to move the entry to another project
  const idle = !!timer && !timer.task && timer.status !== 'running' && timer.status !== 'paused';
  const needsProjects = idle || currentView === 'task/edit' || currentView === 'project/select';
  useEffect(() => {
    if (needsProjects && !projectsLoaded) {
      reloadProjects();
    }
  }, [needsProjects, projectsLoaded, reloadProjects]);

  return (
    <DataContext.Provider
      value={{
        timer,
        projects,
        projectsLoaded,
        tags: [],
        rates: [],
        settings,
        loading: !timer && !cancelled,
        error: cancelled && !timer ? 'cancelled' : error,
        selectedProject,
        setSelectedProject,
        applyTimer,
        changedInWidget,
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
