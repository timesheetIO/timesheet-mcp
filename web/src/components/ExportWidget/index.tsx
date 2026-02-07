/**
 * ExportWidget - Main Entry Point
 * Handles template selection and export generation
 */

import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppProvider } from '../../McpAppProvider';
import { useTheme, useToolOutput, useCallTool, useSendFollowUpMessage } from '../../hooks';
import { useApplyTheme } from '../../utils';
import ExportView from './ExportView';
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
  const initialData = useToolOutput<ExportWidgetData>();
  const theme = useTheme();
  const callTool = useCallTool();
  const sendFollowUp = useSendFollowUpMessage();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getDefaultStartDate());
  const [endDate, setEndDate] = useState<string>(getDefaultEndDate());
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useApplyTheme();

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplateId || !startDate || !endDate) {
      setResult({ success: false, message: 'Please select a template and date range' });
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

      if (response?.structuredContent?.success) {
        setResult({
          success: true,
          message: `Export generated successfully (${formatBytes(response.structuredContent.size)})`
        });
        // Send follow-up to notify the chat
        sendFollowUp(`Export generated from template for ${startDate} to ${endDate}`);
      } else {
        setResult({ success: false, message: 'Failed to generate export' });
      }
    } catch (error) {
      console.error('[ExportWidget] Error generating export:', error);
      setResult({ success: false, message: 'Error generating export' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTemplateId, startDate, endDate, callTool, sendFollowUp]);

  // Loading state
  if (!initialData) {
    return (
      <div className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl p-4">
        <div className="text-body-small text-secondary dark:text-secondary">
          Loading templates...
        </div>
      </div>
    );
  }

  // Error state
  if (!initialData.templates) {
    return (
      <div className="bg-card-bg dark:bg-card-bg border border-card-border dark:border-card-border rounded-2xl p-4">
        <div className="text-body-small text-accent-danger">
          Failed to load templates
        </div>
      </div>
    );
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
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate(): string {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
