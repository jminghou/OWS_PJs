'use client';

import React from 'react';

export interface AdminEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const DefaultIcon = () => (
  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: AdminEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 ${className}`}>
      {icon ? (
        <div className="mb-4 flex justify-center">{icon}</div>
      ) : (
        <DefaultIcon />
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 mb-4">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );
}
