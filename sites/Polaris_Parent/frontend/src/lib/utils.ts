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

  // Absolute URLs (GCS, CDN, etc.)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    if (variant) {
      // Handle GCS variant naming convention: path/to/image.png -> path/to/image_variant.png
      const lastDotIndex = imagePath.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        return `${imagePath.substring(0, lastDotIndex)}_${variant}${imagePath.substring(lastDotIndex)}`;
      }
    }
    return imagePath;
  }

  // Relative paths - prepend backend URL
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  if (variant) {
    const lastDotIndex = imagePath.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      return `${baseUrl}${imagePath.substring(0, lastDotIndex)}_${variant}${imagePath.substring(lastDotIndex)}`;
    }
  }
  return `${baseUrl}${imagePath}`;
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