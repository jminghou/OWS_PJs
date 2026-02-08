/**
 * Image Utilities for Responsive Images
 *
 * 使用媒體庫自動生成的縮圖格式來優化載入效能
 */

import type { MediaItem, ImageFormats } from './strapi';

export type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/**
 * 取得優化後的圖片 URL
 * 依序嘗試取得指定尺寸，若不存在則降級至較小尺寸
 */
export function getOptimizedImageUrl(
  media: MediaItem,
  preferredSize: ImageSize = 'medium'
): string {
  if (!media.formats) {
    return media.file_path;
  }

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

export function getThumbnailUrl(media: MediaItem): string {
  return getOptimizedImageUrl(media, 'thumbnail');
}

export function getSmallImageUrl(media: MediaItem): string {
  return getOptimizedImageUrl(media, 'small');
}

export function getMediumImageUrl(media: MediaItem): string {
  return getOptimizedImageUrl(media, 'medium');
}

export function getLargeImageUrl(media: MediaItem): string {
  return getOptimizedImageUrl(media, 'large');
}

export function getOriginalImageUrl(media: MediaItem): string {
  return media.file_path;
}

export function hasResponsiveFormats(media: MediaItem): boolean {
  if (!media.formats) return false;
  return !!(
    media.formats.thumbnail ||
    media.formats.small ||
    media.formats.medium ||
    media.formats.large
  );
}

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

  const variantTypes: (keyof ImageFormats)[] = ['thumbnail', 'small', 'medium', 'large'];

  for (const type of variantTypes) {
    const format = media.formats?.[type];
    if (format) {
      formats.push({
        size: type as ImageSize,
        url: format.url,
        width: format.width,
        height: format.height,
      });
    }
  }

  formats.push({
    size: 'original',
    url: media.file_path,
    width: media.width,
    height: media.height,
  });

  return formats;
}
