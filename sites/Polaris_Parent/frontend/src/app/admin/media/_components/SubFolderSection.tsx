'use client';

import { useState } from 'react';
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
        className="flex items-center gap-2 py-3 text-left w-full hover:text-blue-600 transition-colors"
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
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
