/**
 * TaskListItem Component
 * Displays a single task entry with horizontal layout matching the web app
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Task } from '../../types';
import { intToHexColor } from '../../utils.ts';
import { useLocale, useTimeZone } from '../../hooks';
import { calendarDateOf, formatDate, formatTime } from '../../format';
import { TagList } from '../TagList';

interface TaskListItemProps {
  task: Task;
  theme: 'light' | 'dark';
}

export default function TaskListItem({ task, theme }: TaskListItemProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const timeZone = useTimeZone();

  // Time of day in the host's locale and time zone
  const timeOf = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return formatTime(isoString, locale, timeZone);
    } catch {
      return '';
    }
  };

  // Format duration as H:MM
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  // The entry ends on another day than it started, as the user sees the days
  const endDay = task.startDateTime && task.endDateTime && calendarDateOf(task.endDateTime, timeZone);
  const hasMultipleDays = !!endDay && calendarDateOf(task.startDateTime!, timeZone) !== endDay;

  const startTime = timeOf(task.startDateTime);
  const endTime = timeOf(task.endDateTime);
  const duration = formatDuration(task.duration);
  const breakDuration = task.durationBreak && task.durationBreak > 0 ? formatDuration(task.durationBreak) : null;
  const projectColor = intToHexColor(task?.project?.color)

  return (
    <div className="px-4 py-2 hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors">
      {/* Table-like row with 3 columns */}
      <div className="flex items-start gap-4">
        {/* Column 1: Time range (fixed width) */}
        <div className="w-24 flex-shrink-0 text-body-small text-secondary dark:text-secondary">
          {/* 12-hour locales need two lines: break between the times, never inside one */}
          <span className="whitespace-nowrap">{startTime}</span> - <span className="whitespace-nowrap">{endTime}</span>
          {hasMultipleDays && endDay && (
            <div className="text-xs text-text-tertiary dark:text-text-tertiary mt-1">
              ({formatDate(endDay, locale)})
            </div>
          )}
        </div>

        {/* Column 2: Project info, description, tags (flexible width) */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Project color and title */}
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: projectColor }}
            />
            <div className="text-body text-text-primary dark:text-text-primary truncate">
              {task.project?.title || t('taskList.noProject')}
            </div>
          </div>

          {/* Task description */}
          {task.description && (
            <div className="text-body-small text-text-secondary dark:text-text-secondary">
              {task.description}
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <TagList tags={task.tags} truncate={true} maxLength={30} />
          )}
        </div>

        {/* Column 3: Duration (fixed width, right-aligned) */}
        <div className="w-20 flex-shrink-0 text-right">
          <div className="text-body text-text-primary dark:text-text-primary font-medium whitespace-nowrap">
            {duration}
          </div>
          {breakDuration && (
            <div className="text-body-small text-accent-text whitespace-nowrap mt-1">
              {breakDuration}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
