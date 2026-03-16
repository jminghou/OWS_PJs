'use client';

import { Category, Tag } from '@/types';
import { LayoutGrid, Tag as TagIcon, Edit2, Trash2, Plus, Search } from 'lucide-react';

interface CategoryTagSidebarProps {
  activeTab: 'categories' | 'tags';
  onTabChange: (tab: 'categories' | 'tags') => void;
  categories: Category[];
  tags: Tag[];
  loading: boolean;
  selectedId: number | null;
  isCreateMode: boolean;
  tagSearch: string;
  onTagSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
}

export default function CategoryTagSidebar({
  activeTab,
  onTabChange,
  categories,
  tags,
  loading,
  selectedId,
  isCreateMode,
  tagSearch,
  onTagSearchChange,
  onSelect,
  onCreate,
  onDelete,
}: CategoryTagSidebarProps) {
  const items = activeTab === 'categories' ? categories : tags;
  const filteredItems = activeTab === 'tags' && tagSearch
    ? (items as Tag[]).filter(tag => {
        const s = tagSearch.toLowerCase();
        if (tag.code.toLowerCase().includes(s)) return true;
        return tag.slugs && Object.values(tag.slugs).some(slug => slug.toLowerCase().includes(s));
      })
    : items;

  return (
    <div className="flex flex-col h-full">
      {/* Section tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => onTabChange('categories')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'categories'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <LayoutGrid size={14} />
          分類
        </button>
        <button
          type="button"
          onClick={() => onTabChange('tags')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'tags'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <TagIcon size={14} />
          標籤
        </button>
      </div>

      {/* New button */}
      <div className="p-3 border-b border-gray-100">
        <button
          type="button"
          onClick={onCreate}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isCreateMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Plus size={16} />
          {activeTab === 'categories' ? '新增分類' : '新增標籤'}
        </button>
      </div>

      {/* Search (tags only) */}
      {activeTab === 'tags' && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋標籤..."
              value={tagSearch}
              onChange={(e) => onTagSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 overflow-y-auto mt-1">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-1" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div>
            {filteredItems.map((item) => {
              const displayName = item.slugs
                ? Object.values(item.slugs)[0] || item.code
                : item.code;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(item.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(item.id); }}
                  className={`group w-full text-left px-3 py-2.5 border-l-3 transition-colors cursor-pointer ${
                    selectedId === item.id
                      ? 'border-l-blue-600 bg-blue-50'
                      : 'border-l-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {displayName}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {item.code}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                      title="刪除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-400">
            {activeTab === 'tags' && tagSearch ? '沒有找到標籤' : `還沒有任何${activeTab === 'categories' ? '分類' : '標籤'}`}
          </div>
        )}
      </div>

      {/* Count */}
      <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-400 text-center">
        共 {filteredItems.length} 個{activeTab === 'categories' ? '分類' : '標籤'}
      </div>
    </div>
  );
}
