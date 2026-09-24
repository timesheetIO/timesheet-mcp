/**
 * TaskCard Widget
 * One time entry as a result card: "Entry added" after task_create, "Entry updated" after
 * task_update, the entry itself for task_get.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { CheckIcon, ClockIcon, PencilAltIcon } from '@heroicons/react/outline';
import { McpAppProvider } from '../../McpAppProvider';
import { useLocale, useTimeZone, useToolFailure, useToolOutput } from '../../hooks';
import { formatDate, formatDuration, formatTime, projectColor } from '../../format';
import Card from '../shared/Card';
import IconTile from '../shared/IconTile';
import Badge from '../shared/Badge';
import Skeleton from '../shared/Skeleton';
import StatusCard from '../shared/StatusCard';
import type { Task } from '../../types';
import '../../i18n';
import '../../index.css';

type TaskCardData = Task & { action?: 'created' | 'updated'; durationBreak?: number; location?: string };

function TaskCardApp() {
  const { t } = useTranslation();
  const task = useToolOutput<TaskCardData>();
  const failure = useToolFailure();
  const locale = useLocale();
  const timeZone = useTimeZone();

  if (failure) {
    return <StatusCard status={failure} />;
  }

  if (!task || !task.id) {
    return <Skeleton label={t('taskCard.loading')} />;
  }

  const project = task.project as (Task['project'] & { color?: number; employer?: string }) | undefined;
  const dot = projectColor(project?.color);
  const running = !task.endDateTime;
  const start = task.startDateTime ? formatTime(task.startDateTime, locale, timeZone) : null;
  const end = task.endDateTime ? formatTime(task.endDateTime, locale, timeZone) : null;

  const title =
    task.action === 'created'
      ? t('taskCard.added')
      : task.action === 'updated'
        ? t('taskCard.updated')
        : project?.title || t('taskCard.entry');

  const icon = task.action === 'created' ? <CheckIcon /> : task.action === 'updated' ? <PencilAltIcon /> : <ClockIcon />;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <IconTile>{icon}</IconTile>
        <div className="flex-1 min-w-0">
          <h2 className="m-0 text-body font-semibold text-text-primary">{title}</h2>
          <p className="m-0 mt-0.5 text-body-small text-secondary flex items-center gap-1.5 min-w-0">
            {dot && <i className="inline-block w-2 h-2 rounded-full flex-none" style={{ background: dot }} aria-hidden="true" />}
            <span className="truncate">
              {project?.title || t('taskList.noProject')}
              {project?.employer ? ` · ${project.employer}` : ''}
            </span>
          </p>
        </div>
        <span className="font-mono tabular-nums text-[22px] sm:text-[24px] leading-none pt-1 text-accent-text whitespace-nowrap">
          {formatDuration(task.duration || 0, locale)}
        </span>
      </div>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mt-3 pl-0 min-[480px]:pl-[60px] text-caption text-secondary">
        {task.startDateTime && <span>{formatDate(task.startDateTime, locale, {}, timeZone)}</span>}
        {start && (
          <span className="tabular-nums">
            {running ? t('timerWidget.runningSince', { time: start }) : `${start} - ${end}`}
          </span>
        )}
        {(task.durationBreak || 0) > 0 && (
          <span>{t('taskCard.breaks', { duration: formatDuration(task.durationBreak || 0, locale) })}</span>
        )}
        {task.billable === true && <Badge tone="success">{t('taskList.billable')}</Badge>}
        {task.billable === false && <Badge tone="neutral">{t('taskList.nonBillable')}</Badge>}
      </div>

      {task.description && (
        <p className="m-0 mt-3 pl-0 min-[480px]:pl-[60px] text-body-small text-text-primary whitespace-pre-line break-words">
          {task.description}
        </p>
      )}
    </Card>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <McpAppProvider appName="TaskCard">
      <TaskCardApp />
    </McpAppProvider>
  );
}
