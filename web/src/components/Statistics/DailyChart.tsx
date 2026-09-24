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
import i18n from '../../i18n';
import { parseCalendarDate } from '../../format';

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
  locale: string;
}

function formatDateLabel(dateStr: string, locale: string): string {
  return parseCalendarDate(dateStr).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function formatWeekLabel(weekStart: string, locale: string): string {
  const date = parseCalendarDate(weekStart);
  return `W${getISOWeek(date)} ${date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function DailyChart({ data, weeklyData, formatHours, theme = 'light', locale }: DailyChartProps) {
  const ct = getChartTheme(theme);
  const t = i18n.t.bind(i18n);
  const seriesName = (name: string) =>
    name === 'billable' ? t('statistics.billable') : t('statistics.nonBillable');

  // Use weekly data when available (range > 14 days)
  const useWeekly = weeklyData && weeklyData.length > 0;
  const chartData = useWeekly
    ? weeklyData.map((item) => ({
        label: formatWeekLabel(item.weekStart, locale),
        billable: Number(item.billableHours.toFixed(1)),
        nonBillable: Number(item.nonBillableHours.toFixed(1)),
      }))
    : data.map((item) => ({
        label: formatDateLabel(item.date, locale),
        billable: Number(item.billableHours.toFixed(1)),
        nonBillable: Number(item.nonBillableHours.toFixed(1)),
      }));

  return (
    <div>
      <h3 className="text-heading m-0 mb-4 text-text-primary">
        {useWeekly ? t('statistics.weeklyHours') : t('statistics.dailyHours')}
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
            formatter={(value: number, name: string) => [formatHours(value), seriesName(name)]}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: ct.textSecondary }}
            formatter={(value: string) => seriesName(value)}
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
