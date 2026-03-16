'use client';

import { User } from '@/types';
import { Search, Plus, Trash2 } from 'lucide-react';
import { AdminPagination } from '@/components/admin/shared';

interface AuthorSidebarProps {
  users: User[];
  loading: boolean;
  selectedId: number | null;
  isCreateMode: boolean;
  pagination: any;
  currentPage: number;
  searchTerm: string;
  activeTab: 'all' | 'admin' | 'editor' | 'user';
  onSelectUser: (id: number) => void;
  onNewUser: () => void;
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: 'all' | 'admin' | 'editor' | 'user') => void;
  onDeleteUser: (id: number) => void;
}

const roleTabs: { key: 'all' | 'admin' | 'editor' | 'user'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'admin', label: '管理員' },
  { key: 'editor', label: '編輯' },
];

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-red-100 text-red-700';
    case 'editor': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case 'admin': return '管理員';
    case 'editor': return '編輯者';
    case 'user': return '用戶';
    default: return role;
  }
};

export default function AuthorSidebar({
  users,
  loading,
  selectedId,
  isCreateMode,
  pagination,
  currentPage,
  searchTerm,
  activeTab,
  onSelectUser,
  onNewUser,
  onPageChange,
  onSearchChange,
  onTabChange,
  onDeleteUser,
}: AuthorSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* New user button */}
      <div className="p-3 border-b border-gray-100">
        <button
          type="button"
          onClick={onNewUser}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isCreateMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Plus size={16} />
          新增用戶
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋用戶名或郵箱..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Role filter tabs */}
      <div className="flex px-3 pt-2 pb-1 gap-1">
        {roleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 px-1 py-1 text-xs font-medium rounded transition-colors ${
              activeTab === tab.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto border-t border-gray-100 mt-1">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-1.5" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : users.length > 0 ? (
          <div>
            {users.map((user) => (
              <div
                key={user.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectUser(user.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectUser(user.id); }}
                className={`group w-full text-left px-3 py-2.5 border-l-3 transition-colors cursor-pointer ${
                  selectedId === user.id
                    ? 'border-l-blue-600 bg-blue-50'
                    : 'border-l-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {user.username}
                      </span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${getRoleBadgeColor(user.role)}`}>
                        {getRoleDisplayName(user.role)}
                      </span>
                      {!user.is_active && (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                          停用
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {user.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteUser(user.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                    title="刪除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-400">
            沒有找到用戶
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="border-t border-gray-100 px-2 py-2">
          <AdminPagination
            pagination={pagination}
            currentPage={currentPage}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
