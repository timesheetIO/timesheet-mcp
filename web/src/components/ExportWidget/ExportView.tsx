/**
 * ExportView - Main UI Component
 * Displays template selector, date range inputs, and generate button
 */

import React from 'react';
import type { ExportTemplate } from './index';
import TemplateSelect from './TemplateSelect';
import Badge from '../shared/Badge';
import { toCalendarDate } from '../../format';
import { useOpenLink } from '../../hooks';
import { useTranslation } from 'react-i18next';

interface ExportViewProps {
  templates: ExportTemplate[];
  selectedTemplateId: string;
  onTemplateChange: (templateId: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  result: { success: boolean; message: string; downloadUrl?: string } | null;
  theme: 'light' | 'dark';
}

export default function ExportView({
  templates,
  selectedTemplateId,
  onTemplateChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onGenerate,
  isLoading,
  result,
  theme,
}: ExportViewProps) {
  const { t } = useTranslation();
  const selectedTemplate = templates.find(template => template.id === selectedTemplateId);
  const openLink = useOpenLink();

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h2 className="text-heading font-semibold text-text-primary">
          {t('exportWidget.title')}
        </h2>
      </div>

      {/* Template Selection */}
      <div className="space-y-2">
        <label className="block text-body-small font-medium text-secondary dark:text-secondary">
          {t('exportWidget.template')}
        </label>
        <TemplateSelect
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onChange={onTemplateChange}
          theme={theme}
        />
      </div>

      {/* Template Details */}
      {selectedTemplate && (
        <div className="flex flex-wrap gap-2">
          {selectedTemplate.format && <Badge tone="accent">{selectedTemplate.format.toUpperCase()}</Badge>}
          {selectedTemplate.summarize && <Badge tone="success">{t('exportWidget.summarized')}</Badge>}
          {selectedTemplate.splitTask && <Badge tone="warning">{t('exportWidget.splitTasks')}</Badge>}
          {selectedTemplate.filter && selectedTemplate.filter !== 'all' && <Badge>{selectedTemplate.filter}</Badge>}
        </div>
      )}

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-body-small font-medium text-secondary dark:text-secondary">
            {t('exportWidget.startDate')}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-card-border dark:border-card-border bg-card-bg dark:bg-card-bg text-text-primary text-body-small focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-body-small font-medium text-secondary dark:text-secondary">
            {t('exportWidget.endDate')}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-card-border dark:border-card-border bg-card-bg dark:bg-card-bg text-text-primary text-body-small focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {/* Quick Date Presets */}
      <div className="flex flex-wrap gap-2">
        <QuickDateButton
          label={t('exportWidget.presets.thisMonth')}
          onClick={() => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            onStartDateChange(formatDate(start));
            onEndDateChange(formatDate(now));
          }}
        />
        <QuickDateButton
          label={t('exportWidget.presets.lastMonth')}
          onClick={() => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            onStartDateChange(formatDate(start));
            onEndDateChange(formatDate(end));
          }}
        />
        <QuickDateButton
          label={t('exportWidget.presets.thisWeek')}
          onClick={() => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const start = new Date(now);
            start.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            onStartDateChange(formatDate(start));
            onEndDateChange(formatDate(now));
          }}
        />
        <QuickDateButton
          label={t('exportWidget.presets.lastWeek')}
          onClick={() => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const end = new Date(now);
            end.setDate(now.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek));
            const start = new Date(end);
            start.setDate(end.getDate() - 6);
            onStartDateChange(formatDate(start));
            onEndDateChange(formatDate(end));
          }}
        />
      </div>

      {/* Result Message */}
      {result && (
        <div
          className={`p-3 rounded-lg text-body-small ${
            result.success
              ? 'bg-accent-success/10 text-accent-success'
              : 'bg-accent-danger/10 text-accent-danger'
          }`}
        >
          {result.message}
          {result.downloadUrl && (
            <button
              type="button"
              onClick={() => openLink(result.downloadUrl!)}
              className="ml-2 underline font-medium bg-transparent border-0 p-0 cursor-pointer text-inherit"
            >
              {t('exportWidget.download')}
            </button>
          )}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={!selectedTemplateId || isLoading}
        type="button"
        className="ts-button ts-button-primary w-full"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {t('exportWidget.generating')}
          </span>
        ) : (
          t('exportWidget.generate')
        )}
      </button>

      {/* Empty State */}
      {templates.length === 0 && (
        <div className="text-center py-6 text-secondary dark:text-secondary">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-body-small">{t('exportWidget.empty')}</p>
          <p className="text-xs mt-1">{t('exportWidget.emptyHint')}</p>
        </div>
      )}
    </div>
  );
}

// Quick date preset button
function QuickDateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="min-h-[44px] px-3 text-xs rounded bg-background-secondary hover:bg-background-tertiary text-secondary transition-colors"
    >
      {label}
    </button>
  );
}

// Format date to YYYY-MM-DD
function formatDate(date: Date): string {
  return toCalendarDate(date);
}
