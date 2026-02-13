import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string, formatStr: string = 'yyyy-MM-dd'): string {
  try {
    return format(parseISO(dateString), formatStr);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    return format(parseISO(dateString), 'yyyy-MM-dd HH:mm');
  } catch {
    return dateString;
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateMetaTitle(title: string, siteName?: string): string {
  return siteName ? `${title} | ${siteName}` : title;
}

export function generateMetaDescription(content: string, maxLength: number = 160): string {
  const plainText = content.replace(/<[^>]*>/g, '');
  return truncateText(plainText, maxLength);
}

export function getImageUrl(imagePath?: string, variant?: string): string {
  if (!imagePath) return '/placeholder.jpg';

  // 1. 處理絕對路徑 (GCS, CDN 等)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 2. 處理相對路徑 (後端本地 uploads)
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  const fullPath = `${baseUrl}${imagePath}`;

  if (variant) {
    const lastDotIndex = fullPath.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      return `${fullPath.substring(0, lastDotIndex)}_${variant}${fullPath.substring(lastDotIndex)}`;
    }
  }
  return fullPath;
}

/**
 * 專門為 GCS 圖片獲取帶前綴的 URL
 * 邏輯：優先返回帶前綴的 URL (如 medium_, large_)，
 * 但因為前端無法預知檔案是否存在，建議配合 Image 組件的 onError 使用
 */
export function getGcsImageUrl(imagePath: string, variant?: string): string {
  if (!imagePath) return '/placeholder.jpg';
  if (!variant) return imagePath;

  // 檢查是否為 GCS 網址
  if (!imagePath.includes('storage.googleapis.com')) return getImageUrl(imagePath, variant);

  // 移除可能存在的副檔名（如果有的話，例如 .png），因為 GCS 上的縮圖檔名可能是 filename_variant 或 variant_filename
  // 但從截圖看，您的縮圖檔名是 variant_filename (例如 small_925414e4_png)
  // 關鍵在於：您的原圖檔名是 925414e4_png (底線而非點)
  
  const lastSlashIndex = imagePath.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    const baseUrl = imagePath.substring(0, lastSlashIndex + 1);
    const filename = imagePath.substring(lastSlashIndex + 1);
    
    // 如果檔名中包含變體前綴，先移除它避免重複 (例如避免變成 small_small_...)
    const cleanFilename = filename.replace(/^(thumbnail|small|medium|large)_/, '');
    
    return `${baseUrl}${variant}_${cleanFilename}`;
  }
  
  return imagePath;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function getCategoryPath(categories: any[], categoryId?: number): string {
  if (!categoryId) return '';
  
  const category = categories.find(c => c.id === categoryId);
  if (!category) return '';
  
  if (category.parent_id) {
    const parentPath = getCategoryPath(categories, category.parent_id);
    return parentPath ? `${parentPath}/${category.slug}` : category.slug;
  }
  
  return category.slug;
}

export function buildCategoryTree(categories: any[]): any[] {
  const categoryMap = new Map();
  const rootCategories: any[] = [];
  
  categories.forEach(category => {
    categoryMap.set(category.id, { ...category, children: [] });
  });
  
  categories.forEach(category => {
    const categoryWithChildren = categoryMap.get(category.id);
    if (category.parent_id) {
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        parent.children.push(categoryWithChildren);
      }
    } else {
      rootCategories.push(categoryWithChildren);
    }
  });
  
  return rootCategories;
}