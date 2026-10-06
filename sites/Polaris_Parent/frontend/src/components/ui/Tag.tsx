/**
 * 標籤（docs/BRAND_GUIDELINES.md §6.2）：膠囊、無邊框，依語意選色。一張卡片最多兩個標籤。
 */
import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type TagTone = 'category' | 'status' | 'age' | 'hot';

const TONES: Record<TagTone, string> = {
  category: 'bg-blue-50 text-blue-800', // 分類：命宮、親子溝通、親紫專欄
  status: 'bg-pink-50 text-pink-800', // 狀態：新文章、限時
  age: 'bg-leaf-100 text-leaf-800', // 年齡段：學齡前、國小
  hot: 'bg-star-100 text-star-800', // 熱度：★ 熱門
};

export const TAG_BASE = 'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] leading-none whitespace-nowrap';

/** 篩選標籤（按鈕）的 class：未選中白底細框、選中藍底白字 */
export function filterTag(selected: boolean, className?: string) {
  return clsx(
    TAG_BASE,
    'transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100',
    selected
      ? 'bg-blue-500 text-white font-bold'
      : 'bg-white border-[1.5px] border-line-strong text-ink hover:border-blue-500',
    className
  );
}

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
}

export default function Tag({ tone = 'category', className, ...props }: TagProps) {
  return <span className={clsx(TAG_BASE, TONES[tone], className)} {...props} />;
}
