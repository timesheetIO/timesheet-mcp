/**
 * BarList - horizontal bars per item, scaled to the largest value
 */

import React, { useEffect, useState } from 'react';
import { classNames } from '../../utils/lib';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  display: string;
  color?: string;
  /** Rendered in a neutral tone, e.g. a project with no billable time */
  muted?: boolean;
}

export default function BarList({ items }: { items: BarItem[] }) {
  const [shown, setShown] = useState(false);
  const max = Math.max(...items.map(item => item.value), 0) || 1;

  // Grow from zero on first paint
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    // One grid for all rows, so every track starts and ends at the same place
    <ul
      className="grid items-center gap-x-3 gap-y-2 list-none m-0 p-0 text-body-small"
      style={{ gridTemplateColumns: 'minmax(64px, max-content) 1fr auto' }}
    >
      {items.map(item => (
        <li key={item.key} className="contents">
          <span className={classNames('truncate max-w-[180px]', item.muted ? 'text-secondary' : 'text-text-primary')}>
            {item.label}
          </span>
          <span className="ts-bar-track">
            <i
              className="ts-bar-fill"
              style={{
                width: `${Math.max(2, (item.value / max) * 100)}%`,
                transform: shown ? 'scaleX(1)' : 'scaleX(0)',
                background: item.muted ? 'var(--ts-fg-subtle)' : item.color || 'var(--ts-accent)',
              }}
            />
          </span>
          <span className="font-mono tabular-nums text-right text-text-primary whitespace-nowrap">{item.display}</span>
        </li>
      ))}
    </ul>
  );
}
