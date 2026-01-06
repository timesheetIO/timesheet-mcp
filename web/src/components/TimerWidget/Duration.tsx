/**
 * Duration - Live timer display component
 * Adapted from browser-extensions Timer.tsx Duration component
 */

import React, {Fragment, useState, useEffect} from 'react';
import {useData} from './DataProvider';
import {formatTimeHHMM, HOUR_MS} from '../../utils/lib';
import type {ExtendedTimer} from '../../utils/types';

interface DurationProps {
  type?: 'task' | 'pause';
  timer: ExtendedTimer;
}

/**
 * Formats milliseconds to HH:MM JSX element
 */
const formatMMHHSS = (ms: number = 0): JSX.Element => {
  const timeStr = formatTimeHHMM(ms);
  const [hours, minutes] = timeStr.split(':');

  return (
    <Fragment>
      {hours}
      <span>:</span>
      {minutes}
    </Fragment>
  );
};

export default function Duration({type = 'task', timer}: DurationProps): JSX.Element {
  const {settings} = useData();
  const [startDate] = useState(
    (type === 'task' ? timer.task?.startDateTime : timer.pause?.startDateTime) ||
      new Date().toISOString()
  );

  const calculateDuration = (startDate: Date, timer: ExtendedTimer): number => {
    if (!timer.task) {
      return 0;
    }

    // Strip seconds and milliseconds from current time (matches web app behavior)
    const now = new Date();
    now.setSeconds(0, 0);

    if (type === 'pause') {
      // For pause duration
      if (timer.status === 'paused' && timer.pause?.startDateTime) {
        // Currently paused - show ONLY current pause duration (not total)
        const pauseStart = new Date(timer.pause.startDateTime);
        pauseStart.setSeconds(0, 0);
        const currentPauseDuration = +now - +pauseStart;
        return isNaN(currentPauseDuration) ? 0 : Math.max(0, currentPauseDuration);
      } else {
        // Running - show total accumulated break time
        return (timer.task.durationBreak || 0) * 1000;
      }
    } else if (type === 'task') {
      // Strip seconds from start time
      const taskStart = new Date(startDate);
      taskStart.setSeconds(0, 0);

      // Calculate elapsed time in milliseconds (minute precision)
      let elapsed = +now - +taskStart;

      // When showRelatives is true, subtract breaks
      if (settings.showRelatives) {
        const totalBreaks = (timer.task.durationBreak || 0) * 1000;
        elapsed = elapsed - totalBreaks;

        // If currently paused, also subtract the current pause duration
        if (timer.status === 'paused' && timer.pause?.startDateTime) {
          const pauseStart = new Date(timer.pause.startDateTime);
          pauseStart.setSeconds(0, 0);
          const currentPauseDuration = +now - +pauseStart;
          elapsed = elapsed - currentPauseDuration;
        }
      }

      return isNaN(elapsed) ? 0 : Math.max(0, elapsed);
    }

    return 0;
  };

  // Calculate initial duration immediately
  const [seconds, setSeconds] = useState(() => {
    const initialStartDate =
      type === 'task'
        ? new Date(timer.task?.startDateTime || Date.now())
        : new Date(timer.pause?.startDateTime || Date.now());
    return calculateDuration(initialStartDate, timer);
  });

  useEffect(() => {
    // Update immediately
    const currentStartDate =
      type === 'task'
        ? new Date(timer.task?.startDateTime || Date.now())
        : new Date(timer.pause?.startDateTime || Date.now());
    setSeconds(calculateDuration(currentStartDate, timer));

    // Calculate milliseconds until the next full minute
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    let interval: NodeJS.Timeout | null = null;

    // Schedule first update at the next full minute
    const initialTimeout = setTimeout(() => {
      const currentStartDate =
        type === 'task'
          ? new Date(timer.task?.startDateTime || Date.now())
          : new Date(timer.pause?.startDateTime || Date.now());
      setSeconds(calculateDuration(currentStartDate, timer));

      // Then update every minute on the minute boundary
      interval = setInterval(() => {
        const currentStartDate =
          type === 'task'
            ? new Date(timer.task?.startDateTime || Date.now())
            : new Date(timer.pause?.startDateTime || Date.now());
        setSeconds(calculateDuration(currentStartDate, timer));
      }, 60000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(initialTimeout);
      if (interval) clearInterval(interval);
    };
  }, [timer, settings, type, startDate]);

  const fractionVal = startDate
    ? seconds / HOUR_MS
    : (timer.task?.durationBreak || 0) * 1000 || 0;

  if (!timer.task) {
    return <span>0</span>;
  }

  switch (settings.durationFormat) {
    case 'XX.XX':
      return <span>{`${fractionVal.toFixed(2)}`}</span>;
    case 'XX.XX h':
      return <span>{`${fractionVal.toFixed(2)}h`}</span>;
    default:
      return formatMMHHSS(
        startDate ? seconds : (timer?.task?.durationBreak || 0) * 1000 || 0
      );
  }
}
