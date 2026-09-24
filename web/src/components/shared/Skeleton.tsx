/**
 * Skeleton - placeholder lines while a widget waits for its data
 */

import React from 'react';
import Card from './Card';

export function SkeletonLine({ width = '100%', height = 12 }: { width?: string; height?: number }) {
  return (
    <span
      className="block rounded animate-pulse bg-background-secondary"
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** A card-shaped placeholder: icon, title and two lines */
export default function Skeleton({ label }: { label: string }) {
  return (
    <Card tone="plain" className="p-4">
      <div className="flex items-center gap-4" role="status" aria-label={label}>
        <span className="w-11 h-11 rounded-lg animate-pulse bg-background-secondary flex-none" aria-hidden="true" />
        <div className="grid gap-2 flex-1">
          <SkeletonLine width="55%" height={14} />
          <SkeletonLine width="80%" />
        </div>
      </div>
    </Card>
  );
}
