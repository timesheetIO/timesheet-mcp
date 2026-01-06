/**
 * TagItem Component
 * Displays a single tag as a colored badge/chip
 */

import React from 'react';
import type { Tag } from '../../types';
import { intToHexColor, getContrastingTextColor } from '../../utils';

interface TagItemProps {
  tag: Tag;
  truncate?: boolean;
  maxLength?: number;
}

export default function TagItem({ tag, truncate = false, maxLength = 40 }: TagItemProps) {
  // Convert decimal color to hex
  const backgroundColor = intToHexColor(tag.color, '#6b7280');

  // Get contrasting text color for readability
  const textColor = getContrastingTextColor(backgroundColor);

  // Truncate text if needed
  const displayName = truncate && tag.name.length > maxLength
    ? `${tag.name.substring(0, maxLength)}...`
    : tag.name;

  return (
    <span
      className="inline-block px-2 py-1 text-xs rounded-md whitespace-nowrap"
      style={{
        backgroundColor,
        color: textColor,
      }}
      title={tag.name} // Show full name on hover
    >
      {displayName}
    </span>
  );
}
