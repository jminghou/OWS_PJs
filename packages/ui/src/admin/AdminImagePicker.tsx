'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, X, Upload, Plus } from 'lucide-react';

export interface AdminImagePickerProps {
  value?: string;
  onChange?: (url: string) => void;
  onRemove: () => void;
  onBrowse: () => void;
  label?: string;
  placeholder?: string;
  className?: string;
  getImageUrl: (path: string, variant?: string) => string;
  aspectRatio?: '1/1' | '4/3' | '16/9' | 'auto';
}

/**
 * 統一的圖片選擇器組件
 * 用於後台各功能頁面，提供一致的視覺與操作體驗
 */
export function AdminImagePicker({
  value,
  onChange,
  onRemove,
  onBrowse,
  label,
  placeholder = '尚未選擇圖片',
  className = '',
  getImageUrl,
  aspectRatio = '4/3',
}: AdminImagePickerProps) {
  const aspectClass = {
    '1/1': 'aspect-square w-40 h-40',
    '4/3': 'aspect-[4/3] w-40 h-30',
    '16/9': 'aspect-video w-40 h-22.5',
    'auto': 'w-40 h-auto min-h-[120px]',
  }[aspectRatio];

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="flex items-start gap-4">
        {/* 圖片預覽區 */}
        <div className={`flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-200 relative group ${aspectClass}`}>
          {value ? (
            <>
              <img
                src={getImageUrl(value, 'small')}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src.includes('_small')) {
                    target.src = getImageUrl(value);
                  } else {
                    target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="75"%3E%3Crect fill="%23f3f4f6" width="100" height="75"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="10"%3E圖片載入失敗%3C/text%3E%3C/svg%3E';
                  }
                }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
              <ImageIcon className="h-8 w-8 stroke-1" />
              <span className="text-[10px]">{placeholder}</span>
            </div>
          )}
        </div>

        {/* 操作按鈕區 */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onBrowse}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              選擇圖片
            </button>
            
            {value && (
              <button
                type="button"
                onClick={onRemove}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-100 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
                移除圖片
              </button>
            )}
          </div>
          
          {/* 路徑顯示 */}
          <div className="px-2 py-1.5 bg-gray-50 rounded border border-gray-100">
            <p className="text-[10px] text-gray-400 break-all leading-tight font-mono">
              {value || 'no_image_selected'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
