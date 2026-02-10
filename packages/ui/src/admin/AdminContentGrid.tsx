'use client';

import React from 'react';

export interface AdminContentGridProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  itemSize?: number;
  gap?: number;
  className?: string;
}

export function AdminContentGrid<T>({
  items,
  renderItem,
  itemSize = 180,
  gap = 3,
  className = '',
}: AdminContentGridProps<T>) {
  return (
    <div
      className={`grid gap-${gap} ${className}`}
      style={{ gridTemplateColumns: `repeat(auto-fill, ${itemSize}px)` }}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {renderItem(item)}
        </React.Fragment>
      ))}
    </div>
  );
}
