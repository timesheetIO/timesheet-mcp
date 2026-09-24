/**
 * Chart Theme Utility
 * Provides theme-aware colors for the statistics charts
 */

export interface ChartTheme {
  text: string;
  textSecondary: string;
  grid: string;
  billableBar: string;
  nonBillableBar: string;
  axisLine: string;
}

export function getChartTheme(theme: 'light' | 'dark'): ChartTheme {
  if (theme === 'dark') {
    return {
      text: '#fafafa',
      textSecondary: '#a1a1aa',
      grid: 'rgba(255, 255, 255, 0.08)',
      billableBar: '#ff8800',
      // The muted token, as for projects without billable time: 3:1 or more on the card
      nonBillableBar: 'var(--ts-fg-subtle)',
      axisLine: 'rgba(255, 255, 255, 0.15)',
    };
  }
  return {
    text: '#18181b',
    textSecondary: '#52525b',
    grid: 'rgba(0, 0, 0, 0.08)',
    // The brand orange darkened to 3.2:1 on white, the contrast a chart's bars need (#ff8800 has 2.4:1)
    billableBar: '#e07000',
    nonBillableBar: 'var(--ts-fg-subtle)',
    axisLine: 'rgba(0, 0, 0, 0.15)',
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
 * SDK stores colors as decimal integers (e.g., 16711680 = #FF0000). 0 means "no color"
 * (Project.color is a Java int that defaults to 0) and gets a palette color.
 */
export function intToHexColor(color: number | undefined, fallbackIndex: number): string {
  // Colors are ARGB integers, and Android stores them signed (e.g. -8420), so any non-zero value is a color
  if (color !== undefined && Number.isFinite(color) && color !== 0) {
    return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
  }
  return PROJECT_COLOR_PALETTE[fallbackIndex % PROJECT_COLOR_PALETTE.length];
}
