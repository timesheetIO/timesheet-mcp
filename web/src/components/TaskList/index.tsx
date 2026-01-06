/**
 * TaskList Widget - Main Entry Point
 * Displays a list of time entries/tasks grouped by date with max 5 entries
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import {useTranslation} from 'react-i18next';
import {useTheme, useToolOutput} from '../../hooks';
import {useApplyTheme} from '../../utils';
import TaskListView from './TaskListView';
import type {Task} from '../../types';
import '../../i18n';
import '../../index.css';

interface TaskListData {
    tasks: Task[];
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
    const theme = useTheme();

    // Apply theme
    useApplyTheme();

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

            // Get date in YYYY-MM-DD format for grouping
            const date = task.startDateTime.split('T')[0];

            if (!groups.has(date)) {
                // Format date as DD.MM.YYYY for display
                const [year, month, day] = date.split('-');
                const dateDisplay = `${day}.${month}.${year}`;

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
    const totalCount = taskData.tasks.length;

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
    root.render(<TaskListApp/>);
}
