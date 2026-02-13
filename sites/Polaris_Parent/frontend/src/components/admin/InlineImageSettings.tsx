'use client';

import { useState } from 'react';
import { X, Image as ImageIcon, Plus } from 'lucide-react';
import MediaBrowser from '@/components/admin/MediaBrowser';
import { getImageUrl } from '@/lib/utils';
import { ArticleFormData } from './ArticleEditor';

interface InlineImageSettingsProps {
  formData: ArticleFormData;
  setFormData: React.Dispatch<React.SetStateAction<ArticleFormData>>;
}

export default function InlineImageSettings({
  formData,
  setFormData,
}: InlineImageSettingsProps) {
  const [showMediaBrowser, setShowMediaBrowser] = useState(false);

  const currentImage = formData.featured_image || formData.cover_image;

  const handleImageSelect = (media: any) => {
    // 根據 MediaItem 型別定義，路徑存放在 file_path 欄位
    const imagePath = media.file_path || media.url || media.path;
    setFormData(prev => ({
      ...prev,
      cover_image: imagePath,
      featured_image: imagePath
    }));
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({
      ...prev,
      cover_image: '',
      featured_image: ''
    }));
  };

  return (
    <div className="mb-8 pl-14">
      {currentImage ? (
        /* 已選擇圖片狀態：直接顯示圖片，右上角有 X */
        <div className="relative group aspect-[16/9] w-full max-w-2xl rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <img
            src={getImageUrl(currentImage, 'large')}
            alt="Article Cover"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              // 如果 large 尺寸不存在，嘗試載入原始圖片
              if (target.src.includes('_large')) {
                target.src = getImageUrl(currentImage);
              }
            }}
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
            title="移除圖片"
          >
            <X size={20} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white text-xs font-mono truncate">{currentImage}</p>
          </div>
        </div>
      ) : (
        /* 未選擇圖片狀態：僅保留媒體庫選擇按鈕 */
        <div className="max-w-2xl">
          <button
            type="button"
            onClick={() => setShowMediaBrowser(true)}
            className="w-full flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 hover:border-brand-purple-400 transition-all group"
          >
            <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-brand-purple-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">從媒體庫選擇封面圖片</p>
              <p className="text-xs text-gray-400 mt-1">點擊開啟媒體庫挑選已上傳的圖片</p>
            </div>
          </button>
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <ImageIcon size={12} />
            建議比例 16:9。此圖片將自動用於列表縮圖與文章大圖。
          </p>
        </div>
      )}

      <MediaBrowser
        isOpen={showMediaBrowser}
        onClose={() => setShowMediaBrowser(false)}
        onSelect={handleImageSelect}
      />
    </div>
  );
}
