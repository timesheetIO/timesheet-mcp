/**
 * TimerRunningView - Displays running or paused timer with controls
 * Adapted from browser-extensions Timer.tsx TimerState component
 */

import React, {useState} from 'react';
import {useData} from './DataProvider';
import {useTimerOperations} from '../../utils/timesheet-hooks';
import {useSendFollowUpMessage} from '../../hooks';
import Duration from './Duration';
import TimerMenu from './TimerMenu';
import Spinner from '../shared/Spinner';
import FormattedMessage from '../shared/FormattedMessage';
import {classNames, intToRGB} from '../../utils/lib';

export default function TimerRunningView() {
  const {timer, settings, reloadTimer} = useData();
  const timerOps = useTimerOperations();
  const sendFollowUpMessage = useSendFollowUpMessage();
  const [actionLoading, setActionLoading] = useState(false);

  console.log('[TimerRunningView] Render:', {
    actionLoading,
    hasTimer: !!timer,
    hasProjectTitle: !!timer?.task?.project?.title,
    hasProjectId: !!timer?.task?.project?.id,
    timerStatus: timer?.status,
    timer,
  });

  const timerAction = (action: 'pauseTimer' | 'resumeTimer' | 'stopTimer') => async () => {
    if (actionLoading) {
      console.debug('Action already in progress, ignoring');
      return;
    }

    setActionLoading(true);

    try {
      // Strip seconds and milliseconds from timestamps (matches web app behavior)
      const now = new Date();
      now.setSeconds(0, 0);
      const timestamp = now.toISOString();

      const projectName = timer?.task?.project?.title || 'project';

      switch (action) {
        case 'stopTimer':
          await timerOps.stop({endDateTime: timestamp});
          console.log('[TimerRunningView] Timer stopped, sending follow-up message');
          sendFollowUpMessage(`Timer stopped for ${projectName}`);
          break;
        case 'pauseTimer':
          await timerOps.pause({startDateTime: timestamp});
          console.log('[TimerRunningView] Timer paused, sending follow-up message');
          sendFollowUpMessage(`Timer paused for ${projectName}`);
          break;
        case 'resumeTimer':
          await timerOps.resume({endDateTime: timestamp});
          console.log('[TimerRunningView] Timer resumed, sending follow-up message');
          sendFollowUpMessage(`Timer resumed for ${projectName}`);
          break;
      }

      // Reload timer after action
      await reloadTimer();
    } catch (error) {
      console.error('Timer action error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (actionLoading) {
    console.log('[TimerRunningView] Showing spinner - actionLoading=true');
    return <Spinner />;
  }

  // Safety check - if project data is missing, show loading state
  if (!timer || !timer.task?.project?.title || !timer.task?.project?.id) {
    console.log('[TimerRunningView] Showing spinner - missing data:', {
      hasTimer: !!timer,
      hasProjectTitle: !!timer?.task?.project?.title,
      hasProjectId: !!timer?.task?.project?.id,
    });
    return <Spinner />;
  }

  console.log('[TimerRunningView] Rendering timer UI');

  return (
    <div className="m-4 grid grid-cols-2 space-x-2">
      <div className="col-span-2 flex items-center">
        <div className="flex-auto pl-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{backgroundColor: timer.task?.project?.color ? intToRGB(timer.task.project.color) : '#6b7280'}}
            />
            <h2 className="text-xl font-bold">{timer.task?.project?.title}</h2>
          </div>
          {timer?.task?.project?.employer && (
            <h3 className="text-sm text-gray-700 dark:text-gray-300 ml-5">
              {timer.task.project.employer}
            </h3>
          )}
          {((timer.status === 'paused' && timer.pause?.startDateTime) ||
            timer.task?.startDateTime) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-5">
              <FormattedMessage
                id={
                  timer.status === 'paused' && timer.pause?.startDateTime
                    ? 'timerPausedAt'
                    : 'timerStartedAt'
                }
                defaultMessage={
                  timer.status === 'paused' ? 'Paused at' : 'Started at'
                }
              />{' '}
              {new Date(
                timer.status === 'paused' && timer.pause?.startDateTime
                  ? timer.pause.startDateTime
                  : timer.task?.startDateTime || Date.now()
              ).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
            </p>
          )}
        </div>
        <TimerMenu />
      </div>
      <div
        className={classNames(
          'p-2 divide-y text-center',
          timer?.status === 'paused' ? 'text-primary' : 'opacity-50'
        )}
      >
        <div
          className={classNames(
            'flex h-16 text-xl p-2 items-end justify-center',
            timer?.status === 'paused' && 'font-bold'
          )}
        >
          <Duration type="pause" timer={timer} />
        </div>
        <div className="text-md p-2 text-gray-500 dark:text-gray-400">
          <FormattedMessage id="timerPause" defaultMessage="Pause" />
        </div>
      </div>
      <div
        className={classNames(
          'p-2 divide-y text-center',
          timer?.status === 'paused' && settings?.showRelatives
            ? 'opacity-50'
            : 'opacity-100'
        )}
      >
        <div className="flex h-16 text-4xl p-2 items-end justify-center font-bold">
          <Duration timer={timer} />
        </div>
        <div className="text-md p-2 text-gray-500 dark:text-gray-400">
          <FormattedMessage
            id={settings?.showRelatives ? 'timerDurationRelative' : 'timerDuration'}
            defaultMessage={settings?.showRelatives ? 'Rel. Duration' : 'Duration'}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={timerAction(timer.status === 'running' ? 'pauseTimer' : 'resumeTimer')}
        disabled={actionLoading}
        className={classNames(
          'inline-flex items-center justify-center px-4 py-2 border border-transparent text-base text-center font-medium rounded-md shadow-sm text-white',
          timer.status === 'running'
            ? 'bg-primary/100 hover:bg-primary/70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <span className="uppercase">
          <FormattedMessage
            id={timer.status === 'running' ? 'timerPause' : 'timerResume'}
            defaultMessage={timer.status === 'running' ? 'Pause' : 'Resume'}
          />
        </span>
      </button>
      <button
        type="button"
        onClick={timerAction('stopTimer')}
        disabled={actionLoading}
        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-base text-center font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="uppercase">
          <FormattedMessage id="timerStop" defaultMessage="Stop" />
        </span>
      </button>
    </div>
  );
}
