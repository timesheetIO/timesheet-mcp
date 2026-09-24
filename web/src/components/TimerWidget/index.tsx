/**
 * TimerWidget - the timer as a compact card, with forms for breaks, expenses and notes.
 * Renders for timer_start, timer_stop, timer_pause, timer_resume, timer_status and timer_update.
 */

import React, {useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {useTranslation} from 'react-i18next';
import {McpAppProvider} from '../../McpAppProvider';
import {useDisplayMode, useHostContext, useSafeAreaPadding, useToolMeta} from '../../hooks';
import {DataProvider, useData} from './DataProvider';
import {ViewRouterProvider, useViewRouter} from './ViewRouter';
import TimerCard from './TimerCard';
import TimerStartView from './TimerStartView';
import ActionsView from './ActionsView';
import TaskEditForm from './forms/TaskEditForm';
import PauseForm from './forms/PauseForm';
import ExpenseForm from './forms/ExpenseForm';
import NoteForm from './forms/NoteForm';
import Skeleton from '../shared/Skeleton';
import StatusCard from '../shared/StatusCard';
import '../../i18n';
import '../../index.css';

function ViewRenderer() {
  const {t} = useTranslation();
  const {currentView} = useViewRouter();
  const {timer, stoppedTask, loading, failure, changedInWidget} = useData();
  // Hosts that do not send toolInfo still get it from the result (UI-only _meta)
  const hostToolName = useHostContext()?.toolInfo?.tool?.name;
  const resultToolName = useToolMeta<string>('timesheet/tool');
  const toolName = hostToolName ?? resultToolName;

  if (loading) {
    return <Skeleton label={t('common.loading')} />;
  }

  if (failure) {
    return <StatusCard status={failure} />;
  }

  switch (currentView) {
    case 'actions':
      return <ActionsView />;
    case 'task/edit':
      return <TaskEditForm />;
    case 'pause/new':
      return <PauseForm />;
    case 'expense/new':
      return <ExpenseForm />;
    case 'note/new':
      return <NoteForm />;
    default: {
      const active = timer?.status === 'running' || timer?.status === 'paused';
      // A finished entry is worth a summary right after it was stopped: timer_stop sends the
      // entry it saved (older servers kept it on the timer). Asked for the status with nothing
      // running, the user wants to start something instead.
      const showSummary = !!stoppedTask || (!!timer?.task && (toolName !== 'timer_status' || changedInWidget));
      if (active || showSummary) {
        return <TimerCard />;
      }
      return <TimerStartView />;
    }
  }
}

/**
 * Forms get the room of fullscreen when the host offers it, and the card goes back inline.
 */
function AppWithRouter() {
  const {currentView} = useViewRouter();
  const {mode, canFullscreen, request} = useDisplayMode();
  const safeArea = useSafeAreaPadding();
  const expandedByUs = useRef(false);

  useEffect(() => {
    if (currentView !== 'timer' && canFullscreen && mode === 'inline' && !expandedByUs.current) {
      expandedByUs.current = true;
      request('fullscreen');
    } else if (currentView === 'timer' && expandedByUs.current) {
      // Also when the host declined: the next form may ask again
      expandedByUs.current = false;
      if (mode === 'fullscreen') request('inline');
    }
  }, [currentView, canFullscreen, mode, request]);

  // The same elements in both modes, so a form keeps what the user typed when the mode changes
  const fullscreen = mode === 'fullscreen';
  return (
    <DataProvider currentView={currentView}>
      <div style={fullscreen ? safeArea : undefined}>
        <div className={fullscreen ? 'max-w-xl mx-auto p-4' : undefined}>
          <ViewRenderer />
        </div>
      </div>
    </DataProvider>
  );
}

function TimerWidgetApp() {
  return (
    <McpAppProvider appName="TimerWidget">
      <ViewRouterProvider>
        <AppWithRouter />
      </ViewRouterProvider>
    </McpAppProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<TimerWidgetApp />);
}
