/**
 * The latest timer, shared by every Timesheet widget the host shows: the timer cards in a
 * conversation and the timer in the sidebar. Each runs in its own frame, all on the same origin,
 * so localStorage holds the latest copy and its `storage` event tells the other frames. A host
 * that blocks storage gets no sharing: each widget then shows its own result.
 */

import type {CallToolResult} from '@modelcontextprotocol/client';
import type {ExtendedTimer, TimerTask} from './types';

/** UI-only _meta keys of timer results (mcp-app-helpers.ts on the server) */
export const STOPPED_TASK_META_KEY = 'timesheet/stoppedTask';
export const OBSERVED_AT_META_KEY = 'timesheet/observedAt';
const PROFILE_META_KEY = 'timesheet/profile';

export interface TimerSnapshot {
  timer: ExtendedTimer;
  /** The entry the timer stopped running, when the result reports it */
  stoppedTask: TimerTask | null;
  /** When the server read the timer (epoch ms, server clock) */
  observedAt: number;
  /** The Timesheet user, so one account's timer never shows for another */
  user?: string;
}

const SNAPSHOT_KEY = 'timesheet:timer:v1';
const REFRESH_KEY = 'timesheet:timer-refresh:v1';
/** One widget refreshes for all of them: the others get its result through storage */
const REFRESH_LOCK_MS = 10_000;

function parse(raw: string | null): TimerSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const valid = value && typeof value.observedAt === 'number' && typeof value.timer?.status === 'string';
    return valid ? value : null;
  } catch {
    return null;
  }
}

/** Whether a snapshot may show for the user (unknown on either side counts as a match) */
export function belongsTo(snapshot: TimerSnapshot, user?: string): boolean {
  return !snapshot.user || !user || snapshot.user === user;
}

/** The timer a timer tool returned, or null for an error or a server that does not date it */
export function snapshotFromResult(result: CallToolResult | null | undefined): TimerSnapshot | null {
  if (!result || result.isError) return null;
  const timer = result.structuredContent as ExtendedTimer | undefined;
  const meta = (result._meta ?? {}) as Record<string, any>;
  const observedAt = meta[OBSERVED_AT_META_KEY];
  if (!timer || typeof timer.status !== 'string' || typeof observedAt !== 'number') return null;
  return {
    timer,
    stoppedTask: meta[STOPPED_TASK_META_KEY] ?? null,
    observedAt,
    user: meta[PROFILE_META_KEY]?.user,
  };
}

/** The latest shared timer of the user, if any */
export function readSnapshot(user?: string): TimerSnapshot | null {
  try {
    const snapshot = parse(window.localStorage.getItem(SNAPSHOT_KEY));
    return snapshot && belongsTo(snapshot, user) ? snapshot : null;
  } catch {
    return null;
  }
}

/** Shares a timer with the other widgets, unless they already have a newer one */
export function publishSnapshot(snapshot: TimerSnapshot | null): void {
  if (!snapshot) return;
  try {
    const stored = parse(window.localStorage.getItem(SNAPSHOT_KEY));
    if (stored && belongsTo(stored, snapshot.user) && stored.observedAt >= snapshot.observedAt) return;
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage blocked or full: the widgets just don't share
  }
}

/** Calls the listener with each timer another widget shares. Returns the unsubscribe. */
export function subscribeSnapshots(listener: (snapshot: TimerSnapshot) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SNAPSHOT_KEY) return;
    const snapshot = parse(event.newValue);
    if (snapshot) listener(snapshot);
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/**
 * Whether this widget should read the timer now. False when another widget started a read
 * moments ago: its result arrives here through storage.
 */
export function claimRefresh(): boolean {
  try {
    const now = Date.now();
    const last = Number(window.localStorage.getItem(REFRESH_KEY)) || 0;
    if (now >= last && now - last < REFRESH_LOCK_MS) return false;
    window.localStorage.setItem(REFRESH_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}
