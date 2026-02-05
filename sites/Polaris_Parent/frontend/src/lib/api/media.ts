/**
 * Media API - Strapi Integration
 *
 * This module provides the same interface as the original Python backend media API,
 * but now uses Strapi as the backend through Next.js API routes.
 */

import {
  strapiFileToMediaItem,
  strapiFolderToMediaFolder,
  type MediaItem,
  type MediaFolder,
  type StrapiFile,
  type StrapiFolder,
} from './strapi';

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

// =============================================================================
// Internal fetch helper
// =============================================================================

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Request failed: ${response.statusText}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// =============================================================================
// Media API - Compatible with existing components
// =============================================================================

export const mediaApi = {
  /**
   * Get all folders
   */
  getFolders: async (): Promise<MediaFolder[]> => {
    try {
      const response = await fetch('/api/strapi-folders');
      if (!response.ok) {
        console.warn('Folders API returned:', response.status);
        return [];
      }
      const data = await response.json();
      const folders = data.data || [];
      return folders.map(strapiFolderToMediaFolder);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      return []; // Return empty array if Strapi is unavailable
    }
  },

  /**
   * Create a new folder
   */
  createFolder: async (data: {
    name: string;
    parent_id?: number;
  }): Promise<{ message: string; folder: MediaFolder }> => {
    const response = await fetchJson<{ data: StrapiFolder }>('/api/strapi-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        parent: data.parent_id,
      }),
    });

    return {
      message: 'Folder created successfully',
      folder: strapiFolderToMediaFolder(response.data),
    };
  },

  /**
   * Update folder name
   */
  updateFolder: async (
    id: number,
    data: { name: string }
  ): Promise<{ message: string; folder: MediaFolder }> => {
    const response = await fetchJson<{ data: StrapiFolder }>(
      `/api/strapi-folders?folderId=${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name }),
      }
    );

    return {
      message: 'Folder updated successfully',
      folder: strapiFolderToMediaFolder(response.data),
    };
  },

  /**
   * Delete a folder (must be empty)
   */
  deleteFolder: async (id: number): Promise<{ message: string }> => {
    await fetchJson(`/api/strapi-folders?folderId=${id}`, {
      method: 'DELETE',
    });

    return { message: 'Folder deleted successfully' };
  },

  /**
   * Get media list with pagination and filtering
   */
  getMediaList: async (params?: {
    page?: number;
    per_page?: number;
    folder_id?: number | null;
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
      // Build query params for Strapi
      const searchParams = new URLSearchParams();

      if (params?.page) {
        searchParams.set('pagination[page]', params.page.toString());
      }
      if (params?.per_page) {
        searchParams.set('pagination[pageSize]', params.per_page.toString());
      }
      if (params?.folder_id !== undefined) {
        if (params.folder_id === null) {
          searchParams.set('filters[folder][id][$null]', 'true');
        } else {
          searchParams.set('filters[folder][id][$eq]', params.folder_id.toString());
        }
      }
      if (params?.search) {
        searchParams.set('filters[name][$containsi]', params.search);
      }

      const queryString = searchParams.toString();
      const endpoint = `/api/strapi-files${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        console.error('Failed to fetch media list:', response.statusText);
        return emptyResponse;
      }

      const data = await response.json();

      // Handle both array and paginated response formats
      let files: StrapiFile[];
      let pagination: { page: number; pageSize: number; pageCount: number; total: number };

      if (Array.isArray(data)) {
        files = data;
        pagination = {
          page: 1,
          pageSize: files.length,
          pageCount: 1,
          total: files.length,
        };
      } else {
        files = data.results || data;
        pagination = data.pagination || {
          page: 1,
          pageSize: files.length,
          pageCount: 1,
          total: files.length,
        };
      }

      return {
        media: files.map(strapiFileToMediaItem),
        pagination: {
          page: pagination.page,
          pages: pagination.pageCount,
          per_page: pagination.pageSize,
          total: pagination.total,
          has_prev: pagination.page > 1,
          has_next: pagination.page < pagination.pageCount,
        },
      };
    } catch (error) {
      console.error('Failed to fetch media list:', error);
      return emptyResponse;
    }
  },

  /**
   * Update media metadata
   */
  updateMedia: async (
    id: number,
    data: {
      alt_text?: string;
      caption?: string;
      folder_id?: number | null;
    }
  ): Promise<{ message: string; media: MediaItem }> => {
    const response = await fetchJson<StrapiFile>(`/api/strapi-upload?fileId=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alternativeText: data.alt_text,
        caption: data.caption,
        folder: data.folder_id,
      }),
    });

    return {
      message: 'Media updated successfully',
      media: strapiFileToMediaItem(response),
    };
  },

  /**
   * Delete a media file
   */
  deleteMedia: async (id: number): Promise<{ message: string }> => {
    await fetchJson(`/api/strapi-upload?fileId=${id}`, {
      method: 'DELETE',
    });

    return { message: 'Media deleted successfully' };
  },

  /**
   * Upload a media file with optional progress callback
   */
  uploadMedia: async (
    file: File,
    folderId?: number,
    onProgress?: (percent: number) => void
  ): Promise<{ message: string; media: MediaItem }> => {
    const formData = new FormData();
    formData.append('files', file);
    if (folderId) {
      formData.append('folder', folderId.toString());
    }

    // 如果有進度回調，使用 XMLHttpRequest
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
              const files: StrapiFile[] = JSON.parse(xhr.responseText);
              resolve({
                message: 'Upload successful',
                media: strapiFileToMediaItem(files[0]),
              });
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || 'Upload failed'));
            } catch (e) {
              reject(new Error('Upload failed'));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });

        xhr.open('POST', '/api/strapi-upload');
        xhr.send(formData);
      });
    }

    // 沒有進度回調時使用 fetch
    const response = await fetch('/api/strapi-upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    const files: StrapiFile[] = await response.json();

    return {
      message: 'Upload successful',
      media: strapiFileToMediaItem(files[0]),
    };
  },

  /**
   * Move media files to a folder
   */
  moveMedia: async (
    mediaIds: number[],
    targetFolderId?: number | null
  ): Promise<{ message: string }> => {
    // Update each file's folder
    await Promise.all(
      mediaIds.map((id) =>
        fetchJson(`/api/strapi-upload?fileId=${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: targetFolderId ?? null }),
        })
      )
    );

    return { message: 'Media moved successfully' };
  },
};

