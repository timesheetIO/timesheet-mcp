/**
 * DataProvider - timer state for the TimerWidget.
 *
 * The timer comes from the tool result the host pushes to the widget. Every widget in a
 * conversation keeps its own copy, so they share the latest one (utils/timer-sync):
 * - A card that shows a running entry follows that entry: paused, resumed, or ended, it stops
 *   ticking once the timer no longer runs it. Idle cards and finished entries stay as they were.
 * - The timer in the sidebar (the timer_panel and timer_sidebar entrypoints) follows the timer.
 * The widget never polls. A running card or the sidebar reads the timer again only when it is
 * shown with a copy over a minute old (a conversation reopened, the tab back in view), and one
 * widget reads it for all of them. The clock ticks client-side in between.
 * Projects are loaded when the start path needs them.
 */

import React, {createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode} from 'react';
import type {Project, Tag, Rate, Settings} from '@timesheet/sdk';
import type {ExtendedTimer, TimerTask} from '../../utils/types';
import {STOPPED_TASK_META_KEY, useTimerOperations, useProjectOperations} from '../../utils/timesheet-hooks';
import {
  OBSERVED_AT_META_KEY,
  type TimerSnapshot,
  belongsTo,
  claimRefresh,
  publishSnapshot,
  readSnapshot,
  subscribeSnapshots,
} from '../../utils/timer-sync';
import {
  type ToolFailure,
  useCanCallServerTools,
  useHostContext,
  useLifecycle,
  useProfileAndSettings,
  useToolFailure,
  useToolMeta,
  useToolOutput,
} from '../../hooks';
import type {ViewType} from './ViewRouter';

/** The tools that open the timer in ChatGPT's sidebar or beside the conversation */
const SIDEBAR_TOOLS = ['timer_panel', 'timer_sidebar'];

/** A copy of the timer older than this is read again when the widget is shown */
const STALE_MS = 60_000;

const isActive = (timer?: ExtendedTimer | null) => timer?.status === 'running' || timer?.status === 'paused';

/** What the widget shows */
interface Shown {
  timer: ExtendedTimer | null;
  stoppedTask: TimerTask | null;
  /** The entry this card showed running has ended elsewhere, and how it was saved is unknown */
  endedElsewhere: boolean;
}

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
  /** The entry this card showed running has ended elsewhere; its end and duration are unknown */
  endedElsewhere: boolean;
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
  const pushedObservedAt = useToolMeta<number>(OBSERVED_AT_META_KEY);
  const toolFailure = useToolFailure();
  const canCallTools = useCanCallServerTools();
  const {tornDown} = useLifecycle();
  const {profile, settings: pushedSettings} = useProfileAndSettings<{user?: string}, Partial<Settings>>();
  const user = profile?.user;
  // Hosts that do not send toolInfo still get it from the result (UI-only _meta)
  const hostToolName = useHostContext()?.toolInfo?.tool?.name;
  const resultToolName = useToolMeta<string>('timesheet/tool');
  const toolName = hostToolName ?? resultToolName;
  const isSidebar = !!toolName && SIDEBAR_TOOLS.includes(toolName);

  // The ref is read by the storage and visibility handlers, the state renders it
  const shown = useRef<Shown>({timer: null, stoppedTask: null, endedElsewhere: false});
  const [view, setView] = useState<Shown>(shown.current);
  const {timer, stoppedTask, endedElsewhere} = view;
  /** When the server read the timer the widget shows (0: unknown) */
  const observedAt = useRef(0);
  const display = useCallback((next: Shown, at: number) => {
    shown.current = next;
    observedAt.current = at;
    setView(next);
  }, []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsState, setProjectsState] = useState<'idle' | ProjectsStatus>('idle');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [changedInWidget, setChangedInWidget] = useState(false);

  /** Applies a newer timer from another widget or a refresh, following the rules above */
  const adopt = useCallback((snapshot: TimerSnapshot | null) => {
    if (!snapshot || snapshot.observedAt <= observedAt.current || !belongsTo(snapshot, user)) return;
    const current = shown.current;
    // A card waits for its own result first: the timer it was rendered for decides what it follows
    if (!current.timer && !isSidebar) return;
    const ownId = !current.endedElsewhere && isActive(current.timer) ? current.timer?.task?.id : undefined;
    const stopped = ownId && snapshot.stoppedTask?.id === ownId ? snapshot.stoppedTask : null;
    const next = {timer: snapshot.timer, endedElsewhere: false};
    if (isActive(snapshot.timer) && (isSidebar || snapshot.timer.task?.id === ownId)) {
      display({...next, stoppedTask: null}, snapshot.observedAt);
    } else if (stopped) {
      display({...next, stoppedTask: stopped}, snapshot.observedAt);
    } else if (isSidebar && (isActive(current.timer) || !current.timer)) {
      display({...next, stoppedTask: null}, snapshot.observedAt);
    } else if (ownId) {
      display({...current, endedElsewhere: true}, snapshot.observedAt);
    } else {
      // Idle and finished cards keep what they show; the sidebar keeps the summary of its stop
      observedAt.current = snapshot.observedAt;
    }
  }, [isSidebar, user, display]);

  /** Reads the timer again when the copy shown is stale, for a running card or the sidebar */
  const refreshIfStale = useCallback(async () => {
    const current = shown.current;
    const ownId = !current.endedElsewhere && isActive(current.timer) ? current.timer?.task?.id : undefined;
    if (!canCallTools || tornDown || !current.timer || (!isSidebar && !ownId)) return;
    const latest = Math.max(observedAt.current, readSnapshot(user)?.observedAt ?? 0);
    if (Date.now() - latest < STALE_MS || !claimRefresh()) return;
    try {
      adopt(await timerOps.live(ownId));
    } catch (err) {
      console.error('[TimerWidget] Failed to refresh the timer:', err);
    }
  }, [canCallTools, tornDown, isSidebar, user, timerOps, adopt]);

  // The result the host pushed for the tool call that rendered this widget. timer_stop sends
  // the entry it saved alongside, since the stopped timer has no task any more. The other widgets
  // get it if it is the newest; a newer one they shared applies on top.
  useEffect(() => {
    if (!isTimer(pushed)) return;
    const at = pushedObservedAt ?? 0;
    // The sidebar may already show a newer copy than the one it was opened with
    if (at && at <= observedAt.current) return;
    display({timer: pushed, stoppedTask: pushedStoppedTask ?? null, endedElsewhere: false}, at);
    if (at) publishSnapshot({timer: pushed, stoppedTask: pushedStoppedTask ?? null, observedAt: at, user});
    adopt(readSnapshot(user));
    void refreshIfStale();
    // Only a new result runs this: adopt and refreshIfStale read the current state from refs
  }, [pushed, pushedStoppedTask, pushedObservedAt]);

  // Timers the other widgets share
  useEffect(() => subscribeSnapshots(adopt), [adopt]);

  // Back in view (the tab was hidden): catch up, and read the timer if the copy is stale
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      adopt(readSnapshot(user));
      void refreshIfStale();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [adopt, refreshIfStale, user]);

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
      // The timer operation shared its result just now, so the shared copy dates this one
      const at = Math.max(observedAt.current, readSnapshot(user)?.observedAt ?? 0);
      display({timer: next, stoppedTask: stopped, endedElsewhere: false}, at);
      setChangedInWidget(true);
      const nextSettings = (next as any).settings;
      if (nextSettings) setSettings(mergeSettings(nextSettings));
    }
  }, [user, display]);

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
        endedElsewhere,
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
