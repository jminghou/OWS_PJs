import type {
  Content,
  ContentListResponse,
  Category,
  Tag,
  Comment,
  CreateContentData,
  UpdateContentData,
} from '@/types';
import { request, type FetchOptions } from './client';

export const contentApi = {
  getList: async (params?: {
    page?: number;
    per_page?: number;
    category_id?: number;
    status?: string;
    type?: 'article';
    tag?: string;
    search?: string;
    language?: string;
  }, options: FetchOptions = {}): Promise<ContentListResponse> => {
    return request<ContentListResponse>('/contents', {
      params,
      ...options
    });
  },

  getById: async (id: number, options: FetchOptions = {}): Promise<Content> => {
    return request<Content>(`/contents/${id}`, options);
  },

  getBySlug: async (slug: string, language?: string, options: FetchOptions = {}): Promise<Content> => {
    const params = language ? { language } : {};
    return request<Content>(`/contents/slug/${slug}`, {
      params,
      ...options
    });
  },

  create: async (data: CreateContentData): Promise<{ message: string; id: number }> => {
    return request<{ message: string; id: number }>('/contents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: Partial<UpdateContentData>): Promise<{ message: string }> => {
    return request<{ message: string }>(`/contents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/contents/${id}`, {
      method: 'DELETE',
    });
  },

  getComments: async (contentId: number): Promise<Comment[]> => {
    return request<Comment[]>(`/contents/${contentId}/comments`);
  },

  getFeatured: async (limit: number = 5, options: FetchOptions = {}): Promise<Content[]> => {
    return request<Content[]>('/contents/featured', {
      params: { limit },
      ...options
    });
  },
};

export const categoryApi = {
  getList: async (language?: string, options: FetchOptions = {}): Promise<Category[]> => {
    const params = language ? { language } : {};
    return request<Category[]>('/categories', {
      params,
      ...options
    });
  },

  create: async (data: {
    code: string;
    slugs?: Record<string, string>;
    parent_id?: number;
    sort_order?: number;
  }): Promise<{ message: string; id: number; category: Category }> => {
    return request<{ message: string; id: number; category: Category }>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: {
    code: string;
    slugs?: Record<string, string>;
    parent_id?: number;
    sort_order?: number;
  }): Promise<{ message: string; category: Category }> => {
    return request<{ message: string; category: Category }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },
};

export const tagApi = {
  getList: async (language?: string, options: FetchOptions = {}): Promise<Tag[]> => {
    const params = language ? { language } : {};
    return request<Tag[]>('/tags', {
      params,
      ...options
    });
  },

  create: async (data: {
    code: string;
    slugs?: Record<string, string>;
  }): Promise<{ message: string; id: number; tag: Tag }> => {
    return request<{ message: string; id: number; tag: Tag }>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: {
    code: string;
    slugs?: Record<string, string>;
  }): Promise<{ message: string; tag: Tag }> => {
    return request<{ message: string; tag: Tag }>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/tags/${id}`, {
      method: 'DELETE',
    });
  },

  findOrCreate: async (codes: string[]): Promise<{
    message: string;
    tags: Tag[];
    tag_ids: number[];
  }> => {
    return request<{
      message: string;
      tags: Tag[];
      tag_ids: number[];
    }>('/tags/find-or-create', {
      method: 'POST',
      body: JSON.stringify({ codes }),
    });
  },
};
