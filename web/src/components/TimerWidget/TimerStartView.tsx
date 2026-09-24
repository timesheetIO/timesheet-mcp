/**
 * TimerStartView - no timer running: pick a project and start one.
 * A native select keeps the project list inside the host's rules for inline widgets
 * (no popover that the host would clip).
 */

import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ClockIcon} from '@heroicons/react/outline';
import {SelectorIcon} from '@heroicons/react/solid';
import {useData} from './DataProvider';
import {useTimerOperations} from '../../utils/timesheet-hooks';
import {useTimeZone, useUpdateModelContext} from '../../hooks';
import {formatTime} from '../../format';
import Card from '../shared/Card';
import IconTile from '../shared/IconTile';
import ActionRow, {Button} from '../shared/ActionRow';
import {SkeletonLine} from '../shared/Skeleton';
import type {ExtendedTimer} from '../../utils/types';

export default function TimerStartView() {
  const {t} = useTranslation();
  const timeZone = useTimeZone();
  const {projects, projectsLoaded, selectedProject, setSelectedProject, applyTimer} = useData();
  const timerOps = useTimerOperations();
  const updateModelContext = useUpdateModelContext();
  const [projectId, setProjectId] = useState<string>(selectedProject || '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setError(null);
    if (!projectId) {
      setError(t('timerWidget.pickProject'));
      return;
    }
    setStarting(true);
    try {
      const now = new Date();
      now.setSeconds(0, 0);
      const at = now.toISOString();
      const started = await timerOps.start({projectId, startDateTime: at});
      setSelectedProject(projectId);
      applyTimer(started as unknown as ExtendedTimer);
      const title = projects.find(p => p.id === projectId)?.title || 'a project';
      updateModelContext(`The user started a timer on ${title} at ${formatTime(at, 'en', timeZone)}.`);
    } catch (err) {
      console.error('[TimerStartView] Failed to start timer:', err);
      setError(t('timerWidget.actionFailed'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card tone="plain" className="p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <IconTile><ClockIcon /></IconTile>
        <div className="flex-1 min-w-0">
          <h2 className="m-0 text-body font-semibold text-text-primary">{t('timerWidget.idle.title')}</h2>
          <p className="m-0 mt-0.5 text-body-small text-secondary">{t('timerWidget.idle.subtitle')}</p>
        </div>
      </div>

      <div className="mt-4 pl-0 min-[480px]:pl-[60px] grid gap-3">
        {!projectsLoaded ? (
          <SkeletonLine height={40} />
        ) : projects.length === 0 ? (
          <p className="m-0 text-body-small text-secondary">{t('timerWidget.noProjectsYet')}</p>
        ) : (
          <>
            <label className="grid gap-1.5">
              <span className="text-caption font-medium text-secondary">{t('timerWidget.project')}</span>
              {/* Native select (its list can't be clipped by the host), styled like the shared Select */}
              <span className="relative block">
                <select
                  value={projectId}
                  onChange={event => setProjectId(event.target.value)}
                  className="block w-full min-h-[40px] appearance-none rounded-xl border border-border bg-background-primary pl-3 pr-10 text-sm text-text-primary cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/100 focus:border-primary/100"
                >
                  <option value="">{t('timerWidget.pickProject')}</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}{project.employer ? ` · ${project.employer}` : ''}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <SelectorIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                </span>
              </span>
            </label>
            {error && <p className="m-0 text-body-small text-accent-danger" role="alert">{error}</p>}
            <ActionRow>
              <Button variant="primary" onClick={handleStart} disabled={starting}>
                {starting ? t('common.working') : t('timerWidget.controls.start')}
              </Button>
            </ActionRow>
          </>
        )}
      </div>
    </Card>
  );
}
