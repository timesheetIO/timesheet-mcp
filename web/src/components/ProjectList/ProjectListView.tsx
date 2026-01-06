/**
 * ProjectListView Component
 * Displays list of projects or empty state
 */

import React from 'react';
import {useTranslation} from 'react-i18next';
import ProjectListItem from './ProjectListItem';
import type {Project} from '../../types';

interface ProjectListViewProps {
    projects: Project[];
    totalCount: number;
    queryParams?: Record<string, any>;
    onProjectClick?: (projectId: string) => void;
    theme: 'light' | 'dark';
}

export default function ProjectListView({
                                            projects,
                                            totalCount,
                                            queryParams,
                                            onProjectClick,
                                            theme,
                                        }: ProjectListViewProps) {
    const {t} = useTranslation();

    // Build web app URL with query params
    const buildWebAppUrl = () => {
        const baseUrl = 'https://my.timesheet.io/projects';
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

    const hasMore = totalCount > 5;
    const webAppUrl = buildWebAppUrl();

    return (
        <div>
            {/* Header */}
            <div className="p-4">
                <div className="text-heading text-text-primary dark:text-text-primary mb-1">
                    {t('projectList.title')}
                </div>
                <div className="text-body-small text-text-secondary dark:text-text-secondary">
                    {t('projectList.count', {count: totalCount})}
                </div>
            </div>

            {/* Project List */}
            {projects.length === 0 ? (
                <div className="py-8 px-6 text-center">
                    <div className="mb-3 flex justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="w-16 h-16" fill="currentColor" opacity="0.3">
                            <path d="M128 480L512 480C529.7 480 544 465.7 544 448L544 208C544 190.3 529.7 176 512 176L362.7 176C348.9 176 335.4 171.5 324.3 163.2L285.9 134.4C280.4 130.2 273.6 128 266.7 128L128 128C110.3 128 96 142.3 96 160L96 448C96 465.7 110.3 480 128 480zM512 512L128 512C92.7 512 64 483.3 64 448L64 160C64 124.7 92.7 96 128 96L266.7 96C280.5 96 294 100.5 305.1 108.8L343.5 137.6C349 141.8 355.8 144 362.7 144L512 144C547.3 144 576 172.7 576 208L576 448C576 483.3 547.3 512 512 512z"/>
                        </svg>
                    </div>
                    <div className="text-body text-text-primary dark:text-text-primary mb-1">
                        {t('projectList.emptyState.title')}
                    </div>
                    <div className="text-body-small text-text-secondary dark:text-text-secondary">
                        {t('projectList.emptyState.description')}
                    </div>
                </div>
            ) : (
                <>
                    <div className="border-t border-card-border dark:border-card-border">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className="border-b border-card-border dark:border-card-border last:border-b-0"
                            >
                                <ProjectListItem
                                    project={project}
                                    onClick={onProjectClick}
                                    theme={theme}
                                />
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
                    ? t('projectList.viewAll', {count: totalCount})
                    : t('projectList.viewInTimesheet')
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
