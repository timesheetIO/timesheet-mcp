/**
 * ProjectList Widget - Main Entry Point
 * Handles data fetching and state management
 */

import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useTranslation} from 'react-i18next';
import {McpAppProvider} from '../../McpAppProvider';
import {useTheme, useToolFailure, useToolOutput} from '../../hooks';
import {useApplyTheme} from '../../utils';
import StatusCard from '../shared/StatusCard';
import ProjectListView from './ProjectListView';
import type {Project} from '../../types';
import '../../i18n';
import '../../index.css';

interface ProjectListData {
    projects: Project[];
    totalCount: number;
    queryParams?: Record<string, any>;
}

// Main app component
function ProjectListApp() {
    const {t} = useTranslation();
    const initialData = useToolOutput<ProjectListData>();
    const failure = useToolFailure();
    const theme = useTheme();
    const [projectData, setProjectData] = useState<ProjectListData | null>(null);

    useApplyTheme();

    // Initialize local state from tool output
    useEffect(() => {
        if (initialData) {
            setProjectData(initialData);
        }
    }, [initialData]);

    if (failure) {
        return <StatusCard status={failure}/>;
    }

    // Loading state
    if (!projectData) {
        return (
            <div
                className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl p-4">
                <div className="text-body-small text-secondary dark:text-secondary">
                    {t('projectList.loading')}
                </div>
            </div>
        );
    }

    // A result without projects
    if (!projectData.projects) {
        return <StatusCard status="error" message={t('projectList.error')}/>;
    }

    return (
        <div
            className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl">
            <ProjectListView
                projects={projectData.projects}
                totalCount={projectData.totalCount}
                queryParams={projectData.queryParams}
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
        <McpAppProvider appName="ProjectList">
            <ProjectListApp/>
        </McpAppProvider>
    );
}
