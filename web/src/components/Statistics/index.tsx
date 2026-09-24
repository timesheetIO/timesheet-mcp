/**
 * Statistics Widget
 * Inline: the week (or any period) as one card, total plus hours per project, like the
 * "Weekly hours" card of the interactive demo. Expanded: the full charts, in fullscreen when
 * the host offers it and below the card otherwise.
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { ArrowsExpandIcon, ChartBarIcon, XIcon } from '@heroicons/react/outline';
import { McpAppProvider } from '../../McpAppProvider';
import { useDisplayMode, useLocale, useTheme, useToolOutput } from '../../hooks';
import { formatDateRange, formatDuration, hoursToSeconds, projectColor } from '../../format';
import Card from '../shared/Card';
import IconTile from '../shared/IconTile';
import BarList, { type BarItem } from '../shared/BarList';
import StatTotal from '../shared/StatTotal';
import Skeleton from '../shared/Skeleton';
import StatCard from './StatCard';
import ProjectBreakdown from './ProjectBreakdown';
import DailyChart from './DailyChart';
import type { Statistics } from '../../types';
import '../../i18n';
import '../../index.css';

const MAX_BARS = 6;
const formatHours = (hours: number) => formatDuration(hoursToSeconds(hours));

function Details({ stats, locale, theme }: { stats: Statistics; locale: string; theme: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const billablePercentage = stats.totalHours > 0 ? Math.round((stats.billableHours / stats.totalHours) * 100) : 0;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('statistics.totalHours')} value={formatHours(stats.totalHours)} />
        <StatCard label={t('statistics.billableHours')} value={formatHours(stats.billableHours)} accent />
        <StatCard label={t('statistics.billablePercentage')} value={`${billablePercentage}%`} />
        <StatCard label={t('statistics.entriesLabel')} value={stats.totalTasks ?? 0} />
      </div>
      {stats.projectBreakdown?.length > 0 && (
        <ProjectBreakdown projects={stats.projectBreakdown} formatHours={formatHours} theme={theme} />
      )}
      {stats.dailyHours?.length > 0 && (
        <DailyChart
          data={stats.dailyHours}
          weeklyData={stats.weeklyHours}
          formatHours={formatHours}
          theme={theme}
          locale={locale}
        />
      )}
    </div>
  );
}

function StatisticsApp() {
  const { t } = useTranslation();
  const stats = useToolOutput<Statistics>();
  const theme = useTheme();
  const locale = useLocale();
  const { mode, canFullscreen, request } = useDisplayMode();
  const [expandedInline, setExpandedInline] = useState(false);

  if (!stats || typeof stats.totalHours !== 'number') {
    return <Skeleton label={t('common.loading')} />;
  }

  const period = stats.startDate ? formatDateRange(stats.startDate, stats.endDate, locale) : undefined;
  const projects = [...(stats.projectBreakdown || [])].sort((a, b) => b.hours - a.hours);
  const items: BarItem[] = projects.slice(0, MAX_BARS).map((project, index) => ({
    key: project.projectId || `${project.projectTitle}-${index}`,
    label: project.projectTitle,
    value: project.hours,
    display: formatHours(project.hours),
    color: (project as any).color || projectColor(project.projectColor),
    // A project with time but nothing billable reads as internal work
    muted: project.hours > 0 && !(project.billableHours > 0),
  }));
  const hiddenProjects = projects.length - items.length;

  const fullscreen = mode === 'fullscreen';
  const showDetails = fullscreen || expandedInline;

  const toggle = async () => {
    if (fullscreen) {
      await request('inline');
    } else if (canFullscreen) {
      const granted = await request('fullscreen');
      if (granted !== 'fullscreen') setExpandedInline(open => !open);
    } else {
      setExpandedInline(open => !open);
    }
  };

  return (
    <div className={fullscreen ? 'max-w-3xl mx-auto p-4 grid gap-6' : 'grid gap-4'}>
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <IconTile><ChartBarIcon /></IconTile>
          <div className="flex-1 min-w-0">
            <StatTotal value={formatHours(stats.totalHours)} caption={period} />
          </div>
          <button
            type="button"
            className="ts-link-button -mt-2 -mr-1"
            onClick={toggle}
            aria-expanded={showDetails}
          >
            {showDetails ? <XIcon className="w-4 h-4" aria-hidden="true" /> : <ArrowsExpandIcon className="w-4 h-4" aria-hidden="true" />}
            {showDetails ? t('statistics.collapse') : t('statistics.expand')}
          </button>
        </div>

        {items.length > 0 ? (
          <div className="mt-4">
            <BarList items={items} />
            {hiddenProjects > 0 && (
              <p className="m-0 mt-2 text-caption text-secondary">
                {t('statistics.moreProjects', { count: hiddenProjects })}
              </p>
            )}
          </div>
        ) : (
          <p className="m-0 mt-4 text-body-small text-secondary">{t('statistics.empty')}</p>
        )}

        <p className="m-0 mt-4 text-body-small text-secondary">
          {t('statistics.billableFootnote', { duration: formatHours(stats.billableHours) })}
          {typeof stats.totalTasks === 'number' && ` · ${t('statistics.entries', { count: stats.totalTasks })}`}
        </p>
      </Card>

      {showDetails && (
        <Card tone="plain" className="p-4 sm:p-5">
          <Details stats={stats} locale={locale} theme={theme} />
        </Card>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <McpAppProvider appName="Statistics">
      <StatisticsApp />
    </McpAppProvider>
  );
}
