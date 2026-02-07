/**
 * Chart Theme Utility
 * Provides theme-aware color palettes for recharts components
 */

export interface ChartTheme {
  text: string;
  textSecondary: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  billableBar: string;
  nonBillableBar: string;
  axisLine: string;
}

export function getChartTheme(theme: 'light' | 'dark'): ChartTheme {
  if (theme === 'dark') {
    return {
      text: '#e5e7eb',
      textSecondary: '#9ca3af',
      grid: '#374151',
      tooltipBg: '#1f2937',
      tooltipBorder: '#4b5563',
      tooltipText: '#f3f4f6',
      billableBar: '#34d399',
      nonBillableBar: '#fbbf24',
      axisLine: '#4b5563',
    };
  }
  return {
    text: '#1f2937',
    textSecondary: '#6b7280',
    grid: '#e5e7eb',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e5e7eb',
    tooltipText: '#1f2937',
    billableBar: '#10b981',
    nonBillableBar: '#f59e0b',
    axisLine: '#d1d5db',
  };
}

/**
 * Fallback project color palette (15 distinct colors)
 * Used when project doesn't have an SDK color assigned
 */
export const PROJECT_COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

/**
 * Convert Timesheet SDK integer color to hex string
 * SDK stores colors as decimal integers (e.g., 16711680 = #FF0000)
 */
export function intToHexColor(color: number | undefined, fallbackIndex: number): string {
  if (color !== undefined && color > 0) {
    const hex = color.toString(16).padStart(6, '0');
    return `#${hex}`;
  }
  return PROJECT_COLOR_PALETTE[fallbackIndex % PROJECT_COLOR_PALETTE.length];
}
