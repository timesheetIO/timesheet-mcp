/**
 * Statistics Widget - Main Entry Point
 * Displays time tracking statistics and visualizations
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { useToolOutput, useTheme, useDisplayMode } from '../../hooks';
import { useApplyTheme } from '../../utils';
import StatCard from './StatCard';
import ProjectBreakdown from './ProjectBreakdown';
import DailyChart from './DailyChart';
import type { Statistics } from '../../types';
import '../../index.css';

const formatHours = (hours: number) => hours.toFixed(1);

function StatisticsApp() {
  const stats = useToolOutput<Statistics>();
  const theme = useTheme();
  const requestDisplayMode = useDisplayMode();

  // Apply theme
  useApplyTheme();

  // Loading state
  if (!stats) {
    return (
      <div className="text-body-small text-secondary dark:text-secondary p-4">
        Loading statistics...
      </div>
    );
  }

  const billablePercentage = stats.totalHours > 0
    ? Math.round((stats.billableHours / stats.totalHours) * 100)
    : 0;

  return (
    <div className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl p-6">
      {/* Header with expand button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-heading text-text-primary dark:text-text-primary">
          Statistics
        </h2>
        <button
          onClick={() => requestDisplayMode('fullscreen')}
          className="px-3 py-2 rounded border border-border dark:border-border bg-background-primary dark:bg-background-primary text-text-primary dark:text-text-primary text-body-small cursor-pointer"
        >
          Expand
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Hours"
          value={formatHours(stats.totalHours)}
          theme={theme}
        />
        <StatCard
          label="Billable Hours"
          value={formatHours(stats.billableHours)}
          valueColor="#10b981"
          theme={theme}
        />
        <StatCard
          label="Billable %"
          value={`${billablePercentage}%`}
          theme={theme}
        />
      </div>

      {/* Project breakdown */}
      {stats.projectBreakdown && stats.projectBreakdown.length > 0 && (
        <ProjectBreakdown
          projects={stats.projectBreakdown}
          formatHours={formatHours}
          theme={theme}
        />
      )}

      {/* Daily hours chart */}
      {stats.dailyHours && stats.dailyHours.length > 0 && (
        <DailyChart
          data={stats.dailyHours}
          formatHours={formatHours}
          theme={theme}
        />
      )}
    </div>
  );
}

// Mount the component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<StatisticsApp />);
}
