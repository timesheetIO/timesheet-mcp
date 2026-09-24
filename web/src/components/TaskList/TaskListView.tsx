/**
 * TaskListView Component
 * Displays tasks grouped by date with date headers
 */

import React from 'react';
import {useTranslation} from 'react-i18next';
import ExternalLinkButton from '../shared/ExternalLinkButton';
import {useLocale} from '../../hooks';
import {formatDate, formatDateRange, formatNumber} from '../../format';
import TaskListItem from './TaskListItem';
import type {Task} from '../../types';

interface TaskGroup {
    date: string;
    dateDisplay: string;
    tasks: Task[];
    totalDuration: number;
}

interface TaskListViewProps {
    taskGroups: TaskGroup[];
    totalCount: number;
    startDate?: string;
    endDate?: string;
    queryParams?: Record<string, any>;
    theme: 'light' | 'dark';
}

export default function TaskListView({
                                         taskGroups,
                                         totalCount,
                                         startDate,
                                         endDate,
                                         queryParams,
                                         theme,
                                     }: TaskListViewProps) {
    const {t} = useTranslation();
    const locale = useLocale();

    // Date range for the subtitle. The dates are calendar dates (YYYY-MM-DD): parsed as local
    // days, since new Date('2026-10-12') is UTC midnight and shows the day before west of UTC.
    const describeDateRange = () => {
        if (!startDate && !endDate) return null;

        const formatDay = (dateString: string) => {
            try {
                return formatDate(dateString, locale, {weekday: undefined});
            } catch {
                return dateString;
            }
        };

        if (startDate && endDate) {
            try {
                return formatDateRange(startDate, endDate, locale);
            } catch {
                return `${startDate} - ${endDate}`;
            }
        }
        if (startDate) {
            return t('taskList.dateRange.from', {date: formatDay(startDate)});
        }
        if (endDate) {
            return t('taskList.dateRange.until', {date: formatDay(endDate)});
        }
        return null;
    };

    // Format duration as H:MM
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}:${minutes.toString().padStart(2, '0')}`;
    };

    // Build web app URL with query params
    const buildWebAppUrl = () => {
        const baseUrl = 'https://my.timesheet.io/tasks';
        if (!queryParams) return baseUrl;

        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    value.forEach(v => params.append(key, String(v)));
                } else {
                    params.append(key, String(value));
                }
            }
        });

        const queryString = params.toString();
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    };

    const dateRange = describeDateRange();
    const hasMore = totalCount > 5;
    const webAppUrl = buildWebAppUrl();
    const totalTasks = taskGroups.reduce((sum, group) => sum + group.tasks.length, 0);

    return (
        <div>
            {/* Header */}
            <div className="p-4">
                <div className="text-heading text-text-primary dark:text-text-primary mb-1">
                    {t('taskList.title')}
                </div>
                {dateRange && (
                    <div className="text-body-small text-text-secondary dark:text-text-secondary">
                        {dateRange}
                    </div>
                )}
            </div>

            {/* Task list grouped by date */}
            {totalTasks === 0 ? (
                <div className="py-8 px-6 text-center">
                    <div className="text-4xl mb-3">⏱️</div>
                    <div className="text-body text-text-primary dark:text-text-primary mb-1">
                        {t('taskList.emptyState.title')}
                    </div>
                    <div className="text-body-small text-text-secondary dark:text-text-secondary">
                        {t('taskList.emptyState.description')}
                    </div>
                </div>
            ) : (
                <>
                    <div className="border-t border-card-border dark:border-card-border">
                        {taskGroups.map((group) => (
                            <div key={group.date}>
                                {/* Date header */}
                                <div
                                    className="flex items-center justify-between px-4 py-2 bg-background-tertiary dark:bg-background-tertiary border-b border-card-border dark:border-card-border">
                                    <div className="text-body-small font-medium text-secondary dark:text-secondary">
                                        {group.dateDisplay}
                                    </div>
                                    <div className="text-body-small font-medium text-secondary dark:text-secondary">
                                        {formatDuration(group.totalDuration)}
                                    </div>
                                </div>

                                {/* Tasks for this date */}
                                {group.tasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="border-b border-card-border dark:border-card-border last:border-b-0"
                                    >
                                        <TaskListItem task={task} theme={theme}/>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Link to web app */}
                    <div className="border-t border-card-border dark:border-card-border px-4 py-1">
                        <ExternalLinkButton url={webAppUrl}>
                            {hasMore
                                ? t('taskList.viewAll', {count: totalCount, value: formatNumber(totalCount, locale)})
                                : t('taskList.viewInTimesheet')}
                        </ExternalLinkButton>
                    </div>
                </>
            )}
        </div>
    );
}
