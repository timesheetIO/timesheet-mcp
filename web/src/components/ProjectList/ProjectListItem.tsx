/**
 * ProjectListItem Component
 * Displays a single project in a list with start timer button
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { intToHexColor } from '../../utils';
import type { Project } from '../../types';

interface ProjectListItemProps {
  project: Project;
  onClick?: (projectId: string) => void;
  theme: 'light' | 'dark';
}

export default function ProjectListItem({ project, onClick, theme }: ProjectListItemProps) {
  const { t } = useTranslation();

  // Calculate hours and minutes from duration (in seconds)
  const hours = project.duration ? Math.floor(project.duration / 3600) : 0;
  const minutes = project.duration ? Math.floor((project.duration % 3600) / 60) : 0;

  // Get project color or default gray for archived
  const folderColor = project.archived ? '#9CA3AF' : intToHexColor(project.color);

  return (
    <div
      className={`flex items-center gap-3 px-4 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-background-secondary dark:hover:bg-background-secondary' : ''
      }`}
      onClick={onClick ? () => onClick(project.id) : undefined}
    >
      {/* Folder icon */}
      <div className="flex-shrink-0 w-6 h-6">
        {project.archived ? (
          // Closed folder icon
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="w-full h-full" fill={folderColor}>
            <path d="M512 480L128 480C110.3 480 96 465.7 96 448L96 288L544 288L544 448C544 465.7 529.7 480 512 480zM544 256L96 256L96 160C96 142.3 110.3 128 128 128L266.7 128C273.6 128 280.4 130.2 285.9 134.4L324.3 163.2C335.4 171.5 348.9 176 362.7 176L512 176C529.7 176 544 190.3 544 208L544 256zM128 512L512 512C547.3 512 576 483.3 576 448L576 208C576 172.7 547.3 144 512 144L362.7 144C355.8 144 349 141.8 343.5 137.6L305.1 108.8C294 100.5 280.5 96 266.7 96L128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512z"/>
          </svg>
        ) : (
          // Open folder icon
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className="w-full h-full" fill={folderColor}>
            <path d="M129.5 480C118.7 480 111 469.5 114.2 459.2L164.2 299.2C166.3 292.5 172.5 288 179.5 288L559 288C569.8 288 577.5 298.5 574.3 308.8L524.3 468.8C522.1 475.5 516 480 509 480L129.5 480zM256.2 512L509 512C530 512 548.6 498.4 554.8 478.3L604.8 318.3C614.5 287.4 591.4 256 559 256L179.6 256C158.6 256 140 269.6 133.8 289.7L96.2 409.6L96.2 160C96.2 142.3 110.5 128 128.2 128L266.9 128C273.8 128 280.6 130.2 286.1 134.4L324.5 163.2C335.6 171.5 349.1 176 362.9 176L480.2 176C497.9 176 512.2 190.3 512.2 208L544.2 208C544.2 172.7 515.5 144 480.2 144L362.9 144C356 144 349.2 141.8 343.7 137.6L305.3 108.8C294.2 100.5 280.8 96 266.9 96L128.2 96C92.9 96 64.2 124.7 64.2 160L64.2 448C64.2 483.3 92.9 512 128.2 512L256.2 512z"/>
          </svg>
        )}
      </div>

      {/* Project info */}
      <div className="flex-1 min-w-0 py-2">
        <div className="text-body text-text-primary dark:text-text-primary truncate">
          {project.title}
        </div>
        {project.employer && (
          <div className="text-body-small text-secondary dark:text-secondary truncate mt-0.5">
            {project.employer}
          </div>
        )}
        {project.archived && (
          <div className="inline-block mt-1 px-2 py-0.5 text-caption bg-background-secondary dark:bg-background-secondary text-secondary dark:text-secondary rounded-sm">
            {t('projectList.archived')}
          </div>
        )}
      </div>

      {/* Duration display */}
      <div className="flex-shrink-0 text-body text-text-primary dark:text-text-primary font-bold">
        {hours > 0 && t('common.hours', { count: hours })}
        {hours > 0 && minutes > 0 && ' '}
        {minutes > 0 && t('common.minutes', { count: minutes })}
      </div>
    </div>
  );
}
