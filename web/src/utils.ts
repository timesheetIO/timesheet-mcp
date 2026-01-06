/**
 * Common utility functions for widgets
 */

import { useEffect } from 'react';
import { useTheme } from './hooks';

/**
 * Converts a decimal color integer to hex color string
 * @param colorInt - Decimal color value (e.g., 16734003 for #FF5733)
 * @param defaultColor - Default hex color to use if colorInt is undefined/invalid
 * @returns Hex color string (e.g., "#FF5733")
 */
export function intToHexColor(colorInt?: number, defaultColor = '#6b7280'): string {
  if (colorInt === undefined || colorInt === null) {
    return defaultColor;
  }

  // Convert to hex and pad with zeros to ensure 6 digits
  const hex = ('000000' + (colorInt & 0xFFFFFF).toString(16)).slice(-6);
  return `#${hex}`;
}

/**
 * Calculates contrasting text color (black or white) for a given background color
 * Uses relative luminance formula to determine readability
 * @param hexColor - Hex color string (e.g., "#FF5733")
 * @returns "#000000" for light backgrounds, "#ffffff" for dark backgrounds
 */
export function getContrastingTextColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance using ITU-R BT.709
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);

  // Use threshold of 179 (same as Angular implementation)
  return luminance > 179 ? '#000000' : '#ffffff';
}

/**
 * Custom hook to apply theme class to document
 * Call this in your component to automatically sync with OpenAI theme
 */
export function useApplyTheme() {
  const theme = useTheme();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
}
