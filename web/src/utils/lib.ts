/**
 * Common utility functions for the Timesheet MCP Web components
 * Adapted from browser-extensions/common/lib.ts
 */

/**
 * Combines multiple class names into a single string, filtering out falsy values
 * @param classes Array of class names (strings, undefined, null, false, etc.)
 * @returns Combined class names separated by spaces
 * @example
 * classNames('btn', isActive && 'active', 'primary') // "btn active primary"
 */
export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Converts an integer color value to RGBA string
 * @param colorInt Integer color value (e.g., 0xFF5733)
 * @param opacity Opacity value between 0 and 1 (default: 1)
 * @returns RGBA color string (e.g., "rgba(255,87,51,1)")
 * @example
 * intToRGB(0xFF5733) // "rgba(255,87,51,1)"
 * intToRGB(0xFF5733, 0.5) // "rgba(255,87,51,0.5)"
 */
export function intToRGB(colorInt: number | null | undefined, opacity: number = 1): string {
  if (colorInt === null || colorInt === undefined) {
    return `rgba(128,128,128,${opacity})`; // Default gray
  }

  const r = (colorInt >> 16) & 0xff;
  const g = (colorInt >>  8) & 0xff;
  const b = colorInt & 0xff;

  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Converts a hex color string to an integer color value
 * Supports both short (#RGB) and long (#RRGGBB) hex formats
 * @param hex Hex color string (e.g., "#FF5733" or "#F57")
 * @returns Integer color value with alpha channel
 * @throws Error if hex format is invalid
 * @example
 * getIntColor("#FF5733") // 0xFF5733FF (with alpha)
 * getIntColor("#F57") // 0xFF5577FF
 */
export function getIntColor(hex: string): number {
  if (!hex.startsWith('#')) {
    throw new Error('Hex color must start with #');
  }

  let r = 0, g = 0, b = 0;
  const a = 255;

  if (hex.length === 4) {
    // Short format: #RGB
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    // Long format: #RRGGBB
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  } else {
    throw new Error('Invalid hex color format. Use #RGB or #RRGGBB');
  }

  // Validate parsed values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error('Invalid hex color values');
  }

  const normalizedAlpha = +(a / 255).toFixed(3);

  return (normalizedAlpha & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

/**
 * Debug logging utility for development
 * @example
 * debugLog('User profile:', profile)
 */
export const debugLog = (...args: any[]): void => {
  console.debug('[Timesheet MCP]', ...args);
};

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Number of milliseconds in one hour
 */
export const HOUR_MS = 3600000;

/**
 * Rounds a value to the nearest multiple of minutes (in milliseconds)
 * @param roundToMinutes Number of minutes to round to
 * @param ms Milliseconds to round
 * @returns Rounded milliseconds
 * @example
 * roundTo(15, 920000) // Rounds ~15.3 minutes to 15 minutes = 900000ms
 */
export function roundTo(roundToMinutes: number, ms: number): number {
  const m = 1000 * 60 * roundToMinutes;
  return Math.round(ms / m) * m;
}

/**
 * Rounds down a value to the nearest multiple of minutes (in milliseconds)
 * @param roundToMinutes Number of minutes to round down to
 * @param ms Milliseconds to round
 * @returns Rounded down milliseconds
 * @example
 * roundDownTo(15, 920000) // Rounds ~15.3 minutes down to 15 minutes = 900000ms
 */
export function roundDownTo(roundToMinutes: number, ms: number): number {
  const m = 1000 * 60 * roundToMinutes;
  return Math.floor(ms / m) * m;
}

/**
 * Rounds up a value to the nearest multiple of minutes (in milliseconds)
 * @param roundToMinutes Number of minutes to round up to
 * @param ms Milliseconds to round
 * @returns Rounded up milliseconds
 * @example
 * roundUpTo(15, 920000) // Rounds ~15.3 minutes up to 30 minutes = 1800000ms
 */
export function roundUpTo(roundToMinutes: number, ms: number): number {
  const m = 1000 * 60 * roundToMinutes;
  return Math.ceil(ms / m) * m;
}

/**
 * Pads a number with leading zero if less than 10
 * @param num Number to format
 * @returns Formatted string with leading zero if needed
 * @example
 * formatNumber(5) // "05"
 * formatNumber(12) // "12"
 */
export function formatNumber(num: number): string {
  return num > 9 ? String(num) : `0${num}`;
}

/**
 * Formats milliseconds to HH:MM format
 * Matches web app behavior: floors seconds (truncates sub-minute precision)
 * @param ms Milliseconds to format (default: 0)
 * @returns Formatted time string (e.g., "01:30", "12:05")
 * @example
 * formatTimeHHMM(90000) // "00:01" (90 seconds = 1.5 minutes floors to 1m)
 * formatTimeHHMM(3660000) // "01:01" (1 hour 1 minute)
 */
export function formatTimeHHMM(ms: number = 0): string {
  if (ms === null) {
    ms = 0;
  }

  const totalMinutes: number = Math.floor(ms / 1000 / 60);
  const hours: number = Math.floor(totalMinutes / 60);
  const minutes: number = Math.floor(totalMinutes % 60);

  return `${formatNumber(hours)}:${formatNumber(minutes)}`;
}

/**
 * Rounding type enumeration for time rounding
 * 0 = Round down, 1 = Round up, 2 = Round to nearest
 */
export type RoundingType = 0 | 1 | 2;

/**
 * Gets a date by applying time rounding based on rounding type
 * @param roundingType Type of rounding (0=down, 1=up, 2=nearest)
 * @param roundingMinutes Number of minutes to round to
 * @returns New Date object with rounded time
 * @example
 * getDateByRounding(1, 15) // Rounds current time up to nearest 15 minutes
 * getDateByRounding(0, 30) // Rounds current time down to nearest 30 minutes
 */
export function getDateByRounding(roundingType: RoundingType, roundingMinutes: number): Date {
  const now = Date.now();

  switch (roundingType) {
    case 1:
      return new Date(roundUpTo(roundingMinutes, now));
    case 2:
      return new Date(roundTo(roundingMinutes, now));
    default:
      return new Date(roundDownTo(roundingMinutes, now));
  }
}

/**
 * Formats seconds to HH:MM:SS time display
 * @param seconds Total seconds to format
 * @returns Formatted time string (e.g., "01:30:45")
 */
export function formatSecondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${formatNumber(hours)}:${formatNumber(minutes)}:${formatNumber(secs)}`;
}
