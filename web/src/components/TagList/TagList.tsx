/**
 * TagList Component
 * Displays a list of tags as inline chips/badges
 */

import React from 'react';
import type { Tag } from '../../types';
import TagItem from './TagItem';

interface TagListProps {
  tags?: Tag[];
  truncate?: boolean;
  maxLength?: number;
  emptyText?: string;
}

export default function TagList({
  tags,
  truncate = false,
  maxLength = 40,
  emptyText = ''
}: TagListProps) {
  // Return nothing if no tags and no empty text
  if (!tags || tags.length === 0) {
    if (!emptyText) return null;
    return <span className="text-text-secondary dark:text-text-secondary text-xs">{emptyText}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map((tag) => (
        <TagItem
          key={tag.id}
          tag={tag}
          truncate={truncate}
          maxLength={maxLength}
        />
      ))}
    </div>
  );
}
