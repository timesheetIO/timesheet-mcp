/**
 * ProjectCard Component
 * Displays detailed information about a single project
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { intToHexColor } from '../../utils';
import type { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  onBack?: () => void;
  theme: 'light' | 'dark';
}

export default function ProjectCard({ project, onBack, theme }: ProjectCardProps) {
  const { t } = useTranslation();

  // Calculate hours and minutes from duration (in seconds)
  const hours = project.duration ? Math.floor(project.duration / 3600) : 0;
  const minutes = project.duration ? Math.floor((project.duration % 3600) / 60) : 0;

  return (
    <div className="p-4">
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 text-body-small text-secondary dark:text-secondary hover:text-text-primary dark:hover:text-text-primary transition-colors"
        >
          {t('projectCard.backButton')}
        </button>
      )}

      {/* Project header with color indicator */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-2 h-16 flex-shrink-0 rounded-sm"
          style={{ backgroundColor: intToHexColor(project.color) }}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-heading text-text-primary dark:text-text-primary mb-1 break-words">
            {project.title}
          </h2>
          {project.employer && (
            <p className="text-body text-secondary dark:text-secondary mb-1">
              {project.employer}
            </p>
          )}
          {project.archived && (
            <span className="inline-block px-2 py-0.5 text-caption bg-background-secondary dark:bg-background-secondary text-secondary dark:text-secondary rounded-sm">
              {t('projectList.archived')}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <div className="mb-4">
          <div className="text-body-small text-secondary dark:text-secondary mb-1 font-semibold">
            {t('projectCard.sections.description')}
          </div>
          <p className="text-body text-text-primary dark:text-text-primary">
            {project.description}
          </p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Total Duration */}
        {(hours > 0 || minutes > 0) && (
          <div className="p-3 bg-background-secondary dark:bg-background-secondary rounded-lg">
            <div className="text-caption text-secondary dark:text-secondary mb-1">
              {t('projectCard.stats.totalTime')}
            </div>
            <div className="text-body text-text-primary dark:text-text-primary font-bold">
              {hours > 0 && t('common.hours', { count: hours })}
              {hours > 0 && minutes > 0 && ' '}
              {minutes > 0 && t('common.minutes', { count: minutes })}
            </div>
          </div>
        )}

        {/* Office */}
        {project.office && (
          <div className="p-3 bg-background-secondary dark:bg-background-secondary rounded-lg">
            <div className="text-caption text-secondary dark:text-secondary mb-1">
              {t('projectCard.stats.office')}
            </div>
            <div className="text-body text-text-primary dark:text-text-primary">
              {project.office}
            </div>
          </div>
        )}

        {/* Default Billable */}
        {typeof project.taskDefaultBillable !== 'undefined' && (
          <div className="p-3 bg-background-secondary dark:bg-background-secondary rounded-lg">
            <div className="text-caption text-secondary dark:text-secondary mb-1">
              {t('projectCard.stats.defaultBillable')}
            </div>
            <div className="text-body text-text-primary dark:text-text-primary">
              {project.taskDefaultBillable ? t('projectCard.billable.yes') : t('projectCard.billable.no')}
            </div>
          </div>
        )}
      </div>

      {/* Team information */}
      {project.team && (
        <div className="mb-4">
          <div className="text-body-small text-secondary dark:text-secondary mb-1 font-semibold">
            {t('projectCard.sections.team')}
          </div>
          <p className="text-body text-text-primary dark:text-text-primary">
            {project.team.name}
          </p>
        </div>
      )}
    </div>
  );
}