// =============================================================================
// MediaMeta Types
// =============================================================================

export interface MediaMeta {
  id: number;
  documentId?: string;
  chartid?: string;
  place?: string;
  copyright?: string;
  isPublic?: boolean;
  tags?: { id: number; name: string }[];
  category?: { id: number; name: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MediaMetaInput {
  chartid?: string;
  place?: string;
  copyright?: string;
  isPublic?: boolean;
  tags?: number[];
  category?: number[];
}

// =============================================================================
// MediaMeta API
// =============================================================================

export const mediaMetaApi = {
  /**
   * Get MediaMeta by file ID
   * Returns null if not found (this is normal for new media files)
   */
  getByFileId: async (fileId: number): Promise<MediaMeta | null> => {
    try {
      const response = await fetch(`/api/strapi-media-meta?fileId=${fileId}`);
      if (!response.ok) {
        // 404 是正常的（媒體可能還沒有 MediaMeta），不需要顯示錯誤
        if (response.status !== 404) {
          console.warn('Failed to fetch media meta:', response.statusText);
        }
        return null;
      }
      const data = await response.json();
      return data.data || null;
    } catch (error) {
      console.error('Error fetching media meta:', error);
      return null;
    }
  },

  /**
   * Create or update MediaMeta
   * @param fileId - The Strapi file ID
   * @param data - The metadata to save
   * @param existingDocumentId - The documentId if updating an existing record (Strapi 5)
   */
  save: async (
    fileId: number,
    data: MediaMetaInput,
    existingDocumentId?: string
  ): Promise<MediaMeta | null> => {
    try {
      const response = await fetch('/api/strapi-media-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          documentId: existingDocumentId,
          ...data,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save media meta');
      }

      const result = await response.json();
      return result.data || null;
    } catch (error) {
      console.error('Error saving media meta:', error);
      throw error;
    }
  },
};

// =============================================================================
// Tag Types and API
// =============================================================================

export interface Tag {
  id: number;
  documentId?: string;
  name: string;
}

export const tagApi = {
  /**
   * Get all tags
   */
  getAll: async (): Promise<Tag[]> => {
    try {
      const response = await fetch('/api/strapi-tags');
      if (!response.ok) {
        console.error('Failed to fetch tags:', response.statusText);
        return [];
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  },

  /**
   * Create a new tag
   */
  create: async (name: string): Promise<Tag | null> => {
    try {
      const response = await fetch('/api/strapi-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create tag');
      }

      const result = await response.json();
      return result.data || null;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  },
};

// =============================================================================
// Category Types and API
// =============================================================================

export interface Category {
  id: number;
  documentId?: string;
  name: string;
  description?: string;
}

export const categoryApi = {
  /**
   * Get all categories
   */
  getAll: async (): Promise<Category[]> => {
    try {
      const response = await fetch('/api/strapi-categories');
      if (!response.ok) {
        console.error('Failed to fetch categories:', response.statusText);
        return [];
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  /**
   * Create a new category
   */
  create: async (name: string, description?: string): Promise<Category | null> => {
    try {
      const response = await fetch('/api/strapi-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create category');
      }

      const result = await response.json();
      return result.data || null;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },
};
