'use client';

import { useState, useCallback, type DragEvent, type ReactNode } from 'react';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  accept?: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export default function DropZone({
  onFilesDropped,
  accept = 'image/*',
  disabled = false,
  children,
  className = '',
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 只在離開整個 DropZone 時才重置狀態
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);

      // 過濾檔案類型
      const filteredFiles = files.filter((file) => {
        if (!accept) return true;

        // 處理 accept 參數 (如 'image/*', 'image/png,image/jpeg')
        const acceptTypes = accept.split(',').map((t) => t.trim());

        return acceptTypes.some((acceptType) => {
          if (acceptType.endsWith('/*')) {
            // 如 'image/*' 匹配所有 image 類型
            const baseType = acceptType.replace('/*', '');
            return file.type.startsWith(baseType);
          }
          return file.type === acceptType;
        });
      });

      if (filteredFiles.length > 0) {
        onFilesDropped(filteredFiles);
      }
    },
    [disabled, accept, onFilesDropped]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${className}`}
    >
      {children}

      {/* 拖放覆蓋層 */}
      {isDragOver && !disabled && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-white px-6 py-4 rounded-lg shadow-lg text-center">
            <svg
              className="w-12 h-12 mx-auto text-blue-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-lg font-medium text-gray-700">放開以上傳檔案</p>
            <p className="text-sm text-gray-500">支援的檔案類型：圖片</p>
          </div>
        </div>
      )}
    </div>
  );
}
