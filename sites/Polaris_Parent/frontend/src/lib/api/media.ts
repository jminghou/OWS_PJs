import { request } from './client';

export const mediaApi = {
  getFolders: async (): Promise<any[]> => {
    return request<any[]>('/media/folders');
  },

  createFolder: async (data: {
    name: string;
    parent_id?: number;
  }): Promise<{ message: string; folder: any }> => {
    return request<{ message: string; folder: any }>('/media/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateFolder: async (id: number, data: {
    name: string;
  }): Promise<{ message: string; folder: any }> => {
    return request<{ message: string; folder: any }>(`/media/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteFolder: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/media/folders/${id}`, {
      method: 'DELETE',
    });
  },

  getMediaList: async (params?: {
    page?: number;
    per_page?: number;
    folder_id?: number;
    search?: string;
  }): Promise<{
    media: any[];
    pagination: any;
  }> => {
    return request<{
      media: any[];
      pagination: any;
    }>('/media', { params });
  },

  updateMedia: async (id: number, data: {
    alt_text?: string;
    caption?: string;
    folder_id?: number;
  }): Promise<{ message: string; media: any }> => {
    return request<{ message: string; media: any }>(`/media/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteMedia: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/media/${id}`, {
      method: 'DELETE',
    });
  },

  uploadMedia: async (file: File, folderId?: number): Promise<{ message: string; media: any }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folder_id', folderId.toString());
    }

    return request<{ message: string; media: any }>('/media/upload', {
      method: 'POST',
      body: formData,
    });
  },

  moveMedia: async (mediaIds: number[], targetFolderId?: number): Promise<{ message: string }> => {
    return request<{ message: string }>('/media/move', {
      method: 'POST',
      body: JSON.stringify({
        media_ids: mediaIds,
        target_folder_id: targetFolderId,
      }),
    });
  },
};
