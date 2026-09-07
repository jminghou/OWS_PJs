import type { Author } from './types';
import { request, type FetchOptions } from './client';

// 作者頁文章卡片（後端 _content_card 的輕量投影）
export interface AuthorContentCard {
  id: number;
  title: string;
  slug: string;
  summary?: string;
  featured_image?: string;
  cover_image?: string;
  published_at?: string;
  language?: string;
  category?: { name?: string; slug?: string } | null;
}

export interface AuthorDetailResponse {
  author: Author;
  contents: AuthorContentCard[];
}

export const authorApi = {
  /** 取得單一作者的公開檔案 + 其已發佈文章（identifier 為 username）。 */
  getByUsername: async (
    username: string,
    language?: string,
    options: FetchOptions = {},
  ): Promise<AuthorDetailResponse> => {
    const params = language ? { language } : {};
    return request<AuthorDetailResponse>(`/authors/${encodeURIComponent(username)}`, {
      params,
      ...options,
    });
  },

  /** 列出有已發佈內容的作者（供 sitemap / 作者索引用）。 */
  getList: async (options: FetchOptions = {}): Promise<{ authors: Author[] }> => {
    return request<{ authors: Author[] }>('/authors', options);
  },
};
