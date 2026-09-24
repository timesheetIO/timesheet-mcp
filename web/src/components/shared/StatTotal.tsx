/**
 * StatTotal - one large number with its caption ("38h 30m this week")
 */

import React from 'react';

export default function StatTotal({ value, caption }: { value: string; caption?: string }) {
  return (
    <p className="flex items-baseline flex-wrap gap-x-2 m-0">
      <strong className="font-mono tabular-nums text-[26px] font-medium leading-tight text-text-primary">{value}</strong>
      {caption && <span className="text-body-small text-secondary">{caption}</span>}
    </p>
  );
}
