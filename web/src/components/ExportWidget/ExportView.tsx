/**
 * ExportView - Main UI Component
 * Displays template selector, date range inputs, and generate button
 */

import React from 'react';
import type { ExportTemplate } from './index';
import TemplateSelect from './TemplateSelect';

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
  result: { success: boolean; message: string } | null;
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
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-accent-primary"
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
        <h2 className="text-heading font-semibold text-primary dark:text-primary">
          Export from Template
        </h2>
      </div>

      {/* Template Selection */}
      <div className="space-y-2">
        <label className="block text-body-small font-medium text-secondary dark:text-secondary">
          Select Template
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
        <div className="bg-surface-secondary dark:bg-surface-secondary rounded-lg p-3 text-body-small">
          <div className="flex flex-wrap gap-2">
            {selectedTemplate.format && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary text-xs font-medium">
                {selectedTemplate.format.toUpperCase()}
              </span>
            )}
            {selectedTemplate.summarize && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-success/10 text-accent-success text-xs font-medium">
                Summarized
              </span>
            )}
            {selectedTemplate.splitTask && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-warning/10 text-accent-warning text-xs font-medium">
                Split Tasks
              </span>
            )}
            {selectedTemplate.filter && selectedTemplate.filter !== 'all' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary/10 text-secondary text-xs font-medium">
                {selectedTemplate.filter}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-body-small font-medium text-secondary dark:text-secondary">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-card-border dark:border-card-border bg-card-bg dark:bg-card-bg text-primary dark:text-primary text-body-small focus:outline-none focus:ring-2 focus:ring-accent-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-body-small font-medium text-secondary dark:text-secondary">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-card-border dark:border-card-border bg-card-bg dark:bg-card-bg text-primary dark:text-primary text-body-small focus:outline-none focus:ring-2 focus:ring-accent-primary"
          />
        </div>
      </div>

      {/* Quick Date Presets */}
      <div className="flex flex-wrap gap-2">
        <QuickDateButton
          label="This Month"
          onClick={() => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            onStartDateChange(formatDate(start));
            onEndDateChange(formatDate(now));
          }}
        />
        <QuickDateButton
          label="Last Month"
          onClick={() => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            onStartDateChange(formatDate(start));
            onEndDateChange(formatDate(end));
          }}
        />
        <QuickDateButton
          label="This Week"
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
          label="Last Week"
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
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={!selectedTemplateId || isLoading}
        className={`w-full py-3 px-4 rounded-lg font-medium text-body transition-colors ${
          !selectedTemplateId || isLoading
            ? 'bg-surface-secondary text-secondary cursor-not-allowed'
            : 'bg-accent-primary hover:bg-accent-primary/90 text-white'
        }`}
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
            Generating...
          </span>
        ) : (
          'Generate Export'
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
          <p className="text-body-small">No export templates found</p>
          <p className="text-xs mt-1">Create a template first using export_template_create</p>
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
      className="px-2 py-1 text-xs rounded bg-surface-secondary hover:bg-surface-secondary/80 text-secondary dark:text-secondary transition-colors"
    >
      {label}
    </button>
  );
}

// Format date to YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
