/**
 * ProjectBreakdown Component
 * Displays project hours breakdown as a donut chart (plain SVG) with side legend
 */

import React from 'react';
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

const DONUT_SIZE = 180;
const DONUT_OUTER = 80;
const DONUT_INNER = 45;

/** Ring segments drawn as dashed circle strokes, with a small gap between projects. */
function Donut({ slices, formatHours, label }: {
  slices: { name: string; value: number; fill: string }[];
  formatHours: (hours: number) => string;
  label: string;
}) {
  const center = DONUT_SIZE / 2;
  const radius = (DONUT_OUTER + DONUT_INNER) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const gap = slices.length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <svg width={DONUT_SIZE} height={DONUT_SIZE} role="img" aria-label={label} style={{ flexShrink: 0 }}>
      <g transform={`rotate(-90 ${center} ${center})`}>
        {slices.map((slice, index) => {
          const length = total > 0 ? (slice.value / total) * circumference : 0;
          const visible = Math.max(length - gap, 0);
          const segment = (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={DONUT_OUTER - DONUT_INNER}
              strokeDasharray={`${visible} ${circumference - visible}`}
              strokeDashoffset={-offset}
              style={{ stroke: slice.fill }}
            >
              <title>{`${slice.name}: ${formatHours(slice.value)}`}</title>
            </circle>
          );
          offset += length;
          return segment;
        })}
      </g>
    </svg>
  );
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
        <Donut slices={chartData} formatHours={formatHours} label={i18n.t('statistics.projectBreakdown')} />

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
