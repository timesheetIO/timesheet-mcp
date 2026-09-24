/**
 * TaskList Widget - Main Entry Point
 * Displays a list of time entries/tasks grouped by date with max 5 entries
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import {useTranslation} from 'react-i18next';
import {McpAppProvider} from '../../McpAppProvider';
import {useLocale, useTheme, useTimeZone, useToolFailure, useToolOutput} from '../../hooks';
import {useApplyTheme} from '../../utils';
import {calendarDateOf, formatDate} from '../../format';
import StatusCard from '../shared/StatusCard';
import TaskListView from './TaskListView';
import type {Task} from '../../types';
import '../../i18n';
import '../../index.css';

interface TaskListData {
    tasks: Task[];
    /** Entries matching the query across all pages (the list holds one page) */
    totalCount?: number;
    queryParams?: {
        startDate?: string;
        endDate?: string;
        projectId?: string;
        projectIds?: string[];
        teamId?: string;
        teamIds?: string[];
        userIds?: string[];
        tagIds?: string[];
        organizationId?: string;
        running?: boolean;
        sort?: string;
        order?: string;
        filter?: string;
        type?: string;
        limit?: number;
        page?: number;
    };
}

interface TaskGroup {
    date: string;
    dateDisplay: string;
    tasks: Task[];
    totalDuration: number;
}

function TaskListApp() {
    const {t} = useTranslation();
    const taskData = useToolOutput<TaskListData>();
    const failure = useToolFailure();
    const theme = useTheme();
    const locale = useLocale();
    const timeZone = useTimeZone();

    // Apply theme
    useApplyTheme();

    if (failure) {
        return <StatusCard status={failure}/>;
    }

    // Loading state
    if (!taskData || !taskData.tasks) {
        return (
            <div
                className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl p-4">
                <div className="text-body-small text-secondary dark:text-secondary">
                    {t('taskList.loading')}
                </div>
            </div>
        );
    }

    // Group tasks by date
    const groupTasksByDate = (tasks: Task[]): TaskGroup[] => {
        const groups = new Map<string, TaskGroup>();

        tasks.forEach((task) => {
            if (!task.startDateTime) return;

            // The day the entry started for the user (YYYY-MM-DD), for grouping
            const date = calendarDateOf(task.startDateTime, timeZone);

            if (!groups.has(date)) {
                // The date in the host's locale, e.g. "Tue, Sep 23" or "Di., 23. Sept."
                const dateDisplay = formatDate(date, locale);

                groups.set(date, {
                    date,
                    dateDisplay,
                    tasks: [],
                    totalDuration: 0,
                });
            }

            const group = groups.get(date)!;
            group.tasks.push(task);
            group.totalDuration += task.duration || 0;
        });

        // Convert to array and sort by date (most recent first)
        return Array.from(groups.values()).sort((a, b) =>
            b.date.localeCompare(a.date)
        );
    };

    // Limit to first 5 tasks total
    const limitTaskGroups = (groups: TaskGroup[], limit: number): TaskGroup[] => {
        const limitedGroups: TaskGroup[] = [];
        let totalTasks = 0;

        for (const group of groups) {
            if (totalTasks >= limit) break;

            const remainingSlots = limit - totalTasks;
            const tasksToTake = Math.min(group.tasks.length, remainingSlots);

            if (tasksToTake > 0) {
                limitedGroups.push({
                    ...group,
                    tasks: group.tasks.slice(0, tasksToTake),
                    // Recalculate total duration for limited tasks
                    totalDuration: group.tasks
                        .slice(0, tasksToTake)
                        .reduce((sum, t) => sum + (t.duration || 0), 0),
                });
                totalTasks += tasksToTake;
            }
        }

        return limitedGroups;
    };

    const allGroups = groupTasksByDate(taskData.tasks);
    const displayGroups = limitTaskGroups(allGroups, 5);
    // The whole result, not only the page the list holds
    const totalCount = taskData.totalCount ?? taskData.tasks.length;

    return (
        <div
            className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl">
            <TaskListView
                taskGroups={displayGroups}
                totalCount={totalCount}
                startDate={taskData.queryParams?.startDate}
                endDate={taskData.queryParams?.endDate}
                queryParams={taskData.queryParams}
                theme={theme}
            />
        </div>
    );
}

// Mount the component
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <McpAppProvider appName="TaskList">
            <TaskListApp/>
        </McpAppProvider>
    );
}
