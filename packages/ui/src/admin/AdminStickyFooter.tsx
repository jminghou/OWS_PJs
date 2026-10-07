'use client';

import React from 'react';

export interface AdminStickyFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 黏在捲動容器底部的操作列（儲存／取消）。放在可捲動內容的最後一個子元素；
 * 手機會補 safe-area，避免被 iOS 底部手勢列蓋住。
 */
export function AdminStickyFooter({ children, className = '' }: AdminStickyFooterProps) {
  return (
    <div
      className={`sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 px-4 md:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3 border-t border-border bg-card/95 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
