import type { RbacPermission, RbacRole } from '@/types';
import { request } from './client';

export const rbacApi = {
  // Permissions grouped by module: { contents: [...], products: [...], ... }
  getPermissions: async (): Promise<{ modules: Record<string, RbacPermission[]> }> => {
    return request<{ modules: Record<string, RbacPermission[]> }>('/admin/rbac/permissions');
  },

  getRoles: async (): Promise<{ roles: RbacRole[] }> => {
    return request<{ roles: RbacRole[] }>('/admin/rbac/roles');
  },

  createRole: async (data: {
    code: string;
    name?: Record<string, string>;
    description?: Record<string, string>;
    permissions?: string[];
    is_active?: boolean;
  }): Promise<{ message: string; role: RbacRole }> => {
    return request<{ message: string; role: RbacRole }>('/admin/rbac/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateRole: async (id: number, data: {
    name?: Record<string, string>;
    description?: Record<string, string>;
    permissions?: string[];
    is_active?: boolean;
  }): Promise<{ message: string; role: RbacRole }> => {
    return request<{ message: string; role: RbacRole }>(`/admin/rbac/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteRole: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/rbac/roles/${id}`, {
      method: 'DELETE',
    });
  },

  getUserRoles: async (userId: number): Promise<{ roles: string[] }> => {
    return request<{ roles: string[] }>(`/admin/users/${userId}/roles`);
  },

  setUserRoles: async (userId: number, roles: string[]): Promise<{ message: string; roles: string[] }> => {
    return request<{ message: string; roles: string[] }>(`/admin/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roles }),
    });
  },
};
