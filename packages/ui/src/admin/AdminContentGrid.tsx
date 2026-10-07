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
  // 手機：最小寬度降到約半個畫面，至少兩欄並撐滿；桌機維持原本格子大小
  return (
    <div
      className={`grid ${className}`}
      style={{
        gap: `${gap * 0.25}rem`,
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${itemSize}px, calc(50% - ${gap * 0.125}rem)), 1fr))`,
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {renderItem(item)}
        </React.Fragment>
      ))}
    </div>
  );
}
