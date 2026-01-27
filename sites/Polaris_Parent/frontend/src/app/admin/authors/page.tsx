'use client';

import { useState, useEffect } from 'react';
import { userApi } from '@/lib/api';
import { User } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function AuthorsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'all' | 'admin' | 'editor' | 'user'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // 用戶表單
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'editor' | 'user',
    is_active: true
  });
  const [userEditing, setUserEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [activeTab, searchTerm, currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        per_page: 20
      };

      if (activeTab !== 'all') {
        params.role = activeTab;
      }

      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const response = await userApi.getList(params);
      setUsers(response.users);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userForm.username.trim() || !userForm.email.trim()) {
      alert('請填寫用戶名和郵箱');
      return;
    }

    if (!userEditing && !userForm.password.trim()) {
      alert('新用戶請設置密碼');
      return;
    }

    try {
      if (userEditing) {
        // 更新用戶
        const updateData: any = {
          username: userForm.username,
          email: userForm.email,
          role: userForm.role,
          is_active: userForm.is_active
        };

        if (userForm.password.trim()) {
          updateData.password = userForm.password;
        }

        await userApi.update(userEditing, updateData);
        alert('用戶更新成功');
      } else {
        // 新增用戶
        await userApi.create(userForm);
        alert('用戶創建成功');
      }

      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert(error.message || '操作失敗，請稍後再試');
    }
  };

  const editUser = (user: User) => {
    setUserForm({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active
    });
    setUserEditing(user.id);
    setShowForm(true);
  };

  const deleteUser = async (id: number) => {
    if (confirm('確定要刪除這個用戶嗎？此操作無法撤銷。')) {
      try {
        await userApi.delete(id);
        alert('用戶刪除成功');
        fetchUsers();
      } catch (error: any) {
        console.error('Error deleting user:', error);
        alert(error.message || '刪除失敗，請稍後再試');
      }
    }
  };

  const toggleUserStatus = async (id: number) => {
    try {
      const result = await userApi.toggleStatus(id);
      alert(result.message);
      fetchUsers();
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      alert(error.message || '操作失敗，請稍後再試');
    }
  };

  const resetForm = () => {
    setUserForm({
      username: '',
      email: '',
      password: '',
      role: 'user',
      is_active: true
    });
    setUserEditing(null);
    setShowForm(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'editor':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理員';
      case 'editor':
        return '編輯者';
      case 'user':
        return '一般用戶';
      default:
        return role;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">作者管理</h1>
              <p className="text-gray-600">管理網站的用戶和作者帳戶</p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              新增用戶
            </Button>
          </div>
        </div>

        {/* 搜尋和篩選 */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 搜尋框 */}
              <div className="flex-1">
                <Input
                  placeholder="搜尋用戶名或郵箱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* 角色篩選 */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                    activeTab === 'all'
                      ? 'bg-brand-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                    activeTab === 'admin'
                      ? 'bg-brand-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  管理員
                </button>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                    activeTab === 'editor'
                      ? 'bg-brand-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  編輯者
                </button>
                <button
                  onClick={() => setActiveTab('user')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                    activeTab === 'user'
                      ? 'bg-brand-purple-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  一般用戶
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用戶表單 Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>
                  {userEditing ? '編輯用戶' : '新增用戶'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUserSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      用戶名 *
                    </label>
                    <Input
                      value={userForm.username}
                      onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="輸入用戶名"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      郵箱 *
                    </label>
                    <Input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="輸入郵箱地址"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      密碼 {!userEditing && '*'}
                    </label>
                    <Input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={userEditing ? "留空表示不修改密碼" : "設置密碼"}
                      required={!userEditing}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      角色
                    </label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple-500 focus:border-transparent"
                    >
                      <option value="user">一般用戶</option>
                      <option value="editor">編輯者</option>
                      <option value="admin">管理員</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={userForm.is_active}
                      onChange={(e) => setUserForm(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="mr-2"
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-700">
                      啟用帳戶
                    </label>
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button type="submit" className="flex-1">
                      {userEditing ? '更新用戶' : '創建用戶'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      取消
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 用戶列表 */}
        <Card>
          <CardHeader>
            <CardTitle>
              用戶列表
              <span className="text-sm font-normal text-gray-500 ml-2">
                共 {pagination.total || 0} 個用戶
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            ) : users.length > 0 ? (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900">{user.username}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </span>
                        {!user.is_active && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            已停用
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>註冊：{new Date(user.created_at).toLocaleDateString()}</span>
                        {user.last_login && (
                          <span>最後登入：{new Date(user.last_login).toLocaleDateString()}</span>
                        )}
                        {user.content_count !== undefined && (
                          <span>文章：{user.content_count} 篇</span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editUser(user)}
                      >
                        編輯
                      </Button>
                      <Button
                        size="sm"
                        variant={user.is_active ? "outline" : "default"}
                        onClick={() => toggleUserStatus(user.id)}
                      >
                        {user.is_active ? '停用' : '啟用'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteUser(user.id)}
                      >
                        刪除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">沒有找到相符的用戶</p>
              </div>
            )}

            {/* 分頁 */}
            {pagination.pages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <Button
                  variant="outline"
                  disabled={!pagination.has_prev}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  上一頁
                </Button>
                <span className="text-sm text-gray-600">
                  第 {pagination.page} 頁，共 {pagination.pages} 頁
                </span>
                <Button
                  variant="outline"
                  disabled={!pagination.has_next}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  下一頁
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}