/**
 * Clock - a ticking HH:MM:SS read-out, computed client-side from the result data.
 * The widget never polls a tool to keep it current.
 */

import React, { useEffect, useState } from 'react';
import { formatClock } from '../../format';
import { useLifecycle } from '../../hooks';
import { classNames } from '../../utils/lib';

interface ClockProps {
  /** Elapsed milliseconds at a given moment */
  elapsedAt: (now: number) => number;
  /** Tick every second; a paused or finished entry shows a fixed value */
  running: boolean;
  className?: string;
}

export default function Clock({ elapsedAt, running, className }: ClockProps) {
  const { tornDown } = useLifecycle();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!running || tornDown) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running, tornDown, elapsedAt]);

  return (
    <span
      className={classNames('font-mono tabular-nums text-accent-text', className)}
      role="timer"
      aria-live="off"
    >
      {formatClock(elapsedAt(now))}
    </span>
  );
}
