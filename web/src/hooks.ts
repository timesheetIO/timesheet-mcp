/**
 * Widget hooks backed by the MCP Apps SDK
 */

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useDocumentTheme } from '@modelcontextprotocol/ext-apps/react';
import type { McpUiDisplayMode } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/client';
import {
  useMcpApp,
  useMcpToolResult,
  useMcpToolInput,
  useMcpHostContext,
  useMcpLifecycle,
  useMcpSetDisplayMode,
} from './McpAppProvider';

export { useMcpHostContext as useHostContext, useMcpLifecycle as useLifecycle } from './McpAppProvider';

/** The text blocks of a tool result, joined */
export function resultText(result: CallToolResult | null | undefined): string {
  return (result?.content ?? [])
    .map(block => (block.type === 'text' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

/** A tool call the server answered with isError. The message is the result's text. */
export class ToolCallError extends Error {
  readonly result: CallToolResult;

  constructor(toolName: string, result: CallToolResult) {
    super(resultText(result) || `${toolName} failed`);
    this.name = 'ToolCallError';
    this.result = result;
  }
}

/**
 * Get tool output - the structuredContent of the latest tool result. An error result has no
 * output: see useToolFailure.
 */
export function useToolOutput<T = any>(): T | null {
  const toolResult = useMcpToolResult();

  if (!toolResult || toolResult.isError) {
    return null;
  }

  return (toolResult.structuredContent as T | undefined) ?? null;
}

export type ToolFailure = 'error' | 'cancelled';

/**
 * Why the widget has nothing to show: the tool call failed, or the host cancelled it before a
 * result arrived. null while the widget waits for its result, and once it has one.
 */
export function useToolFailure(): ToolFailure | null {
  const toolResult = useMcpToolResult();
  const { cancelled } = useMcpLifecycle();

  if (toolResult?.isError) {
    return 'error';
  }
  return cancelled && !toolResult ? 'cancelled' : null;
}

/**
 * UI-only data the server sends in the result's _meta (never shown to the model).
 */
export function useToolMeta<T = unknown>(key: string): T | undefined {
  const toolResult = useMcpToolResult();
  return ((toolResult as any)?._meta?.[key] as T) ?? undefined;
}

/**
 * The user's Timesheet profile and settings, sent with widget results. Older servers put them
 * into structuredContent, so that is the fallback.
 */
export function useProfileAndSettings<P = any, S = any>(): { profile?: P; settings?: S } {
  const output = useToolOutput<any>();
  const profile = useToolMeta<P>('timesheet/profile') ?? output?.profile;
  const settings = useToolMeta<S>('timesheet/settings') ?? output?.settings;
  return { profile, settings };
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
  return theme || 'light';
}

/** BCP 47 locale for Intl formatting: the host's, else the browser's */
export function useLocale(): string {
  const hostContext = useMcpHostContext();
  return hostContext?.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en';
}

/** IANA time zone of the user, when the host tells us */
export function useTimeZone(): string | undefined {
  return useMcpHostContext()?.timeZone;
}

/**
 * Whether the host proxies tool calls to the server. Buttons that call a tool are hidden when
 * it does not.
 */
export function useCanCallServerTools(): boolean {
  const app = useMcpApp();
  return !!app?.getHostCapabilities()?.serverTools;
}

/**
 * Call a server tool through the MCP App host proxy. Resolves with the result, and rejects with
 * a ToolCallError when the server answered with isError.
 */
export function useCallTool() {
  const app = useMcpApp();

  return useCallback(
    // Each caller knows the structuredContent of the tool it calls
    async (toolName: string, input: any): Promise<any> => {
      if (!app) {
        throw new Error('MCP App not connected');
      }
      const result = await app.callServerTool({
        name: toolName,
        arguments: input,
      });
      if (result?.isError) {
        throw new ToolCallError(toolName, result);
      }
      return result;
    },
    [app]
  );
}

/**
 * Tell the model what the user just did inside the widget, without starting a new turn.
 * (sendMessage would post a fake user message and force a reply.)
 */
export function useUpdateModelContext() {
  const app = useMcpApp();

  return useCallback(
    async (text: string) => {
      if (!app || !app.getHostCapabilities()?.updateModelContext) {
        return;
      }
      try {
        await app.updateModelContext({ content: [{ type: 'text', text }] });
      } catch (error) {
        console.error('[updateModelContext] failed:', error);
      }
    },
    [app]
  );
}

/**
 * Open a URL through the host (a sandboxed widget cannot navigate on its own). Resolves with
 * whether the link opened: false when the host refused it or a popup was blocked, so the
 * widget can offer the URL instead.
 */
export function useOpenLink() {
  const app = useMcpApp();

  return useCallback(
    async (url: string): Promise<boolean> => {
      if (app && app.getHostCapabilities()?.openLinks) {
        try {
          const result = await app.openLink({ url });
          // The host (or the user, in its confirmation) declined: do not open it anyway
          return !result?.isError;
        } catch (error) {
          console.error('[openLink] failed:', error);
        }
      }
      // Without noopener, window.open reports a blocked popup as null
      const opened = window.open(url, '_blank');
      if (!opened) {
        return false;
      }
      try {
        opened.opener = null;
      } catch {
        // A cross-origin window may not allow it; the page is ours or the export host anyway
      }
      return true;
    },
    [app]
  );
}

type DisplayMode = McpUiDisplayMode;

/**
 * Current display mode, whether fullscreen is available, and a request that only asks for
 * modes the host offers. The host decides: the mode it returns, and any mode it later reports
 * in the host context, is what we lay out for. Both land in the provider's host context, so
 * every component sees the latest.
 */
export function useDisplayMode() {
  const app = useMcpApp();
  const hostContext = useMcpHostContext();
  const setDisplayMode = useMcpSetDisplayMode();
  const mode: DisplayMode = (hostContext?.displayMode as DisplayMode | undefined) ?? 'inline';
  const availableModes = hostContext?.availableDisplayModes;
  const available = useMemo(() => (availableModes ?? []) as DisplayMode[], [availableModes]);

  const request = useCallback(
    async (target: DisplayMode): Promise<DisplayMode> => {
      if (!app || (target !== 'inline' && !available.includes(target))) {
        return mode;
      }
      try {
        const result = await app.requestDisplayMode({ mode: target });
        const next = (result?.mode as DisplayMode | undefined) ?? mode;
        setDisplayMode(next);
        return next;
      } catch (error) {
        console.error('[requestDisplayMode] failed:', error);
        return mode;
      }
    },
    [app, available, mode, setDisplayMode]
  );

  return { mode, canFullscreen: available.includes('fullscreen'), request };
}

/**
 * Padding for a fullscreen layout that keeps content out of the host's safe-area insets
 * (notch, home indicator). Apply it to a full-width wrapper around the centered content.
 */
export function useSafeAreaPadding(): CSSProperties {
  const insets = useMcpHostContext()?.safeAreaInsets;
  return {
    paddingTop: insets?.top ?? 0,
    paddingRight: insets?.right ?? 0,
    paddingBottom: insets?.bottom ?? 0,
    paddingLeft: insets?.left ?? 0,
  };
}

/**
 * Get and set widget state
 * MCP Apps doesn't have persistent widget state yet, so this uses local React state.
 */
export function useWidgetState<T>(defaultState: T): [T, (state: T) => void] {
  const [state, setState] = useState<T>(defaultState);
  return [state, setState];
}
