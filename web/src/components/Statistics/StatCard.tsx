/**
 * StatCard Component
 * Displays a summary statistic card
 */

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  valueColor?: string;
  theme?: 'light' | 'dark';
}

export default function StatCard({ label, value, valueColor, theme = 'light' }: StatCardProps) {
  return (
    <div className="p-4 bg-background-secondary dark:bg-background-secondary rounded">
      <div className="text-body-small text-secondary dark:text-secondary mb-1">
        {label}
      </div>
      <div
        className="text-4xl font-bold"
        style={{ color: valueColor || (theme === 'dark' ? '#ffffff' : '#000000') }}
      >
        {value}
      </div>
    </div>
  );
}
