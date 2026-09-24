/**
 * MCP App Provider
 * React context that initializes the MCP App connection and provides
 * app instance, tool results, and host context to descendant hooks.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { applyDocumentTheme, useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import type { App, McpUiDisplayMode, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { updateLocaleFromHostContext } from './i18n';

interface McpAppContextType {
  app: App | null;
  isConnected: boolean;
  error: Error | null;
  toolResult: CallToolResult | null;
  toolInput: Record<string, unknown> | null;
  hostContext: McpUiHostContext | undefined;
  /** The host cancelled the tool call this widget belongs to */
  cancelled: boolean;
  /** The host is tearing the widget down: stop timers and pending work */
  tornDown: boolean;
  /** Record the display mode the host granted in answer to requestDisplayMode */
  setDisplayMode: (mode: McpUiDisplayMode) => void;
}

const McpAppContext = createContext<McpAppContextType>({
  app: null,
  isConnected: false,
  error: null,
  toolResult: null,
  toolInput: null,
  hostContext: undefined,
  cancelled: false,
  tornDown: false,
  setDisplayMode: () => {},
});

interface McpAppProviderProps {
  appName: string;
  children: React.ReactNode;
}

export function McpAppProvider({ appName, children }: McpAppProviderProps) {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [toolInput, setToolInput] = useState<Record<string, unknown> | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>(undefined);
  const [cancelled, setCancelled] = useState(false);
  const [tornDown, setTornDown] = useState(false);

  // Ref-stable setters, so the callbacks registered once on the App stay current
  const setters = useRef({ setToolResult, setToolInput, setHostContext, setCancelled, setTornDown });

  const onAppCreated = useCallback((app: App) => {
    app.ontoolresult = (params) => {
      setters.current.setCancelled(false);
      setters.current.setToolResult(params);
    };

    app.ontoolinput = (params) => {
      setters.current.setToolInput((params.arguments as Record<string, unknown>) ?? null);
    };

    app.ontoolcancelled = () => {
      setters.current.setCancelled(true);
    };

    // Every notification is applied, even one that repeats a value: the display mode may have
    // changed in between through a requestDisplayMode answer (see setDisplayMode)
    app.onhostcontextchanged = (params) => {
      setters.current.setHostContext(prev => ({ ...prev, ...params }));
    };

    app.onteardown = async () => {
      setters.current.setTornDown(true);
      return {};
    };
  }, []);

  const { app, isConnected, error } = useApp({
    appInfo: { name: appName, version: '2.0.0' },
    // Inline cards may expand into fullscreen (Statistics charts, timer forms)
    capabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
    onAppCreated,
  });

  // Apply host styles (CSS variables, theme, fonts)
  useHostStyles(app, hostContext ?? app?.getHostContext());

  // Hosts that send no theme: the color tokens already follow the system through light-dark(),
  // so Tailwind's dark: variant, useTheme() and the charts follow it too, live
  const hostTheme = hostContext?.theme ?? app?.getHostContext()?.theme;
  useEffect(() => {
    if (!app || hostTheme || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => applyDocumentTheme(query.matches ? 'dark' : 'light');
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [app, hostTheme]);

  // Sync initial host context after connection
  useEffect(() => {
    if (isConnected && app) {
      const ctx = app.getHostContext();
      if (ctx) {
        setHostContext(prev => ({ ...ctx, ...prev }));
      }
    }
  }, [isConnected, app]);

  // Translations follow the host's locale
  useEffect(() => {
    updateLocaleFromHostContext(hostContext?.locale);
  }, [hostContext?.locale]);

  const setDisplayMode = useCallback((mode: McpUiDisplayMode) => {
    setHostContext(prev => ({ ...prev, displayMode: mode }));
  }, []);

  return (
    <McpAppContext.Provider
      value={{ app, isConnected, error, toolResult, toolInput, hostContext, cancelled, tornDown, setDisplayMode }}
    >
      {children}
    </McpAppContext.Provider>
  );
}

/** Access the MCP App instance */
export function useMcpApp(): App | null {
  return useContext(McpAppContext).app;
}

/** Access the latest tool result */
export function useMcpToolResult(): CallToolResult | null {
  return useContext(McpAppContext).toolResult;
}

/** Access the latest tool input */
export function useMcpToolInput(): Record<string, unknown> | null {
  return useContext(McpAppContext).toolInput;
}

/** Access the host context (theme, locale, display modes, ...) */
export function useMcpHostContext(): McpUiHostContext | undefined {
  return useContext(McpAppContext).hostContext;
}

/** Access connection state */
export function useMcpConnection(): { isConnected: boolean; error: Error | null } {
  const { isConnected, error } = useContext(McpAppContext);
  return { isConnected, error };
}

/** Whether the tool call was cancelled or the widget is being torn down */
export function useMcpLifecycle(): { cancelled: boolean; tornDown: boolean } {
  const { cancelled, tornDown } = useContext(McpAppContext);
  return { cancelled, tornDown };
}

/** Record a display mode the host granted */
export function useMcpSetDisplayMode(): (mode: McpUiDisplayMode) => void {
  return useContext(McpAppContext).setDisplayMode;
}
