'use client';

import React from 'react';

export interface AdminListLayoutProps {
  sidebar?: React.ReactNode;
  sidebarWidth?: number;
  children: React.ReactNode;
  className?: string;
}

export function AdminListLayout({
  sidebar,
  sidebarWidth = 224,
  children,
  className = '',
}: AdminListLayoutProps) {
  if (!sidebar) {
    return (
      <div className={`p-6 ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`flex h-[calc(100vh-4rem)] ${className}`}>
      <div className="flex-shrink-0" style={{ width: sidebarWidth }}>
        {sidebar}
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
