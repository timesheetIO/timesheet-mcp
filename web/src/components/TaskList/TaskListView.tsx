/**
 * TaskListView Component
 * Displays tasks grouped by date with date headers
 */

import React from 'react';
import {useTranslation} from 'react-i18next';
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

    // Format date range for subtitle
    const formatDateRange = () => {
        if (!startDate && !endDate) return null;

        const formatDate = (dateString: string) => {
            try {
                return new Date(dateString).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
            } catch {
                return dateString;
            }
        };

        if (startDate && endDate) {
            return `${formatDate(startDate)} - ${formatDate(endDate)}`;
        }
        if (startDate) {
            return t('taskList.dateRange.from', {date: formatDate(startDate)});
        }
        if (endDate) {
            return t('taskList.dateRange.until', {date: formatDate(endDate)});
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

    const dateRange = formatDateRange();
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
                    <div className="border-t border-card-border dark:border-card-border p-4">
                        <a
                            href={webAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-500 hover:underline flex items-center justify-center gap-1 text-body-small"
                        >
                            <span>
                              {hasMore
                                  ? t('taskList.viewAll', {count: totalCount})
                                  : t('taskList.viewInTimesheet')
                              }
                            </span>
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                            </svg>
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}
