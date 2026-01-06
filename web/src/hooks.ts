/**
 * Custom hooks for OpenAI Apps SDK integration
 * Uses event-driven approach with useSyncExternalStore
 */

import React, { useSyncExternalStore, useCallback } from 'react';
import type { OpenAIWindow } from './types';

const SET_GLOBALS_EVENT_TYPE = 'openai:set_globals';

/**
 * Get OpenAI global value and subscribe to changes via events
 * This uses React's useSyncExternalStore to properly subscribe to ChatGPT's event system
 * Matches official OpenAI Apps SDK examples implementation
 */
export function useOpenAIGlobal<T = any>(key: keyof OpenAIWindow): T | null {
  return useSyncExternalStore(
    // Subscribe to ChatGPT's data update event
    (onChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const handleSetGlobal = (event: any) => {
        const value = event.detail?.globals?.[key];
        if (value === undefined) {
          return; // Don't trigger onChange if value is undefined
        }
        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true,
      });

      return () => {
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
      };
    },
    // Get current value from window.openai - returns null if not found (like official examples)
    () => (window as any).openai?.[key] ?? null,
    // Server-side rendering fallback - also returns null
    () => null
  );
}

/**
 * Get and set widget state
 */
export function useWidgetState<T>(defaultState: T): [T, (state: T) => void] {
  const widgetState = useOpenAIGlobal<T>('widgetState');

  const setWidgetState = useCallback((newState: T) => {
    if (typeof window !== 'undefined' && (window as any).openai) {
      (window as any).openai.setWidgetState(newState);
    }
  }, []);

  return [widgetState ?? defaultState, setWidgetState];
}

/**
 * Get tool output - subscribes to ChatGPT's event system
 * Returns the data from the tool response
 */
export function useToolOutput<T = any>(): T | null {
  const toolOutput = useOpenAIGlobal<any>('toolOutput');

  // Debug logging
  React.useEffect(() => {
    console.log('[useToolOutput] toolOutput:', toolOutput);
    if (toolOutput) {
      console.log('[useToolOutput] toolOutput type:', typeof toolOutput);
      console.log('[useToolOutput] toolOutput keys:', Object.keys(toolOutput));

      // Log different possible paths
      if ('structuredContent' in toolOutput) {
        console.log('[useToolOutput] Direct structuredContent:', toolOutput.structuredContent);
      }
      if ('result' in toolOutput) {
        console.log('[useToolOutput] toolOutput.result:', toolOutput.result);
        if (toolOutput.result && 'structuredContent' in toolOutput.result) {
          console.log('[useToolOutput] result.structuredContent:', toolOutput.result.structuredContent);
        }
      }
    }
  }, [toolOutput]);

  // Return null if no data
  if (!toolOutput) {
    return null;
  }

  // Try to extract structuredContent from various paths
  // According to docs: window.openai.toolOutput should contain the data
  // But it might be nested in different ways

  // Path 1: Direct structuredContent (what our MCP server sends)
  if ('structuredContent' in toolOutput) {
    return toolOutput.structuredContent as T;
  }

  // Path 2: Nested in result.structuredContent
  if ('result' in toolOutput && toolOutput.result) {
    if (typeof toolOutput.result === 'object' && 'structuredContent' in toolOutput.result) {
      return toolOutput.result.structuredContent as T;
    }
    // Maybe result IS the structured content
    return toolOutput.result as T;
  }

  // Path 3: toolOutput itself is the data
  return toolOutput as T;
}

/**
 * Get tool input
 */
export function useToolInput<T = any>(): T | undefined {
  const toolInput = useOpenAIGlobal<T>('toolInput');
  return toolInput === null ? undefined : toolInput;
}

/**
 * Get theme
 */
export function useTheme(): 'light' | 'dark' {
  const theme = useOpenAIGlobal<'light' | 'dark'>('theme');
  return theme || 'light';
}

/**
 * Call a tool
 */
export function useCallTool() {
  return useCallback((toolName: string, input: any) => {
    if (typeof window !== 'undefined' && (window as any).openai) {
      return (window as any).openai.callTool(toolName, input);
    }
    return Promise.reject(new Error('OpenAI API not available'));
  }, []);
}


/**
 * Request display mode change
 */
export function useDisplayMode() {
  return useCallback((mode: 'inline' | 'picture-in-picture' | 'fullscreen') => {
    if (typeof window !== 'undefined' && (window as any).openai) {
      (window as any).openai.requestDisplayMode(mode);
    }
  }, []);
}

/**
 * Send follow-up message to chat
 */
export function useSendFollowUpMessage() {
  return useCallback((message: string) => {
    console.log('[useSendFollowUpMessage] Attempting to send message:', message);

    if (typeof window === 'undefined') {
      console.warn('[useSendFollowUpMessage] Window is undefined');
      return;
    }

    if (!(window as any).openai) {
      console.warn('[useSendFollowUpMessage] window.openai is not available');
      return;
    }

    if (typeof (window as any).openai.sendFollowUpMessage !== 'function') {
      console.warn('[useSendFollowUpMessage] window.openai.sendFollowUpMessage is not a function');
      console.log('[useSendFollowUpMessage] Available methods:', Object.keys((window as any).openai));
      return;
    }

    console.log('[useSendFollowUpMessage] Calling sendFollowUpMessage with prompt object...');
    try {
      // OpenAI Apps SDK expects an object with a 'prompt' property
      (window as any).openai.sendFollowUpMessage({prompt: message});
      console.log('[useSendFollowUpMessage] Message sent successfully');
    } catch (error) {
      console.error('[useSendFollowUpMessage] Error sending message:', error);
    }
  }, []);
}
