/**
 * DataProvider - timer state for the TimerWidget.
 *
 * The timer comes from the tool result the host pushes to the widget. The widget never polls:
 * the clock ticks client-side, and the timer is fetched again only after the user acts in the
 * widget. Projects are loaded when the start path needs them.
 */

import React, {createContext, useContext, useState, useCallback, useEffect, ReactNode} from 'react';
import type {Project, Tag, Rate, Settings} from '@timesheet/sdk';
import type {ExtendedTimer, TimerTask} from '../../utils/types';
import {STOPPED_TASK_META_KEY, useTimerOperations, useProjectOperations} from '../../utils/timesheet-hooks';
import {
  type ToolFailure,
  useCanCallServerTools,
  useProfileAndSettings,
  useToolFailure,
  useToolMeta,
  useToolOutput,
} from '../../hooks';
import type {ViewType} from './ViewRouter';

export type ProjectsStatus = 'loading' | 'loaded' | 'error';

interface DataContextType {
  timer: ExtendedTimer | null;
  /** The entry the last stop saved: the API clears the timer's task when it stops */
  stoppedTask: TimerTask | null;
  projects: Project[];
  projectsStatus: ProjectsStatus;
  tags: Tag[];
  rates: Rate[];
  settings: Settings;
  loading: boolean;
  /** There is no timer to show: the tool call failed or was cancelled */
  failure: ToolFailure | null;
  selectedProject: string | null;
  setSelectedProject: (projectId: string | null) => void;
  /** Replace the timer with the one a timer tool just returned (and the entry a stop saved) */
  applyTimer: (timer: ExtendedTimer | null | undefined, stoppedTask?: TimerTask | null) => void;
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

/** project_list pages through the projects this many at a time */
const PROJECT_PAGE_SIZE = 100;
/** Enough for any real account; more would not fit a picker anyway */
const MAX_PROJECTS = 1000;

function mergeSettings(apiSettings: Partial<Settings> | null | undefined): Settings {
  return apiSettings ? {...DEFAULT_SETTINGS, ...apiSettings} : DEFAULT_SETTINGS;
}

function isTimer(value: unknown): value is ExtendedTimer {
  return !!value && typeof value === 'object' && 'status' in value;
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
  const pushedStoppedTask = useToolMeta<TimerTask>(STOPPED_TASK_META_KEY);
  const toolFailure = useToolFailure();
  const canCallTools = useCanCallServerTools();
  const {settings: pushedSettings} = useProfileAndSettings<unknown, Partial<Settings>>();

  const [timer, setTimer] = useState<ExtendedTimer | null>(null);
  const [stoppedTask, setStoppedTask] = useState<TimerTask | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsState, setProjectsState] = useState<'idle' | ProjectsStatus>('idle');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [changedInWidget, setChangedInWidget] = useState(false);

  // The result the host pushed for the tool call that rendered this widget. timer_stop sends
  // the entry it saved alongside, since the stopped timer has no task any more.
  useEffect(() => {
    if (isTimer(pushed)) {
      setTimer(pushed);
      setStoppedTask(pushedStoppedTask ?? null);
    }
  }, [pushed, pushedStoppedTask]);

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

  const applyTimer = useCallback((next: ExtendedTimer | null | undefined, stopped: TimerTask | null = null) => {
    if (isTimer(next)) {
      setTimer(next);
      setStoppedTask(stopped);
      setChangedInWidget(true);
      const nextSettings = (next as any).settings;
      if (nextSettings) setSettings(mergeSettings(nextSettings));
    }
  }, []);

  const reloadTimer = useCallback(async () => {
    const result = await timerOps.getStatus();
    applyTimer(result as ExtendedTimer);
  }, [timerOps, applyTimer]);

  // All active projects, page by page. A failed page fails the load: an error result is not an
  // empty project list.
  const reloadProjects = useCallback(async () => {
    setProjectsState('loading');
    try {
      const loaded = new Map<string, Project>();
      // A page count cap as well: a server that ignored `page` would answer page 1 forever
      for (let page = 1; page <= MAX_PROJECTS / PROJECT_PAGE_SIZE; page++) {
        const {projects: batch, totalCount} = await projectOps.list({
          limit: PROJECT_PAGE_SIZE,
          page,
          status: 'active',
          sort: 'alpha',
          order: 'asc',
        });
        const before = loaded.size;
        batch.forEach(project => loaded.set(project.id, project));
        const lastPage = batch.length < PROJECT_PAGE_SIZE || loaded.size === before;
        if (lastPage || loaded.size >= totalCount || loaded.size >= MAX_PROJECTS) break;
      }
      setProjects([...loaded.values()].slice(0, MAX_PROJECTS));
      setProjectsState('loaded');
    } catch (err) {
      console.error('[TimerWidget] Failed to load projects:', err);
      setProjectsState('error');
    }
  }, [projectOps]);

  // Projects are only needed to start a timer or to move the entry to another project (the edit
  // form has no project field). The summary of an entry just stopped starts again on its own
  // project.
  const idle = !!timer && !timer.task && !stoppedTask && timer.status !== 'running' && timer.status !== 'paused';
  const needsProjects = canCallTools && (idle || currentView === 'project/select');
  useEffect(() => {
    if (needsProjects && projectsState === 'idle') {
      reloadProjects();
    }
  }, [needsProjects, projectsState, reloadProjects]);

  return (
    <DataContext.Provider
      value={{
        timer,
        stoppedTask,
        projects,
        projectsStatus: projectsState === 'idle' ? 'loading' : projectsState,
        tags: [],
        rates: [],
        settings,
        loading: !timer && !toolFailure,
        failure: timer ? null : toolFailure,
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
