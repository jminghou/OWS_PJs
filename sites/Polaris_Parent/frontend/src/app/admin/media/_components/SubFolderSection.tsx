'use client';

import { useState, useEffect } from 'react';
import { mediaApi } from '@/lib/api/media';
import type { MediaItem, MediaFolder } from '@/lib/api/strapi';
import { getImageUrl } from '@/lib/utils';
import { getSmallUrl } from './utils';

// =============================================================================
// SubFolderSection — 可展開/收合的次資料夾區塊
// =============================================================================

export function SubFolderSection({
  folder,
  onEditFile,
}: {
  folder: MediaFolder;
  onEditFile: (item: MediaItem) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 縮圖：優先使用手動設定的 folder.thumbnail，否則自動 fetch 第一張圖
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    if (folder.thumbnail) {
      return getImageUrl(folder.thumbnail.formats?.thumbnail?.url || folder.thumbnail.url);
    }
    return null;
  });

  useEffect(() => {
    if (previewUrl !== null) return;       // 已有縮圖（手動設定），不需 fetch
    if (folder.file_count === 0) return;   // 空資料夾，不 fetch
    mediaApi.getMediaList({ folder_id: folder.id, per_page: 1 }).then((result) => {
      if (result.media.length > 0) {
        setPreviewUrl(getImageUrl(getSmallUrl(result.media[0])));
      }
    }).catch(() => {});
  }, []);

  const handleToggle = async () => {
    if (!isExpanded && !loaded) {
      setLoading(true);
      try {
        const result = await mediaApi.getMediaList({
          folder_id: folder.id,
          per_page: 100,
        });
        setMediaItems(result.media);
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load sub-folder media:', error);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className="flex items-center gap-3 py-2 text-left w-full hover:text-blue-600 transition-colors"
      >
        {/* 縮圖 */}
        <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
          {previewUrl ? (
            <img src={previewUrl} alt={folder.name} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          )}
        </div>

        {/* 展開箭頭 */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          fill="currentColor" viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>

        <h3 className="text-lg font-semibold text-gray-900">{folder.name}</h3>
        <span className="text-sm text-gray-400">({folder.file_count})</span>
      </button>

      {isExpanded && (
        <div className="pb-4">
          {loading ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, 180px)" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-[180px] h-[180px] bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : mediaItems.length > 0 ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, 180px)" }}>
              {mediaItems.map((item) => (
                <div
                  key={item.id}
                  className="w-[180px] h-[180px] relative group rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onEditFile(item)}
                >
                  <img
                    src={getImageUrl(getSmallUrl(item))}
                    alt={item.alt_text || item.original_filename}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder.svg'; }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">此資料夾中沒有媒體文件</p>
          )}
        </div>
      )}
    </div>
  );
}
