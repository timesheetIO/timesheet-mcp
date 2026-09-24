/**
 * ExportWidget - Main Entry Point
 * Handles template selection and export generation
 */

import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppProvider } from '../../McpAppProvider';
import {
  useTheme,
  useToolOutput,
  useCallTool,
  useCanCallServerTools,
  useLocale,
  useToolFailure,
  useUpdateModelContext,
} from '../../hooks';
import { formatNumber, toCalendarDate } from '../../format';
import { useApplyTheme } from '../../utils';
import StatusCard from '../shared/StatusCard';
import ExportView from './ExportView';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import '../../index.css';

export interface ExportTemplate {
  id: string;
  name: string;
  report?: number;
  format?: string;
  teamIds?: string[];
  projectIds?: string[];
  userIds?: string[];
  type?: string;
  filter?: string;
  splitTask?: boolean;
  summarize?: boolean;
  email?: string;
  filename?: string;
}

interface ExportWidgetData {
  templates: ExportTemplate[];
  totalCount: number;
}

function ExportWidgetApp() {
  const { t } = useTranslation();
  const initialData = useToolOutput<ExportWidgetData>();
  const failure = useToolFailure();
  const theme = useTheme();
  const locale = useLocale();
  const callTool = useCallTool();
  const canCallTools = useCanCallServerTools();
  const updateModelContext = useUpdateModelContext();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getDefaultStartDate());
  const [endDate, setEndDate] = useState<string>(getDefaultEndDate());
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; downloadUrl?: string } | null>(null);

  useApplyTheme();

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplateId || !startDate || !endDate) {
      setResult({ success: false, message: t('exportWidget.missingInput') });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await callTool('export_from_template', {
        templateId: selectedTemplateId,
        startDate,
        endDate,
      });

      const content = response?.structuredContent as any;
      if (content?.kind === 'export' && content.export) {
        setResult({
          success: true,
          message: content.export.filename
            ? t('exportWidget.readyFile', { filename: content.export.filename })
            : t('exportWidget.ready'),
          downloadUrl: content.export.downloadUrl,
        });
        // The model learns about it without a new chat message
        updateModelContext(`The user generated an export from a template for ${startDate} to ${endDate}.`);
      } else if (content?.success) {
        setResult({
          success: true,
          message: t('exportWidget.generated', { size: formatBytes(content.size, locale) })
        });
        updateModelContext(`The user generated an export from a template for ${startDate} to ${endDate}.`);
      } else {
        setResult({ success: false, message: t('exportWidget.failed') });
      }
    } catch (error) {
      console.error('[ExportWidget] Error generating export:', error);
      setResult({ success: false, message: t('exportWidget.failed') });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTemplateId, startDate, endDate, callTool, updateModelContext, t, locale]);

  if (failure) {
    return <StatusCard status={failure} />;
  }

  // Loading state
  if (!initialData) {
    return (
      <div className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl p-4">
        <div className="text-body-small text-secondary dark:text-secondary">
          {t('exportWidget.loading')}
        </div>
      </div>
    );
  }

  // A result without templates
  if (!initialData.templates) {
    return <StatusCard status="error" message={t('exportWidget.loadFailed')} />;
  }

  return (
    <div className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl">
      <ExportView
        templates={initialData.templates}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={setSelectedTemplateId}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        onGenerate={handleGenerate}
        isLoading={isLoading}
        canGenerate={canCallTools}
        result={result}
        theme={theme}
      />
    </div>
  );
}

// Helper functions
function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(1); // First day of current month
  return toCalendarDate(date);
}

function getDefaultEndDate(): string {
  return toCalendarDate(new Date());
}

function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, locale, { maximumFractionDigits: 1 })} KB`;
  return `${formatNumber(bytes / (1024 * 1024), locale, { maximumFractionDigits: 1 })} MB`;
}

// Mount the component
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <McpAppProvider appName="ExportWidget">
      <ExportWidgetApp />
    </McpAppProvider>
  );
}
