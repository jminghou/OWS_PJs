/**
 * 站點專用 utils：純 utility 從 packages/ui 共用，
 * 但 getImageUrl/getGcsImageUrl 因兩站圖片 URL 命名規則不同保留各自實作。
 */

export {
  cn,
  formatDate,
  formatDateTime,
  truncateText,
  slugify,
  generateMetaTitle,
  generateMetaDescription,
  isValidEmail,
  isValidUrl,
  debounce,
  getCategoryPath,
  buildCategoryTree,
} from '../../../../../packages/ui/src/lib/utils';

export function getImageUrl(imagePath?: string, variant?: string): string {
  if (!imagePath) return '/placeholder.jpg';

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  const fullPath = `${baseUrl}${imagePath}`;

  if (variant) {
    // Claire: 前綴式 (variant_filename.ext)
    const lastSlashIndex = fullPath.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
      const dir = fullPath.substring(0, lastSlashIndex + 1);
      const filename = fullPath.substring(lastSlashIndex + 1);
      return `${dir}${variant}_${filename}`;
    }
  }
  return fullPath;
}

/**
 * 為 GCS 圖片獲取帶前綴的 URL
 */
export function getGcsImageUrl(imagePath: string, variant?: string): string {
  if (!imagePath) return '/placeholder.jpg';
  if (!variant) return imagePath;

  if (!imagePath.includes('storage.googleapis.com')) return getImageUrl(imagePath, variant);

  const lastSlashIndex = imagePath.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    const baseUrl = imagePath.substring(0, lastSlashIndex + 1);
    const filename = imagePath.substring(lastSlashIndex + 1);
    const cleanFilename = filename.replace(/^(thumbnail|small|medium|large)_/, '');
    return `${baseUrl}${variant}_${cleanFilename}`;
  }

  return imagePath;
}
