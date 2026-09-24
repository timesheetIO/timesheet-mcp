/**
 * TimerWidget - the timer as a compact card, with forms for breaks, expenses and notes.
 * Renders for timer_start, timer_stop, timer_pause, timer_resume, timer_status and timer_update.
 */

import React, {useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {useTranslation} from 'react-i18next';
import {McpAppProvider} from '../../McpAppProvider';
import {useDisplayMode, useHostContext, useToolMeta} from '../../hooks';
import {DataProvider, useData} from './DataProvider';
import {ViewRouterProvider, useViewRouter} from './ViewRouter';
import TimerCard from './TimerCard';
import TimerStartView from './TimerStartView';
import ActionsView from './ActionsView';
import TaskEditForm from './forms/TaskEditForm';
import PauseForm from './forms/PauseForm';
import ExpenseForm from './forms/ExpenseForm';
import NoteForm from './forms/NoteForm';
import Card from '../shared/Card';
import Skeleton from '../shared/Skeleton';
import '../../i18n';
import '../../index.css';

function ViewRenderer() {
  const {t} = useTranslation();
  const {currentView} = useViewRouter();
  const {timer, loading, error, changedInWidget} = useData();
  // Hosts that do not send toolInfo still get it from the result (UI-only _meta)
  const hostToolName = useHostContext()?.toolInfo?.tool?.name;
  const resultToolName = useToolMeta<string>('timesheet/tool');
  const toolName = hostToolName ?? resultToolName;

  if (loading) {
    return <Skeleton label={t('common.loading')} />;
  }

  if (error) {
    return (
      <Card tone="plain" className="p-4">
        <p className="m-0 text-body-small text-secondary" role="status">
          {error === 'cancelled' ? t('common.cancelled') : t('timerWidget.loadFailed')}
        </p>
      </Card>
    );
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
      // A finished entry is worth a summary right after it was stopped. Asked for the status
      // with nothing running, the user wants to start something instead.
      const showSummary = !!timer?.task && (toolName !== 'timer_status' || changedInWidget);
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
  const expandedByUs = useRef(false);

  useEffect(() => {
    if (currentView !== 'timer' && canFullscreen && mode === 'inline' && !expandedByUs.current) {
      expandedByUs.current = true;
      request('fullscreen');
    } else if (currentView === 'timer' && mode === 'fullscreen' && expandedByUs.current) {
      expandedByUs.current = false;
      request('inline');
    }
  }, [currentView, canFullscreen, mode, request]);

  return (
    <DataProvider currentView={currentView}>
      <div className={mode === 'fullscreen' ? 'max-w-xl mx-auto p-4' : undefined}>
        <ViewRenderer />
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
