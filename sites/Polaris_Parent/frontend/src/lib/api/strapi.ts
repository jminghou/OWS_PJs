/**
 * Strapi Media API Client
 *
 * This module provides functions to interact with Strapi's Media Library API.
 * It handles file uploads, folder management, and media CRUD operations.
 */

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

// =============================================================================
// Types
// =============================================================================

export interface StrapiFile {
  id: number;
  documentId: string;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  formats: {
    thumbnail?: { url: string; width: number; height: number };
    small?: { url: string; width: number; height: number };
    medium?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  } | null;
  hash: string;
  ext: string;
  mime: string;
  size: number; // in KB
  url: string;
  previewUrl: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
  folder?: { id: number } | null;
  folderPath?: string;
}

export interface StrapiFolder {
  id: number;
  documentId: string;
  name: string;
  pathId: number;
  path: string;
  createdAt: string;
  updatedAt: string;
  parent?: { id: number } | null;
  children?: { count: number };
  files?: { count: number };
}

export interface StrapiPagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

// Legacy interfaces for compatibility with existing components
export interface MediaItem {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  alt_text?: string;
  caption?: string;
  folder_id?: number;
  created_at: string;
}

export interface MediaFolder {
  id: number;
  name: string;
  parent_id?: number;
  path: string;
  created_at: string;
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert Strapi file response to legacy MediaItem format
 */
export function strapiFileToMediaItem(file: StrapiFile): MediaItem {
  return {
    id: file.id,
    filename: file.hash + file.ext,
    original_filename: file.name,
    file_path: file.url,
    file_size: Math.round(file.size * 1024), // Convert KB to bytes
    mime_type: file.mime,
    alt_text: file.alternativeText ?? undefined,
    caption: file.caption ?? undefined,
    folder_id: file.folder?.id,
    created_at: file.createdAt,
  };
}

/**
 * Convert Strapi folder response to legacy MediaFolder format
 */
export function strapiFolderToMediaFolder(folder: StrapiFolder): MediaFolder {
  return {
    id: folder.id,
    name: folder.name,
    parent_id: folder.parent?.id,
    path: folder.path || folder.name,
    created_at: folder.createdAt,
  };
}

// =============================================================================
// API Request Helper
// =============================================================================

interface StrapiRequestOptions {
  method?: string;
  body?: FormData | string;
  headers?: Record<string, string>;
}

async function strapiRequest<T>(
  endpoint: string,
  options: StrapiRequestOptions = {}
): Promise<T> {
  const headers: HeadersInit = {
    ...options.headers,
  };

  // Don't set Content-Type for FormData (browser will set it with boundary)
  if (typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${STRAPI_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Strapi error: ${response.statusText}`);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// =============================================================================
// Folder API
// =============================================================================

export const strapiFolderApi = {
  /**
   * List all folders
   */
  list: async (): Promise<StrapiFolder[]> => {
    const response = await strapiRequest<{ data: StrapiFolder[] }>('/api/upload/folders');
    return response.data || [];
  },

  /**
   * Create a new folder
   */
  create: async (name: string, parent?: number): Promise<StrapiFolder> => {
    const response = await strapiRequest<{ data: StrapiFolder }>('/api/upload/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent }),
    });
    return response.data;
  },

  /**
   * Update folder name
   */
  update: async (id: number, name: string): Promise<StrapiFolder> => {
    const response = await strapiRequest<{ data: StrapiFolder }>(`/api/upload/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    return response.data;
  },

  /**
   * Delete a folder (must be empty)
   */
  delete: async (id: number): Promise<void> => {
    await strapiRequest(`/api/upload/folders/${id}`, {
      method: 'DELETE',
    });
  },
};

// =============================================================================
// Media/File API
// =============================================================================

export const strapiMediaApi = {
  /**
   * List files with optional filtering and pagination
   */
  list: async (params?: {
    folder?: number | null;
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<{ results: StrapiFile[]; pagination: StrapiPagination }> => {
    const searchParams = new URLSearchParams();

    if (params?.page) {
      searchParams.set('page', params.page.toString());
    }
    if (params?.pageSize) {
      searchParams.set('pageSize', params.pageSize.toString());
    }
    if (params?.folder !== undefined) {
      if (params.folder === null) {
        // Root folder - files without folder
        searchParams.set('filters[folder][id][$null]', 'true');
      } else {
        searchParams.set('filters[folder][id][$eq]', params.folder.toString());
      }
    }
    if (params?.search) {
      searchParams.set('filters[name][$containsi]', params.search);
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/upload/files${queryString ? `?${queryString}` : ''}`;

    const response = await strapiRequest<StrapiFile[] | { results: StrapiFile[]; pagination: StrapiPagination }>(endpoint);

    // Handle both array and paginated response formats
    if (Array.isArray(response)) {
      return {
        results: response,
        pagination: {
          page: 1,
          pageSize: response.length,
          pageCount: 1,
          total: response.length,
        },
      };
    }

    return response;
  },

  /**
   * Get a single file by ID
   */
  get: async (id: number): Promise<StrapiFile> => {
    return strapiRequest<StrapiFile>(`/api/upload/files/${id}`);
  },

  /**
   * Upload a file - this goes through the Next.js API route for token security
   */
  upload: async (file: File, folderId?: number): Promise<StrapiFile[]> => {
    const formData = new FormData();
    formData.append('files', file);
    if (folderId) {
      formData.append('folder', folderId.toString());
    }

    // Upload through Next.js API route to keep token secure
    const response = await fetch('/api/strapi-upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  },

  /**
   * Update file metadata (alt text, caption)
   */
  update: async (
    id: number,
    data: { alternativeText?: string; caption?: string; folder?: number | null }
  ): Promise<StrapiFile> => {
    const formData = new FormData();
    formData.append('fileInfo', JSON.stringify({
      alternativeText: data.alternativeText,
      caption: data.caption,
      folder: data.folder,
    }));

    return strapiRequest<StrapiFile>(`/api/upload/files/${id}`, {
      method: 'POST', // Strapi uses POST for file updates
      body: formData,
    });
  },

  /**
   * Delete a file
   */
  delete: async (id: number): Promise<void> => {
    await strapiRequest(`/api/upload/files/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Move files to a folder
   */
  move: async (fileIds: number[], targetFolderId?: number | null): Promise<void> => {
    // Strapi doesn't have a bulk move endpoint, so we update each file
    await Promise.all(
      fileIds.map((id) =>
        strapiMediaApi.update(id, { folder: targetFolderId ?? null })
      )
    );
  },
};
