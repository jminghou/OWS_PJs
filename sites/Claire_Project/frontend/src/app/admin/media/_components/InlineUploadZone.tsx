'use client';

import { useState, useRef, useCallback } from 'react';
import { AdminUploadZone } from '@/components/admin/shared';
import { mediaApi } from '@/lib/api/media';

// =============================================================================
// Inline Upload Zone (嵌入在內容區的拖曳上傳區)
// =============================================================================

export function InlineUploadZone({
  folderId,
  onUploadComplete,
  minHeight = '200px',
  compact = false,
}: {
  folderId: number | null;
  onUploadComplete: () => void;
  minHeight?: string;
  compact?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    const initialProgress: Record<string, number> = {};
    files.forEach((f) => (initialProgress[f.name] = 0));
    setUploadProgress(initialProgress);
    try {
      const targetFolderId = folderId && folderId > 0 ? folderId : undefined;
      for (const file of files) {
        await mediaApi.uploadMedia(file, targetFolderId, (percent) => {
          setUploadProgress((prev) => ({ ...prev, [file.name]: percent }));
        });
      }
      onUploadComplete();
    } catch (error) {
      alert(`上傳失敗: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <AdminUploadZone
      onUpload={handleUpload}
      isUploading={isUploading}
      uploadProgress={uploadProgress}
      minHeight={minHeight}
      compact={compact}
    />
  );
}
