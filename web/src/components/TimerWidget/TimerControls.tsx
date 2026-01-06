/**
 * TimerControls Component
 * Control buttons for timer actions
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface TimerControlsProps {
  status: 'running' | 'paused' | 'stopped';
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  loading: boolean;
}

export default function TimerControls({
  status,
  onPause,
  onResume,
  onStop,
  loading,
}: TimerControlsProps) {
  const { t } = useTranslation();

  if (status === 'stopped') {
    return (
      <div className="flex gap-2 mt-4 pt-4 border-t border-border dark:border-border">
        <div className="flex-1 px-4 py-2.5 text-center text-body text-secondary dark:text-secondary">
          {t('timerWidget.status.stopped')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-4 pt-4 border-t border-border dark:border-border">
      {status === 'running' && (
        <>
          <button
            onClick={onPause}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-md text-body bg-button-secondary-bg dark:bg-button-secondary-bg text-button-secondary-text dark:text-button-secondary-text disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            Pause
          </button>
          <button
            onClick={onStop}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-md text-body bg-button-primary-bg dark:bg-button-primary-bg text-button-primary-text dark:text-button-primary-text disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            Stop
          </button>
        </>
      )}
      {status === 'paused' && (
        <>
          <button
            onClick={onResume}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-md text-body bg-button-primary-bg dark:bg-button-primary-bg text-button-primary-text dark:text-button-primary-text disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            Resume
          </button>
          <button
            onClick={onStop}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-md text-body bg-button-secondary-bg dark:bg-button-secondary-bg text-button-secondary-text dark:text-button-secondary-text disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            Stop
          </button>
        </>
      )}
    </div>
  );
}
