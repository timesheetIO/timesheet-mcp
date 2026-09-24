/**
 * StatCard Component
 * Displays a summary statistic card
 */

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: boolean;
}

export default function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="p-4 bg-background-secondary rounded-lg">
      <div className="text-body-small text-secondary mb-1">{label}</div>
      <div className={`font-mono tabular-nums text-2xl font-medium ${accent ? 'text-accent-text' : 'text-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}
