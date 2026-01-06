/**
 * TemplateSelect - Dropdown component for selecting export templates
 */

import React from 'react';
import type { ExportTemplate } from './index';

interface TemplateSelectProps {
  templates: ExportTemplate[];
  selectedTemplateId: string;
  onChange: (templateId: string) => void;
  theme: 'light' | 'dark';
}

export default function TemplateSelect({
  templates,
  selectedTemplateId,
  onChange,
  theme,
}: TemplateSelectProps) {
  return (
    <div className="relative">
      <select
        value={selectedTemplateId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 pr-10 rounded-lg border border-card-border dark:border-card-border bg-card-bg dark:bg-card-bg text-primary dark:text-primary text-body appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-primary"
      >
        <option value="" disabled>
          Choose a template...
        </option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
            {template.format ? ` (${template.format.toUpperCase()})` : ''}
          </option>
        ))}
      </select>

      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg
          className="w-4 h-4 text-secondary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
