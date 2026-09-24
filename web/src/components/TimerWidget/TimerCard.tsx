/**
 * TimerCard - the running, paused or just stopped timer as a compact card, in the look of the
 * "Timer running" card of the interactive demo. Two actions at most; everything else sits
 * behind "More".
 */

import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ClockIcon, CheckIcon, DotsHorizontalIcon} from '@heroicons/react/outline';
import {useData} from './DataProvider';
import {useViewRouter} from './ViewRouter';
import {useTimerOperations} from '../../utils/timesheet-hooks';
import {useCanCallServerTools, useLocale, useTimeZone, useUpdateModelContext} from '../../hooks';
import {formatDuration, formatTime, projectColor, toOffsetISOString} from '../../format';
import Card from '../shared/Card';
import IconTile from '../shared/IconTile';
import Badge from '../shared/Badge';
import Clock from '../shared/Clock';
import ActionRow, {Button} from '../shared/ActionRow';
import type {ExtendedTimer, TimerTask} from '../../utils/types';

/**
 * Timestamps without seconds, as the web app writes them, with the local offset: the API keeps the
 * offset it receives, and a UTC time would file the entry under the wrong day near midnight
 */
function nowWithoutSeconds(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return toOffsetISOString(now);
}

/** The entry as it was when the user stopped it, for servers that do not send the saved one */
function entryStoppedAt(task: TimerTask, endDateTime: string): TimerTask {
  const start = task.startDateTime ? Date.parse(task.startDateTime) : NaN;
  const duration = Number.isFinite(start)
    ? Math.max(0, Math.round((Date.parse(endDateTime) - start) / 1000))
    : task.duration;
  return {...task, endDateTime, duration};
}

