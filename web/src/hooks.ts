/**
 * Widget hooks backed by MCP Apps SDK
 *
 * These hooks preserve the same names and signatures as the old OpenAI-based
 * hooks so that inner widget components require zero changes.
 */

import { useCallback } from 'react';
import { useDocumentTheme } from '@modelcontextprotocol/ext-apps/react';
import {
  useMcpApp,
  useMcpToolResult,
  useMcpToolInput,
  useMcpHostContext,
} from './McpAppProvider';

/**
 * Get tool output - returns the structuredContent from the latest tool result.
 */
export function useToolOutput<T = any>(): T | null {
  const toolResult = useMcpToolResult();

  if (!toolResult) {
    return null;
  }

  // The MCP Apps SDK delivers CallToolResult which has { content, structuredContent }
  const sc = (toolResult as any).structuredContent;
  if (sc !== undefined) {
    return sc as T;
  }

  // Fallback: try content array
  return toolResult as unknown as T;
}

/**
 * Get tool input
 */
export function useToolInput<T = any>(): T | undefined {
  const toolInput = useMcpToolInput();
  return (toolInput as T) ?? undefined;
}

/**
 * Get theme - returns 'light' or 'dark'
 */
export function useTheme(): 'light' | 'dark' {
  const theme = useDocumentTheme();
  // useDocumentTheme returns McpUiTheme which is 'light' | 'dark'
  return theme || 'light';
}

/**
 * Call a server tool through the MCP App host proxy
 */
export function useCallTool() {
  const app = useMcpApp();

  return useCallback(
    async (toolName: string, input: any) => {
      if (!app) {
        throw new Error('MCP App not connected');
      }
      const result = await app.callServerTool({
        name: toolName,
        arguments: input,
      });
      return result;
    },
    [app]
  );
}

/**
 * Request display mode change (inline, fullscreen, pip)
 */
export function useDisplayMode() {
  const app = useMcpApp();

  return useCallback(
    async (mode: 'inline' | 'fullscreen' | 'pip') => {
      if (!app) return;
      await app.requestDisplayMode({ mode });
    },
    [app]
  );
}

/**
 * Send a follow-up message to the chat conversation
 */
export function useSendFollowUpMessage() {
  const app = useMcpApp();

  return useCallback(
    async (message: string) => {
      if (!app) {
        console.warn('[useSendFollowUpMessage] MCP App not connected');
        return;
      }
      try {
        await app.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: message }],
        });
        console.log('[useSendFollowUpMessage] Message sent successfully');
      } catch (error) {
        console.error('[useSendFollowUpMessage] Error sending message:', error);
      }
    },
    [app]
  );
}

/**
 * Get and set widget state
 * MCP Apps doesn't have persistent widget state yet, so this uses local React state.
 */
export function useWidgetState<T>(defaultState: T): [T, (state: T) => void] {
  const [state, setState] = __useState<T>(defaultState);
  return [state, setState];
}

// Re-import useState for useWidgetState
import { useState as __useState } from 'react';
