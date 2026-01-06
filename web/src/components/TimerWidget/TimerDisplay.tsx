/**
 * TimerDisplay Component
 * Displays timer status and time
 */

import React from 'react';

interface TimerDisplayProps {
  status: 'running' | 'paused' | 'stopped';
  elapsedSeconds: number;
  projectTitle?: string;
  description?: string;
  theme?: 'light' | 'dark';
}

export default function TimerDisplay({
  status,
  elapsedSeconds,
  projectTitle,
  description,
  theme = 'light',
}: TimerDisplayProps) {
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const formatTime = () => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="py-4">
      {/* Timer Display - Large and prominent */}
      <div className="text-display font-mono text-text-primary dark:text-text-primary mb-2">
        {formatTime()}
      </div>

      {/* Project Title with running indicator */}
      {projectTitle ? (
        <div className="flex items-center gap-2 mb-1">
          {status === 'running' && (
            <div className="w-1.5 h-1.5 rounded-full bg-accent-success flex-shrink-0" />
          )}
          <span className="text-body text-text-primary dark:text-text-primary">
            {projectTitle}
          </span>
        </div>
      ) : (
        <span className="text-body text-secondary dark:text-secondary capitalize">
          {status}
        </span>
      )}

      {/* Description */}
      {description && (
        <div className="text-body-small text-secondary dark:text-secondary">
          {description}
        </div>
      )}
    </div>
  );
}
