/**
 * ProjectBreakdown Component
 * Displays project hours breakdown as a donut chart with side legend
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getChartTheme, intToHexColor } from './chartTheme';
import i18n from '../../i18n';

interface ProjectBreakdownItem {
  projectId?: string;
  projectTitle: string;
  projectColor?: number;
  color?: string;
  hours: number;
  billableHours: number;
  nonBillableHours: number;
  taskCount: number;
  percentage: number;
}

interface ProjectBreakdownProps {
  projects: ProjectBreakdownItem[];
  formatHours: (hours: number) => string;
  theme?: 'light' | 'dark';
}

/** Same rule as the compact card's bars: a project with no billable time is shown muted. */
function sliceColor(item: ProjectBreakdownItem, index: number): string {
  if (item.hours > 0 && !(item.billableHours > 0)) {
    return 'var(--ts-fg-subtle)';
  }
  return item.color || intToHexColor(item.projectColor, index);
}

export default function ProjectBreakdown({ projects, formatHours, theme = 'light' }: ProjectBreakdownProps) {
  const ct = getChartTheme(theme);

  const chartData = projects.map((item, index) => ({
    name: item.projectTitle,
    value: Number(item.hours.toFixed(2)),
    fill: sliceColor(item, index),
    percentage: item.percentage,
    taskCount: item.taskCount,
  }));

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 className="text-heading m-0 mb-4 text-text-primary">
        {i18n.t('statistics.projectBreakdown')}
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Donut chart */}
        <div style={{ width: '180px', height: '180px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: ct.tooltipBg,
                  border: `1px solid ${ct.tooltipBorder}`,
                  borderRadius: '8px',
                  color: ct.tooltipText,
                  fontSize: '13px',
                }}
                formatter={(value: number, name: string) => [formatHours(value), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list */}
        <div style={{ flex: 1, display: 'grid', gap: '8px' }}>
          {projects.map((item, index) => (
            <div
              key={item.projectId || item.projectTitle}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  backgroundColor: sliceColor(item, index),
                  flexShrink: 0,
                }}
              />
              <span
                className="text-text-primary dark:text-text-primary"
                style={{ fontSize: '13px', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {item.projectTitle}
              </span>
              <span
                style={{ fontSize: '13px', color: ct.textSecondary, whiteSpace: 'nowrap' }}
              >
                {formatHours(item.hours)} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
