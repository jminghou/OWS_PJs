/**
 * Image Utilities for Responsive Images
 *
 * 使用 Strapi 自動生成的縮圖格式來優化載入效能
 */

import type { MediaItem, ImageFormats } from './strapi';

export type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/**
 * 取得優化後的圖片 URL
 * 依序嘗試取得指定尺寸，若不存在則降級至較小尺寸
 *
 * @param media - MediaItem 物件
 * @param preferredSize - 偏好的尺寸 (預設 'medium')
 * @returns 圖片 URL
 */
export function getOptimizedImageUrl(
  media: MediaItem,
  preferredSize: ImageSize = 'medium'
): string {
  // 如果沒有 formats，直接返回原始路徑
  if (!media.formats) {
    return media.file_path;
  }

  // 定義尺寸優先順序
  const sizePriority: Record<ImageSize, ImageSize[]> = {
    thumbnail: ['thumbnail', 'small', 'medium', 'large', 'original'],
    small: ['small', 'thumbnail', 'medium', 'large', 'original'],
    medium: ['medium', 'small', 'large', 'thumbnail', 'original'],
    large: ['large', 'medium', 'small', 'thumbnail', 'original'],
    original: ['original', 'large', 'medium', 'small', 'thumbnail'],
  };

  const sizes = sizePriority[preferredSize];

  for (const size of sizes) {
    if (size === 'original') {
      return media.file_path;
    }

    const format = media.formats[size];
    if (format?.url) {
      return format.url;
    }
  }

  return media.file_path;
}

/**
 * 取得縮圖 URL (用於列表顯示)
 */
export function getThumbnailUrl(media: MediaItem): string {
  return getOptimizedImageUrl(media, 'thumbnail');
}

/**
 * 取得小尺寸 URL (用於網格顯示)
 */
export function getSmallImageUrl(media: MediaItem): string {
  return getOptimizedImageUrl(media, 'small');
}

/**
 * 取得中尺寸 URL (用於預覽)
 */
export function getMediumImageUrl(media: MediaItem): string {
  return getOptimizedImageUrl(media, 'medium');
}

/**
 * 取得大尺寸 URL (用於詳情頁)
 */
export function getLargeImageUrl(media: MediaItem): string {
  return getOptimizedImageUrl(media, 'large');
}

/**
 * 取得原始尺寸 URL
 */
export function getOriginalImageUrl(media: MediaItem): string {
  return media.file_path;
}

/**
 * 判斷媒體是否有響應式格式
 */
export function hasResponsiveFormats(media: MediaItem): boolean {
  if (!media.formats) return false;
  return !!(
    media.formats.thumbnail ||
    media.formats.small ||
    media.formats.medium ||
    media.formats.large
  );
}

/**
 * 取得所有可用的格式資訊
 */
export function getAvailableFormats(media: MediaItem): {
  size: ImageSize;
  url: string;
  width?: number;
  height?: number;
}[] {
  const formats: {
    size: ImageSize;
    url: string;
    width?: number;
    height?: number;
  }[] = [];

  if (media.formats?.thumbnail) {
    formats.push({
      size: 'thumbnail',
      url: media.formats.thumbnail.url,
      width: media.formats.thumbnail.width,
      height: media.formats.thumbnail.height,
    });
  }

  if (media.formats?.small) {
    formats.push({
      size: 'small',
      url: media.formats.small.url,
      width: media.formats.small.width,
      height: media.formats.small.height,
    });
  }

  if (media.formats?.medium) {
    formats.push({
      size: 'medium',
      url: media.formats.medium.url,
      width: media.formats.medium.width,
      height: media.formats.medium.height,
    });
  }

  if (media.formats?.large) {
    formats.push({
      size: 'large',
      url: media.formats.large.url,
      width: media.formats.large.width,
      height: media.formats.large.height,
    });
  }

  // 加入原始尺寸
  formats.push({
    size: 'original',
    url: media.file_path,
    width: media.width,
    height: media.height,
  });

  return formats;
}
