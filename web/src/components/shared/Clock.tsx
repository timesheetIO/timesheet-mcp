/**
 * Clock - a ticking H:MM read-out, computed client-side from the result data.
 * The widget never polls a tool to keep it current.
 */

import React, { useEffect, useState } from 'react';
import { formatClock } from '../../format';
import { useLifecycle } from '../../hooks';
import { classNames } from '../../utils/lib';

interface ClockProps {
  /** Elapsed milliseconds at a given moment */
  elapsedAt: (now: number) => number;
  /** Tick while running; a paused or finished entry shows a fixed value */
  running: boolean;
  className?: string;
}

export default function Clock({ elapsedAt, running, className }: ClockProps) {
  const { tornDown } = useLifecycle();
  const [now, setNow] = useState(() => Date.now());

  // The read-out only changes when the elapsed time reaches its next full minute
  useEffect(() => {
    setNow(Date.now());
    if (!running || tornDown) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const untilNextMinute = 60_000 - (elapsedAt(Date.now()) % 60_000);
      timeout = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, untilNextMinute + 50);
    };
    schedule();
    return () => clearTimeout(timeout);
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
