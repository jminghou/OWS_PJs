'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, Plus, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export interface AdminUploadZoneProps {
  onUpload: (files: File[]) => Promise<void>;
  isUploading?: boolean;
  uploadProgress?: Record<string, number>;
  accept?: string;
  multiple?: boolean;
  className?: string;
  minHeight?: string;
}

/**
 * 統一的拖曳上傳組件
 * 用於媒體庫及其他需要上傳功能的頁面
 */
export function AdminUploadZone({
  onUpload,
  isUploading = false,
  uploadProgress = {},
  accept = "image/*,video/*,audio/*,.pdf,.doc,.docx",
  multiple = true,
  className = '',
  minHeight = '200px',
}: AdminUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await onUpload(files);
  }, [onUpload]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) await onUpload(files);
    // 清空 input 讓同一個檔案可以重複觸發 onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ minHeight }}
      className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center transition-all duration-200 ${
        isDragging 
          ? 'border-blue-500 bg-blue-50 scale-[1.01]' 
          : 'border-gray-300 bg-gray-50 hover:border-gray-400'
      } ${className}`}
    >
      {isUploading ? (
        <div className="px-6 w-full space-y-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm font-medium text-gray-600">正在上傳檔案...</p>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {Object.entries(uploadProgress).map(([filename, progress]) => (
              <div key={filename} className="text-xs">
                <div className="flex justify-between mb-1 text-gray-500">
                  <span className="truncate max-w-[200px]">{filename}</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-8 flex flex-col items-center">
          {/* 上傳圖示 */}
          <div className="w-14 h-14 bg-white border border-gray-200 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:shadow-md transition-shadow">
            <Upload className="w-7 h-7 text-gray-400" />
          </div>
          
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">
              拖放檔案到此處，或{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2 focus:outline-none"
              >
                瀏覽電腦
              </button>
            </p>
            <p className="text-xs text-gray-400">
              支援圖片、影片、PDF 或文件檔案
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
