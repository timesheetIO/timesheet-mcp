/**
 * TaskCard Widget - Detailed Task View
 * Shows comprehensive information about a single time entry
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { useToolOutput, useTheme } from '../../hooks';
import { useApplyTheme } from '../../utils';
import type { Task } from '../../types';
import '../../index.css';

function TaskCardApp() {
  const task = useToolOutput<Task>();
  const theme = useTheme();

  // Apply theme
  useApplyTheme();

  if (!task) {
    return (
      <div className="text-body-small text-secondary dark:text-secondary p-4">
        Loading task...
      </div>
    );
  }

  const duration = task.duration || 0;
  const hours = task.hours || Math.floor(duration / 3600);
  const minutes = task.minutes || Math.floor((duration % 3600) / 60);

  const startDate = task.startDateTime ? new Date(task.startDateTime) : null;
  const endDate = task.endDateTime ? new Date(task.endDateTime) : null;

  return (
    <div className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-heading text-text-primary dark:text-text-primary flex-1">
            {task.description || 'Time Entry'}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="px-3 py-1.5 bg-accent-success/10 text-accent-success rounded text-body font-semibold">
              {hours}h {minutes}m
            </div>
            {task.billable && (
              <div className="px-3 py-1 bg-accent-success/10 text-accent-success rounded-sm text-body-small">
                Billable
              </div>
            )}
            {task.billable === false && (
              <div className="px-3 py-1 bg-background-secondary dark:bg-background-secondary text-secondary dark:text-secondary rounded-sm text-body-small">
                Non-billable
              </div>
            )}
          </div>
        </div>

        {task.project?.title && (
          <div className="flex items-center gap-2">
            <div className="text-body-small text-secondary dark:text-secondary">
              Project:
            </div>
            <div className="text-body-small text-text-primary dark:text-text-primary font-medium">
              {task.project.title}
            </div>
          </div>
        )}
      </div>

      {/* Task Details */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-body-small text-secondary dark:text-secondary mb-1">
              Start Time
            </div>
            <div className="text-body-small text-text-primary dark:text-text-primary">
              {startDate ? (
                <>
                  <div>{startDate.toLocaleDateString()}</div>
                  <div className="font-mono text-secondary dark:text-secondary">
                    {startDate.toLocaleTimeString()}
                  </div>
                </>
              ) : (
                'Not set'
              )}
            </div>
          </div>
          <div>
            <div className="text-body-small text-secondary dark:text-secondary mb-1">
              End Time
            </div>
            <div className="text-body-small text-text-primary dark:text-text-primary">
              {endDate ? (
                <>
                  <div>{endDate.toLocaleDateString()}</div>
                  <div className="font-mono text-secondary dark:text-secondary">
                    {endDate.toLocaleTimeString()}
                  </div>
                </>
              ) : (
                'Running'
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="text-body-small text-secondary dark:text-secondary mb-1">
            Task ID
          </div>
          <div className="font-mono text-body-small text-text-primary dark:text-text-primary">
            {task.id}
          </div>
        </div>

        {(task as any).location && (
          <div>
            <div className="text-body-small text-secondary dark:text-secondary mb-1">
              Location
            </div>
            <div className="text-body-small text-text-primary dark:text-text-primary">
              {(task as any).location}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mount the component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<TaskCardApp />);
}
