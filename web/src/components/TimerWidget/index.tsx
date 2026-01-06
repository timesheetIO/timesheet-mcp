/**
 * TimerWidget - Enhanced Timer with Full Browser Extension Functionality
 * Main entry point with view routing and data hydration
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import {DataProvider, useData} from './DataProvider';
import {ViewRouterProvider, useViewRouter} from './ViewRouter';
import TimerRunningView from './TimerRunningView';
import TimerStartView from './TimerStartView';
import TaskEditForm from './forms/TaskEditForm';
import PauseForm from './forms/PauseForm';
import ExpenseForm from './forms/ExpenseForm';
import NoteForm from './forms/NoteForm';
import Spinner from '../shared/Spinner';
import '../../i18n';
import '../../index.css';

/**
 * View renderer - displays current view based on router state
 */
function ViewRenderer() {
  const {currentView} = useViewRouter();
  const {timer, loading, error} = useData();

  console.log('[ViewRenderer] Render:', {
    loading,
    error,
    currentView,
    timerStatus: timer?.status,
    hasTimer: !!timer,
  });

  // Loading state
  if (loading) {
    console.log('[ViewRenderer] Showing spinner (loading=true)');
    return <Spinner />;
  }

  // Error state
  if (error) {
    console.log('[ViewRenderer] Showing error:', error);
    return (
      <div className="m-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 rounded-md">
        <h3 className="font-semibold">Error loading timer</h3>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  // Route to appropriate view
  switch (currentView) {
    case 'timer':
      // Show running/paused timer or start view based on timer status
      if (timer?.status === 'running' || timer?.status === 'paused') {
        console.log('[ViewRenderer] Showing TimerRunningView');
        return <TimerRunningView />;
      }
      console.log('[ViewRenderer] Showing TimerStartView');
      return <TimerStartView />;

    case 'task/edit':
      console.log('[ViewRenderer] Showing TaskEditForm');
      return <TaskEditForm />;

    case 'pause/new':
      console.log('[ViewRenderer] Showing PauseForm');
      return <PauseForm />;

    case 'expense/new':
      console.log('[ViewRenderer] Showing ExpenseForm');
      return <ExpenseForm />;

    case 'note/new':
      console.log('[ViewRenderer] Showing NoteForm');
      return <NoteForm />;

    default:
      console.log('[ViewRenderer] Showing TimerStartView (default)');
      return <TimerStartView />;
  }
}

/**
 * Main App component with providers
 */
function TimerWidgetApp() {
  return (
    <div className="w-full flex-auto grow">
      <ViewRouterProvider>
        <AppWithRouter />
      </ViewRouterProvider>
    </div>
  );
}

/**
 * App component that has access to ViewRouter
 */
function AppWithRouter() {
  const {currentView} = useViewRouter();

  return (
    <DataProvider currentView={currentView}>
      <div className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl">
        <ViewRenderer />
      </div>
    </DataProvider>
  );
}

// Mount the component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<TimerWidgetApp />);
}