export default function TimerCard({justStopped}: {justStopped?: boolean}) {
  const {t} = useTranslation();
  const locale = useLocale();
  const timeZone = useTimeZone();
  const {timer, stoppedTask, settings, applyTimer} = useData();
  const {navigate} = useViewRouter();
  const timerOps = useTimerOperations();
  const updateModelContext = useUpdateModelContext();
  const canCallTools = useCanCallServerTools();
  const [busy, setBusy] = useState<null | 'pause' | 'resume' | 'stop' | 'start'>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const status = timer?.status;
  const active = status === 'running' || status === 'paused';
  // A stopped timer has no task: the summary shows the entry the stop saved
  const task = active ? timer?.task : (stoppedTask ?? timer?.task);
  const project = task?.project;
  const projectTitle = project?.title || t('timerWidget.noProject');
  const relative = settings.showRelatives !== false;
  // A finished entry's duration includes its breaks; the relative view leaves them out, as the clock did
  const finishedSeconds = Math.max(0, (task?.duration || 0) - (relative ? task?.durationBreak || 0 : 0));

  // Net working time: breaks are left out when the user shows relative durations
  const elapsedAt = useCallback(
    (now: number) => {
      if (!task?.startDateTime) return 0;
      if (status !== 'running' && status !== 'paused') {
        return finishedSeconds * 1000;
      }
      let elapsed = now - Date.parse(task.startDateTime);
      if (relative) {
        elapsed -= (task.durationBreak || 0) * 1000;
        if (status === 'paused' && timer?.pause?.startDateTime) {
          elapsed -= now - Date.parse(timer.pause.startDateTime);
        }
      }
      return Math.max(0, elapsed);
    },
    [task?.startDateTime, task?.durationBreak, finishedSeconds, status, relative, timer?.pause?.startDateTime]
  );

  const act = (action: 'pause' | 'resume' | 'stop' | 'start') => async () => {
    if (busy || !task) return;
    setBusy(action);
    setActionError(null);
    try {
      const at = nowWithoutSeconds();
      if (action === 'stop') {
        const stopped = await timerOps.stop({endDateTime: at});
        applyTimer(stopped.timer as unknown as ExtendedTimer, stopped.stoppedTask ?? entryStoppedAt(task, at));
      } else {
        let next: ExtendedTimer | undefined;
        if (action === 'pause') next = (await timerOps.pause({startDateTime: at})) as unknown as ExtendedTimer;
        if (action === 'resume') next = (await timerOps.resume({endDateTime: at})) as unknown as ExtendedTimer;
        if (action === 'start' && project?.id) {
          next = (await timerOps.start({projectId: project.id, startDateTime: at})) as unknown as ExtendedTimer;
        }
        applyTimer(next);
      }
      // The model learns what happened without the user sending a message. A failed call
      // throws before this line, so the model never hears of an action that did not happen.
      const time = formatTime(at, 'en', timeZone);
      const done = {
        pause: `The user paused the timer on ${projectTitle} at ${time}.`,
        resume: `The user resumed the timer on ${projectTitle} at ${time}.`,
        stop: `The user stopped the timer on ${projectTitle} at ${time}.`,
        start: `The user started a new timer on ${projectTitle} at ${time}.`,
      }[action];
      updateModelContext(done);
    } catch (err) {
      console.error('[TimerCard] action failed:', err);
      setActionError(t('timerWidget.actionFailed'));
    } finally {
      setBusy(null);
    }
  };

  const title = useMemo(() => {
    if (status === 'running') return t('timerWidget.title.running', {project: projectTitle});
    if (status === 'paused') return t('timerWidget.title.paused', {project: projectTitle});
    return t('timerWidget.title.stopped', {project: projectTitle});
  }, [status, projectTitle, t]);

  if (!timer || !task) return null;

  const started = task.startDateTime ? formatTime(task.startDateTime, locale, timeZone) : null;
  const ended = task.endDateTime ? formatTime(task.endDateTime, locale, timeZone) : null;
  const pausedAt = timer.pause?.startDateTime ? formatTime(timer.pause.startDateTime, locale, timeZone) : null;
  const dot = projectColor(project?.color as any);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <IconTile>{active ? <ClockIcon /> : <CheckIcon />}</IconTile>
        <div className="flex-1 min-w-0">
          <h2 className="m-0 text-body font-semibold text-text-primary text-balance">{title}</h2>
          <p className="m-0 mt-0.5 text-body-small text-secondary truncate">
            {task.description || t('timerWidget.noDescription')}
          </p>
        </div>
        <Clock
          elapsedAt={elapsedAt}
          running={status === 'running' || (status === 'paused' && !relative)}
          className="text-[22px] sm:text-[26px] leading-none pt-1"
        />
      </div>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-3 pl-0 min-[480px]:pl-[60px] text-caption text-secondary">
        {status === 'running' && <Badge tone="success">{t('timerWidget.status.running')}</Badge>}
        {status === 'paused' && <Badge tone="warning">{t('timerWidget.status.paused')}</Badge>}
        {!active && <Badge tone="neutral">{t('timerWidget.status.stopped')}</Badge>}
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {dot && <i className="inline-block w-2 h-2 rounded-full flex-none" style={{background: dot}} aria-hidden="true" />}
          <span className="truncate">
            {project?.title}
            {project?.employer ? ` · ${project.employer}` : ''}
          </span>
        </span>
        <span className="tabular-nums">
          {status === 'paused' && pausedAt
            ? t('timerWidget.pausedSince', {time: pausedAt})
            : active && started
              ? t('timerWidget.runningSince', {time: started})
              : started && ended
                ? `${started} - ${ended} · ${formatDuration(finishedSeconds, locale)}`
                : null}
        </span>
      </div>

      {actionError && (
        <p className="m-0 mt-3 text-body-small text-accent-danger" role="alert">{actionError}</p>
      )}

      {/* Every action calls a server tool: a host that cannot proxy tool calls gets none */}
      {canCallTools && (active ? (
        <div className="mt-4">
          <ActionRow>
            {status === 'running' ? (
              <Button onClick={act('pause')} disabled={!!busy}>
                {busy === 'pause' ? t('common.working') : t('timerWidget.controls.pause')}
              </Button>
            ) : (
              <Button variant="primary" onClick={act('resume')} disabled={!!busy}>
                {busy === 'resume' ? t('common.working') : t('timerWidget.controls.resume')}
              </Button>
            )}
            <Button variant="danger" onClick={act('stop')} disabled={!!busy}>
              {busy === 'stop' ? t('common.working') : t('timerWidget.controls.stop')}
            </Button>
          </ActionRow>
          <div className="flex justify-center mt-1">
            <button type="button" className="ts-link-button" onClick={() => navigate('actions')}>
              <DotsHorizontalIcon className="w-4 h-4" aria-hidden="true" />
              {t('timerWidget.more')}
            </button>
          </div>
        </div>
      ) : (
        justStopped !== false && project?.id && (
          <div className="mt-4">
            <ActionRow>
              <Button onClick={act('start')} disabled={!!busy}>
                {busy === 'start' ? t('common.working') : t('timerWidget.startAgain')}
              </Button>
            </ActionRow>
          </div>
        )
      ))}
    </Card>
  );
}
