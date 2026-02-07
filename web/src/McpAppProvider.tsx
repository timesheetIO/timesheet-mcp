/**
 * MCP App Provider
 * React context that initializes the MCP App connection and provides
 * app instance, tool results, and host context to descendant hooks.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

interface McpAppContextType {
  app: App | null;
  isConnected: boolean;
  error: Error | null;
  toolResult: CallToolResult | null;
  toolInput: Record<string, unknown> | null;
  hostContext: McpUiHostContext | undefined;
}

const McpAppContext = createContext<McpAppContextType>({
  app: null,
  isConnected: false,
  error: null,
  toolResult: null,
  toolInput: null,
  hostContext: undefined,
});

interface McpAppProviderProps {
  appName: string;
  children: React.ReactNode;
}

export function McpAppProvider({ appName, children }: McpAppProviderProps) {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [toolInput, setToolInput] = useState<Record<string, unknown> | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>(undefined);

  // Use ref-stable callback to avoid recreating useApp options
  const toolResultRef = useRef(setToolResult);
  toolResultRef.current = setToolResult;
  const toolInputRef = useRef(setToolInput);
  toolInputRef.current = setToolInput;
  const hostContextRef = useRef(setHostContext);
  hostContextRef.current = setHostContext;

  const onAppCreated = useCallback((app: App) => {
    app.ontoolresult = (params) => {
      console.log('[McpAppProvider] Tool result received:', params);
      toolResultRef.current(params);
    };

    app.ontoolinput = (params) => {
      console.log('[McpAppProvider] Tool input received:', params);
      toolInputRef.current((params.arguments as Record<string, unknown>) ?? null);
    };

    app.onhostcontextchanged = (params) => {
      console.log('[McpAppProvider] Host context changed:', params);
      hostContextRef.current(prev => ({ ...prev, ...params }));
    };
  }, []);

  const { app, isConnected, error } = useApp({
    appInfo: { name: appName, version: '1.0.0' },
    capabilities: {},
    onAppCreated,
  });

  // Apply host styles (CSS variables, theme, fonts)
  useHostStyles(app, hostContext ?? app?.getHostContext());

  // Sync initial host context after connection
  React.useEffect(() => {
    if (isConnected && app) {
      const ctx = app.getHostContext();
      if (ctx) {
        setHostContext(ctx);
      }
    }
  }, [isConnected, app]);

  return (
    <McpAppContext.Provider
      value={{ app, isConnected, error, toolResult, toolInput, hostContext }}
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

/** Access the host context (theme, locale, etc.) */
export function useMcpHostContext(): McpUiHostContext | undefined {
  return useContext(McpAppContext).hostContext;
}

/** Access connection state */
export function useMcpConnection(): { isConnected: boolean; error: Error | null } {
  const { isConnected, error } = useContext(McpAppContext);
  return { isConnected, error };
}
