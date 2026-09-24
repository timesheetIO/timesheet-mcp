/**
 * DailyChart Component
 * Displays daily/weekly hours as a stacked bar chart, drawn as plain SVG
 */

import React from 'react';
import { getChartTheme } from './chartTheme';
import i18n from '../../i18n';
import { formatHoursValue, parseCalendarDate } from '../../format';

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

const HEIGHT = 260;
const MARGIN = { top: 10, right: 10, left: 40 };
const NICE_STEPS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100];

function formatDateLabel(dateStr: string, locale: string): string {
  return parseCalendarDate(dateStr).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function formatWeekLabel(weekStart: string, locale: string): string {
  const date = parseCalendarDate(weekStart);
  const week = i18n.t('statistics.week', { week: getISOWeek(date) });
  return `${week} ${date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Axis ticks from 0 in round steps, about four of them, covering the tallest bar. */
function yTicks(max: number): number[] {
  const step = NICE_STEPS.find((s) => s * 4 >= max) ?? Math.ceil(max / 4);
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) {
    ticks.push(ticks[ticks.length - 1] + step);
  }
  return ticks.length > 1 ? ticks : [0, step];
}

/** A rectangle whose top corners are rounded, for the top segment of a stacked bar. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export default function DailyChart({ data, weeklyData, formatHours, theme = 'light', locale }: DailyChartProps) {
  const ct = getChartTheme(theme);
  const t = i18n.t.bind(i18n);
  const [containerRef, width] = useWidth();

  // Use weekly data when available (range > 14 days)
  const useWeekly = weeklyData && weeklyData.length > 0;
  const bars = useWeekly
    ? weeklyData.map((item) => ({
        label: formatWeekLabel(item.weekStart, locale),
        billable: item.billableHours,
        nonBillable: item.nonBillableHours,
      }))
    : data.map((item) => ({
        label: formatDateLabel(item.date, locale),
        billable: item.billableHours,
        nonBillable: item.nonBillableHours,
      }));

  const angled = bars.length > 8;
  const bottom = angled ? 55 : 24;
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const plotHeight = HEIGHT - MARGIN.top - bottom;
  const ticks = yTicks(Math.max(...bars.map((b) => b.billable + b.nonBillable), 0));
  const yMax = ticks[ticks.length - 1];
  const y = (hours: number) => MARGIN.top + plotHeight - (hours / yMax) * plotHeight;
  const slot = bars.length > 0 ? plotWidth / bars.length : 0;
  const barWidth = Math.min(slot * 0.7, 48);
  // Keep labels readable when there are many bars: show every n-th one.
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(plotWidth / 34, 1)));

  return (
    <div>
      <h3 className="text-heading m-0 mb-4 text-text-primary">
        {useWeekly ? t('statistics.weeklyHours') : t('statistics.dailyHours')}
      </h3>
      <div ref={containerRef} style={{ width: '100%' }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={useWeekly ? t('statistics.weeklyHours') : t('statistics.dailyHours')}
            style={{ display: 'block', fontSize: 11 }}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? ct.axisLine : ct.grid}
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                />
                <text x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" fill={ct.textSecondary}>
                  {formatHoursValue(tick, locale)}
                </text>
              </g>
            ))}

            {bars.map((bar, index) => {
              const x = MARGIN.left + index * slot + (slot - barWidth) / 2;
              const center = x + barWidth / 2;
              const billableTop = y(bar.billable);
              const totalTop = y(bar.billable + bar.nonBillable);
              return (
                <g key={index}>
                  <title>
                    {`${bar.label}: ${formatHours(bar.billable + bar.nonBillable)} (${t('statistics.billable')} ${formatHours(bar.billable)}, ${t('statistics.nonBillable')} ${formatHours(bar.nonBillable)})`}
                  </title>
                  {bar.billable > 0 && (
                    <rect
                      x={x}
                      y={billableTop}
                      width={barWidth}
                      height={y(0) - billableTop}
                      style={{ fill: ct.billableBar }}
                    />
                  )}
                  {bar.nonBillable > 0 && (
                    <path
                      d={roundedTop(x, totalTop, barWidth, billableTop - totalTop, 4)}
                      style={{ fill: ct.nonBillableBar }}
                    />
                  )}
                  {index % labelEvery === 0 && (
                    <text
                      x={center}
                      y={y(0) + 14}
                      fill={ct.textSecondary}
                      textAnchor={angled ? 'end' : 'middle'}
                      transform={angled ? `rotate(-45 ${center} ${y(0) + 14})` : undefined}
                    >
                      {bar.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <div
        style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px', fontSize: '12px', color: ct.textSecondary }}
      >
        {[
          { color: ct.billableBar, label: t('statistics.billable') },
          { color: ct.nonBillableBar, label: t('statistics.nonBillable') },
        ].map((item) => (
          <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
