'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { rbacApi, userApi } from '@/lib/api';
import { RolesManager, type RolesManagerApi } from '@/components/admin/shared';

const api: RolesManagerApi = {
  getPermissions: () => rbacApi.getPermissions(),
  getRoles: () => rbacApi.getRoles(),
  createRole: (data) => rbacApi.createRole(data),
  updateRole: (id, data) => rbacApi.updateRole(id, data),
  deleteRole: (id) => rbacApi.deleteRole(id),
  getUsers: () => userApi.getList({ per_page: 100 }),
  getUserRoles: (userId) => rbacApi.getUserRoles(userId),
  setUserRoles: (userId, roles) => rbacApi.setUserRoles(userId, roles),
};

export default function RolesPage() {
  return (
    <AdminLayout>
      <div className="bg-white min-h-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">權限管理</h1>
        </div>
        <RolesManager api={api} />
      </div>
    </AdminLayout>
  );
}
