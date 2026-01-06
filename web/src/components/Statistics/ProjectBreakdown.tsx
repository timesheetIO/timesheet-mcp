/**
 * ProjectBreakdown Component
 * Displays project hours breakdown with progress bars
 */

import React from 'react';

interface ProjectBreakdownItem {
  projectTitle: string;
  hours: number;
  percentage: number;
}

interface ProjectBreakdownProps {
  projects: ProjectBreakdownItem[];
  formatHours: (hours: number) => string;
  theme?: 'light' | 'dark';
}

const colorPalette = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
];

export default function ProjectBreakdown({ projects, formatHours, theme = 'light' }: ProjectBreakdownProps) {
  const isDark = theme === 'dark';
  const secondaryColor = isDark ? '#888888' : '#666666';

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        Project Breakdown
      </h3>
      <div style={{ display: 'grid', gap: '12px' }}>
        {projects.map((item, index) => (
          <div key={item.projectTitle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>
                {item.projectTitle}
              </div>
              <div style={{ fontSize: '14px', color: secondaryColor }}>
                {formatHours(item.hours)}h ({item.percentage}%)
              </div>
            </div>
            <div
              style={{
                height: '8px',
                backgroundColor: isDark ? '#2a2a2a' : '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${item.percentage}%`,
                  backgroundColor: colorPalette[index % colorPalette.length],
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
