import type { User } from '@/types';
import { request } from './client';

export const userApi = {
  getList: async (params?: {
    page?: number;
    per_page?: number;
    role?: string;
    search?: string;
  }): Promise<{
    users: User[];
    pagination: any;
  }> => {
    return request<{
      users: User[];
      pagination: any;
    }>('/users', { params });
  },

  create: async (data: {
    username: string;
    email: string;
    password: string;
    role?: string;
    is_active?: boolean;
  }): Promise<{ message: string; id: number; user: User }> => {
    return request<{ message: string; id: number; user: User }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: {
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    is_active?: boolean;
  }): Promise<{ message: string; user: User }> => {
    return request<{ message: string; user: User }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  toggleStatus: async (id: number): Promise<{ message: string; is_active: boolean }> => {
    return request<{ message: string; is_active: boolean }>(`/users/${id}/toggle-status`, {
      method: 'POST',
    });
  },
};

export const submissionApi = {
  create: async (data: {
    character_name?: string;
    birth_year?: string;
    birth_month?: string;
    birth_day?: string;
    birth_time?: string;
    birth_place?: string;
    question?: string;
  }): Promise<{ message: string; id: number }> => {
    return request<{ message: string; id: number }>('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getList: async (params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }): Promise<{
    submissions: any[];
    pagination: any;
  }> => {
    return request<{
      submissions: any[];
      pagination: any;
    }>('/admin/submissions', { params });
  },

  update: async (id: number, data: {
    status?: string;
    admin_notes?: string;
  }): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
