/**
 * Media API - 媒體庫 API Client
 *
 * 對應後端 packages/media_lib 的 Blueprint 端點。
 * 所有請求經由 client.ts 的 request()，自動帶上 JWT cookie + CSRF。
 */

import { request } from './client';
import type { MediaItem, MediaFolder, MediaTag, FileMetadata } from './strapi';

// =============================================================================
// Media API
// =============================================================================

export const mediaApi = {
  /**
   * 取得資料夾列表
   */
  getFolders: async (parentId?: number): Promise<MediaFolder[]> => {
    try {
      const params: Record<string, any> = {};
      if (parentId) params.parent_id = parentId;
      return await request<MediaFolder[]>('/media-lib/folders', { params });
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      return [];
    }
  },

  /**
   * 建立資料夾
   */
  createFolder: async (data: {
    name: string;
    parent_id?: number;
  }): Promise<MediaFolder> => {
    return request<MediaFolder>('/media-lib/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * 更新資料夾名稱
   */
  updateFolder: async (id: number, data: { name: string }): Promise<MediaFolder> => {
    return request<MediaFolder>(`/media-lib/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * 刪除資料夾（必須為空）
   */
  deleteFolder: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/media-lib/folders/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 取得媒體列表（分頁、搜尋、資料夾/標籤篩選）
   */
  getMediaList: async (params?: {
    page?: number;
    per_page?: number;
    folder_id?: number | null;
    tag_id?: number;
    search?: string;
  }): Promise<{
    media: MediaItem[];
    pagination: {
      page: number;
      pages: number;
      per_page: number;
      total: number;
      has_prev: boolean;
      has_next: boolean;
    };
  }> => {
    const emptyResponse = {
      media: [],
      pagination: {
        page: 1,
        pages: 1,
        per_page: params?.per_page || 20,
        total: 0,
        has_prev: false,
        has_next: false,
      },
    };

    try {
      const queryParams: Record<string, any> = {};
      if (params?.page) queryParams.page = params.page;
      if (params?.per_page) queryParams.per_page = params.per_page;
      if (params?.folder_id !== undefined && params?.folder_id !== null) {
        queryParams.folder_id = params.folder_id;
      }
      if (params?.tag_id) queryParams.tag_id = params.tag_id;
      if (params?.search) queryParams.search = params.search;

      const data = await request<{
        files: any[];
        pagination: {
          page: number;
          pages: number;
          per_page: number;
          total: number;
        };
      }>('/media-lib/files', { params: queryParams });

      const media: MediaItem[] = data.files.map(apiFileToMediaItem);

      return {
        media,
        pagination: {
          ...data.pagination,
          has_prev: data.pagination.page > 1,
          has_next: data.pagination.page < data.pagination.pages,
        },
      };
    } catch (error) {
      console.error('Failed to fetch media list:', error);
      return emptyResponse;
    }
  },

  /**
   * 更新媒體 metadata
   */
  updateMedia: async (
    id: number,
    data: {
      alt_text?: string;
      caption?: string;
      folder_id?: number | null;
      tag_ids?: number[];
    }
  ): Promise<MediaItem> => {
    const result = await request<any>(`/media-lib/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return apiFileToMediaItem(result);
  },

  /**
   * 刪除媒體檔案
   */
  deleteMedia: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/media-lib/files/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 上傳媒體檔案（支援進度回調）
   */
  uploadMedia: async (
    file: File,
    folderId?: number,
    onProgress?: (percent: number) => void
  ): Promise<MediaItem> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folder_id', folderId.toString());
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api/v1';

    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(apiFileToMediaItem(result));
            } catch {
              reject(new Error('Failed to parse response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));

        xhr.open('POST', `${API_URL}/media-lib/files`);
        xhr.withCredentials = true;

        // 附加 CSRF token
        const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_access_token=([^;]*)/);
        if (csrfMatch) {
          xhr.setRequestHeader('X-CSRF-TOKEN', decodeURIComponent(csrfMatch[1]));
        }

        xhr.send(formData);
      });
    }

    // 沒有進度回調時使用 request (fetch)
    const result = await request<any>('/media-lib/files', {
      method: 'POST',
      body: formData,
    });
    return apiFileToMediaItem(result);
  },

  /**
   * 更新檔案的結構化 metadata
   */
  updateMetadata: async (
    id: number,
    data: FileMetadata
  ): Promise<FileMetadata> => {
    return request<FileMetadata>(`/media-lib/files/${id}/metadata`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * 批次移動檔案到目標資料夾
   */
  moveMedia: async (
    fileIds: number[],
    targetFolderId?: number | null
  ): Promise<{ message: string }> => {
    return request<{ message: string }>('/media-lib/files/move', {
      method: 'POST',
      body: JSON.stringify({
        file_ids: fileIds,
        folder_id: targetFolderId ?? null,
      }),
    });
  },
};

// =============================================================================
// Tag API
// =============================================================================

export const tagApi = {
  getAll: async (): Promise<MediaTag[]> => {
    try {
      return await request<MediaTag[]>('/media-lib/tags');
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      return [];
    }
  },

  create: async (data: { name: string; color?: string }): Promise<MediaTag> => {
    return request<MediaTag>('/media-lib/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/media-lib/tags/${id}`, {
      method: 'DELETE',
    });
  },
};

// =============================================================================
// Import API (GCS 掃描匯入)
// =============================================================================

export interface GcsScanFile {
  gcs_path: string;
  public_url: string;
  filename: string;
  file_size: number;
  mime_type: string;
  updated: string | null;
}

export const importApi = {
  /**
   * 掃描 GCS，列出尚未匯入的檔案
   */
  scan: async (prefix?: string): Promise<{ total_found: number; files: GcsScanFile[] }> => {
    const params: Record<string, any> = {};
    if (prefix) params.prefix = prefix;
    return request('/media-lib/import/scan', { params });
  },

  /**
   * 執行匯入
   */
  execute: async (data: {
    files: GcsScanFile[];
    folder_id?: number | null;
    generate_variants?: boolean;
  }): Promise<{ imported: number; skipped: number; errors: any[] }> => {
    return request('/media-lib/import/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// =============================================================================
// Helper: 將後端 API 回傳轉換為前端 MediaItem
// =============================================================================

function apiFileToMediaItem(file: any): MediaItem {
  return {
    id: file.id,
    filename: file.filename,
    original_filename: file.original_filename,
    file_path: file.public_url,
    file_size: file.file_size,
    mime_type: file.mime_type,
    alt_text: file.alt_text || undefined,
    caption: file.caption || undefined,
    folder_id: file.folder_id || undefined,
    created_at: file.created_at,
    formats: file.formats || undefined,
    width: file.width || undefined,
    height: file.height || undefined,
    tags: file.tags || undefined,
    metadata: file.metadata || undefined,
  };
}
