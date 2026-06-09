import type { ContentListResponse } from '@/types';

/**
 * 文章列表的前端記憶體快取（module 級，存活於 SPA 導覽期間）。
 *
 * 目的：切換分類/類型/分頁時，若該組合先前抓過，立即用快取渲染、不再顯示整頁骨架，
 * 同時在背景重新驗證（stale-while-revalidate）。後端本身已有 120s 回應快取，
 * 背景重新驗證成本很低。重新整理頁面後快取自然清空。
 */
const cache = new Map<string, ContentListResponse>();

/** 由查詢參數產生穩定的快取 key（排序 + 去除空值，確保等價參數命中同一 key）。 */
export function contentsListCacheKey(params: Record<string, unknown>): string {
  const normalized: Record<string, unknown> = {};
  Object.keys(params)
    .sort()
    .forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') {
        normalized[k] = v;
      }
    });
  return JSON.stringify(normalized);
}

export function getCachedContentsList(key: string): ContentListResponse | undefined {
  return cache.get(key);
}

export function setCachedContentsList(key: string, value: ContentListResponse): void {
  cache.set(key, value);
}
