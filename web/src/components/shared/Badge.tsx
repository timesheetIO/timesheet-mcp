/**
 * Badge - small status pill in host status colors
 */

import React from 'react';
import { classNames } from '../../utils/lib';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

const TONES: Record<BadgeTone, string> = {
  success: 'bg-[color:var(--ts-success-bg)] text-[color:var(--ts-success)]',
  warning: 'bg-[color:var(--ts-warning-bg)] text-[color:var(--ts-warning)]',
  danger: 'bg-[color:var(--ts-danger-bg)] text-[color:var(--ts-danger)]',
  neutral: 'bg-background-secondary text-secondary',
  accent: 'bg-[color:var(--ts-accent-soft)] text-accent-text',
};

export default function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center flex-none px-2.5 py-1 rounded-full text-caption font-medium whitespace-nowrap',
        TONES[tone]
      )}
    >
      {children}
    </span>
  );
}
