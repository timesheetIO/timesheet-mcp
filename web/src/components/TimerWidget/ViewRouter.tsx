/**
 * ViewRouter - Internal navigation system for TimerWidget
 * Manages view transitions between timer, forms, and other screens
 */

import React, {createContext, useContext, useState, useCallback, ReactNode} from 'react';

export type ViewType =
  | 'timer'
  | 'task/edit'
  | 'pause/new'
  | 'expense/new'
  | 'note/new'
  | 'project/select';

interface ViewRouterContextType {
  currentView: ViewType;
  navigate: (view: ViewType) => void;
  goBack: () => void;
  history: ViewType[];
}

const ViewRouterContext = createContext<ViewRouterContextType | null>(null);

export function ViewRouterProvider({children}: {children: ReactNode}) {
  const [history, setHistory] = useState<ViewType[]>(['timer']);
  const currentView = history[history.length - 1];

  const navigate = useCallback((view: ViewType) => {
    setHistory(prev => [...prev, view]);
  }, []);

  const goBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  return (
    <ViewRouterContext.Provider value={{currentView, navigate, goBack, history}}>
      {children}
    </ViewRouterContext.Provider>
  );
}

export function useViewRouter(): ViewRouterContextType {
  const context = useContext(ViewRouterContext);
  if (!context) {
    throw new Error('useViewRouter must be used within ViewRouterProvider');
  }
  return context;
}
