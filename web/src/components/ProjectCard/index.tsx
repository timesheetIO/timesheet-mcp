/**
 * ProjectCard Widget - Main Entry Point
 * Handles data fetching and state management
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { useToolOutput, useTheme } from '../../hooks';
import { useApplyTheme } from '../../utils';
import ProjectCard from './ProjectCard';
import type { Project } from '../../types';
import '../../i18n';
import '../../index.css';

function ProjectCardApp() {
  const { t } = useTranslation();
  const project = useToolOutput<Project>();
  const theme = useTheme();

  // Apply theme
  useApplyTheme();

  // Loading state
  if (!project) {
    return (
      <div className="text-body-small text-text-secondary dark:text-text-secondary p-4">
        {t('projectCard.loading')}
      </div>
    );
  }

  // Error state
  if (!project.id) {
    return (
      <div className="text-body-small text-accent-danger p-4">
        {t('projectCard.error')}
      </div>
    );
  }

  return (
    <div className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl">
      <ProjectCard
        project={project}
        theme={theme}
      />
    </div>
  );
}

// Mount the component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ProjectCardApp />);
}
