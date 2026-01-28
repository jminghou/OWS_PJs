import type { User, LoginCredentials } from '@/types';
import { request } from './client';

export interface LoginResponse {
  user: User;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  getProfile: async (): Promise<User> => {
    return request<User>('/auth/profile');
  },

  logout: async (): Promise<void> => {
    await request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  refresh: async (): Promise<LoginResponse> => {
    return request<LoginResponse>('/auth/refresh', {
      method: 'POST',
    });
  },
};
