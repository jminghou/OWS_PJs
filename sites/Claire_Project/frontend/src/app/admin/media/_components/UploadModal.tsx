'use client';

import { useState, useRef, useCallback } from 'react';
import { AdminUploadZone } from '@/components/admin/shared';
import { mediaApi } from '@/lib/api/media';

// =============================================================================
// Upload Modal Component
// =============================================================================

export interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  currentFolderId: number | null;
}

export function UploadModal({ isOpen, onClose, onUploadComplete, currentFolderId }: UploadModalProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    const initialProgress: Record<string, number> = {};
    files.forEach((f) => (initialProgress[f.name] = 0));
    setUploadProgress(initialProgress);

    try {
      const folderId = currentFolderId && currentFolderId > 0 ? currentFolderId : undefined;
      for (const file of files) {
        await mediaApi.uploadMedia(file, folderId, (percent) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: percent }));
        });
      }
      onUploadComplete();
      onClose();
    } catch (error) {
      alert(`上傳失敗: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">上傳媒體檔案</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors" 
            disabled={isUploading}
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <AdminUploadZone
            onUpload={handleUpload}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            minHeight="250px"
          />
        </div>
      </div>
    </div>
  );
}
