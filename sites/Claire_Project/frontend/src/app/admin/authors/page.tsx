'use client';

import { useState, useEffect } from 'react';
import { userApi } from '@/lib/api';
import { User } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import { AdminListLayout, AdminEmptyState } from '@/components/admin/shared';
import { AuthorSidebar, AuthorForm } from './_components';
import { Users } from 'lucide-react';

export default function AuthorsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'all' | 'admin' | 'editor' | 'user'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);

  // User form
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'editor' as 'admin' | 'editor' | 'user',
    is_active: true,
  });
  const [userEditing, setUserEditing] = useState<number | null>(null);

  // The original user object for display in edit mode
  const selectedUser = selectedId ? users.find(u => u.id === selectedId) : undefined;

  useEffect(() => {
    fetchUsers();
  }, [activeTab, searchTerm, currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params: any = { page: currentPage, per_page: 20 };
      if (activeTab !== 'all') params.role = activeTab;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await userApi.getList(params);
      setUsers(response.users);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUserForm({ username: '', email: '', password: '', role: 'editor', is_active: true });
    setUserEditing(null);
  };

  const handleSelectUser = (id: number) => {
    if (selectedId === id) return;
    setSelectedId(id);
    setIsCreateMode(false);

    const user = users.find(u => u.id === id);
    if (user) {
      setUserForm({
        username: user.username,
        email: user.email,
        password: '',
        role: user.role,
        is_active: user.is_active,
      });
      setUserEditing(user.id);
    }
  };

  const handleNewUser = () => {
    if (isCreateMode) return;
    setSelectedId(null);
    setIsCreateMode(true);
    resetForm();
  };

  const handleCancel = () => {
    setSelectedId(null);
    setIsCreateMode(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
        const updateData: any = {
          username: userForm.username,
          email: userForm.email,
          role: userForm.role,
          is_active: userForm.is_active,
        };
        if (userForm.password.trim()) {
          updateData.password = userForm.password;
        }
        await userApi.update(userEditing, updateData);
        alert('用戶更新成功');
      } else {
        const result = await userApi.create(userForm);
        alert('用戶創建成功');
        if (result.id) {
          setSelectedId(result.id);
          setIsCreateMode(false);
        }
      }
      fetchUsers();
    } catch (error: any) {
      alert(error.message || '操作失敗，請稍後再試');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('確定要刪除這個用戶嗎？此操作無法撤銷。')) return;
    try {
      await userApi.delete(id);
      alert('用戶刪除成功');
      fetchUsers();
      if (selectedId === id) {
        setSelectedId(null);
        setIsCreateMode(false);
        resetForm();
      }
    } catch (error: any) {
      alert(error.message || '刪除失敗，請稍後再試');
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedId) return;
    try {
      const result = await userApi.toggleStatus(selectedId);
      alert(result.message);
      fetchUsers();
      // Update form state to reflect new status
      setUserForm(prev => ({ ...prev, is_active: !prev.is_active }));
    } catch (error: any) {
      alert(error.message || '操作失敗，請稍後再試');
    }
  };

  const handleTabChange = (tab: 'all' | 'admin' | 'editor' | 'user') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const showForm = isCreateMode || selectedId !== null;

  return (
    <AdminLayout>
      <AdminListLayout
        sidebarWidth={280}
        sidebar={
          <AuthorSidebar
            users={users}
            loading={loading}
            selectedId={selectedId}
            isCreateMode={isCreateMode}
            pagination={pagination}
            currentPage={currentPage}
            searchTerm={searchTerm}
            activeTab={activeTab}
            onSelectUser={handleSelectUser}
            onNewUser={handleNewUser}
            onPageChange={setCurrentPage}
            onSearchChange={handleSearchChange}
            onTabChange={handleTabChange}
            onDeleteUser={handleDeleteUser}
          />
        }
      >
        {showForm ? (
          <AuthorForm
            key={userEditing ? `edit-${userEditing}` : 'new'}
            isEditing={selectedId !== null}
            username={userForm.username}
            email={userForm.email}
            password={userForm.password}
            role={userForm.role}
            isActive={userForm.is_active}
            user={selectedUser}
            onUsernameChange={(v) => setUserForm(prev => ({ ...prev, username: v }))}
            onEmailChange={(v) => setUserForm(prev => ({ ...prev, email: v }))}
            onPasswordChange={(v) => setUserForm(prev => ({ ...prev, password: v }))}
            onRoleChange={(v) => setUserForm(prev => ({ ...prev, role: v }))}
            onIsActiveChange={(v) => setUserForm(prev => ({ ...prev, is_active: v }))}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onToggleStatus={selectedId ? handleToggleStatus : undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <AdminEmptyState
              icon={<Users size={48} className="text-gray-300" />}
              title="選擇用戶開始編輯"
              description="從左側選擇一位用戶，或點擊「新增用戶」建立新帳戶"
            />
          </div>
        )}
      </AdminListLayout>
    </AdminLayout>
  );
}
