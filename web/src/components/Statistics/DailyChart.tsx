/**
 * DailyChart Component
 * Displays daily/weekly hours as a stacked bar chart using recharts
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getChartTheme } from './chartTheme';

interface DailyHoursItem {
  date: string;
  hours: number;
  billableHours: number;
  nonBillableHours: number;
  breakHours: number;
}

interface WeeklyHoursItem {
  weekStart: string;
  hours: number;
  billableHours: number;
  nonBillableHours: number;
  breakHours: number;
}

interface DailyChartProps {
  data: DailyHoursItem[];
  weeklyData?: WeeklyHoursItem[];
  formatHours: (hours: number) => string;
  theme?: 'light' | 'dark';
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  return `W${getISOWeek(date)} ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function DailyChart({ data, weeklyData, formatHours, theme = 'light' }: DailyChartProps) {
  const ct = getChartTheme(theme);

  // Use weekly data when available (range > 14 days)
  const useWeekly = weeklyData && weeklyData.length > 0;
  const chartData = useWeekly
    ? weeklyData.map((item) => ({
        label: formatWeekLabel(item.weekStart),
        billable: Number(item.billableHours.toFixed(1)),
        nonBillable: Number(item.nonBillableHours.toFixed(1)),
      }))
    : data.map((item) => ({
        label: formatDateLabel(item.date),
        billable: Number(item.billableHours.toFixed(1)),
        nonBillable: Number(item.nonBillableHours.toFixed(1)),
      }));

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 text-text-primary dark:text-text-primary">
        {useWeekly ? 'Weekly Hours' : 'Daily Hours'}
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: ct.textSecondary }}
            angle={-45}
            textAnchor="end"
            height={50}
            stroke={ct.axisLine}
          />
          <YAxis
            tick={{ fontSize: 11, fill: ct.textSecondary }}
            stroke={ct.axisLine}
            width={35}
            tickFormatter={(v: number) => `${v}h`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: ct.tooltipBg,
              border: `1px solid ${ct.tooltipBorder}`,
              borderRadius: '8px',
              color: ct.tooltipText,
              fontSize: '13px',
            }}
            formatter={(value: number, name: string) => [
              `${formatHours(value)}h`,
              name === 'billable' ? 'Billable' : 'Non-billable',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: ct.textSecondary }}
            formatter={(value: string) =>
              value === 'billable' ? 'Billable' : 'Non-billable'
            }
          />
          <Bar
            dataKey="billable"
            stackId="hours"
            fill={ct.billableBar}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="nonBillable"
            stackId="hours"
            fill={ct.nonBillableBar}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
