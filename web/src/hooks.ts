/**
 * Widget hooks backed by the MCP Apps SDK
 */

import { useCallback, useEffect, useState } from 'react';
import { useDocumentTheme } from '@modelcontextprotocol/ext-apps/react';
import {
  useMcpApp,
  useMcpToolResult,
  useMcpToolInput,
  useMcpHostContext,
} from './McpAppProvider';

export { useMcpHostContext as useHostContext, useMcpLifecycle as useLifecycle } from './McpAppProvider';

/**
 * Get tool output - returns the structuredContent from the latest tool result.
 */
export function useToolOutput<T = any>(): T | null {
  const toolResult = useMcpToolResult();

  if (!toolResult) {
    return null;
  }

  const sc = (toolResult as any).structuredContent;
  if (sc !== undefined) {
    return sc as T;
  }

  return toolResult as unknown as T;
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
 * Call a server tool through the MCP App host proxy
 */
export function useCallTool() {
  const app = useMcpApp();

  return useCallback(
    // Each caller knows the structuredContent of the tool it calls
    async (toolName: string, input: any): Promise<any> => {
      if (!app) {
        throw new Error('MCP App not connected');
      }
      return app.callServerTool({
        name: toolName,
        arguments: input,
      });
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
 * Open a URL through the host (a sandboxed widget cannot navigate on its own).
 */
export function useOpenLink() {
  const app = useMcpApp();

  return useCallback(
    async (url: string) => {
      try {
        if (app && app.getHostCapabilities()?.openLinks) {
          await app.openLink({ url });
          return;
        }
      } catch (error) {
        console.error('[openLink] failed:', error);
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [app]
  );
}

type DisplayMode = 'inline' | 'fullscreen' | 'pip';

/**
 * Current display mode, whether fullscreen is available, and a request that only asks for
 * modes the host offers. The host decides: the returned mode is what we lay out for.
 */
export function useDisplayMode() {
  const app = useMcpApp();
  const hostContext = useMcpHostContext();
  const [granted, setGranted] = useState<DisplayMode | null>(null);
  const hostMode = hostContext?.displayMode as DisplayMode | undefined;

  // Whatever happened last wins: our granted request, or the host changing the mode itself
  useEffect(() => {
    if (hostMode) setGranted(hostMode);
  }, [hostMode]);

  const available = (hostContext?.availableDisplayModes ?? []) as DisplayMode[];
  const mode: DisplayMode = granted ?? hostMode ?? 'inline';

  const request = useCallback(
    async (target: DisplayMode): Promise<DisplayMode> => {
      if (!app || (target !== 'inline' && !available.includes(target))) {
        return mode;
      }
      try {
        const result = await app.requestDisplayMode({ mode: target });
        const next = (result?.mode as DisplayMode) ?? mode;
        setGranted(next);
        return next;
      } catch (error) {
        console.error('[requestDisplayMode] failed:', error);
        return mode;
      }
    },
    [app, available, mode]
  );

  return { mode, canFullscreen: available.includes('fullscreen'), request };
}

/**
 * Get and set widget state
 * MCP Apps doesn't have persistent widget state yet, so this uses local React state.
 */
export function useWidgetState<T>(defaultState: T): [T, (state: T) => void] {
  const [state, setState] = useState<T>(defaultState);
  return [state, setState];
}
