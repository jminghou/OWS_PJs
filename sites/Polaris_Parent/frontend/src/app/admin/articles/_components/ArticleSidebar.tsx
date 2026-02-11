'use client';

import { Content } from '@/types';
import { Search, Plus } from 'lucide-react';
import ArticleListItem from './ArticleListItem';
import { AdminPagination } from '@/components/admin/shared';

interface ArticleSidebarProps {
  articles: Content[];
  loading: boolean;
  selectedArticleId: number | null;
  isCreateMode: boolean;
  pagination: any;
  currentPage: number;
  filters: { search: string; status: string };
  onSelectArticle: (id: number) => void;
  onNewArticle: () => void;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: { search: string; status: string }) => void;
  onDeleteArticle: (id: number) => void;
}

const statusTabs = [
  { key: 'all', label: '全部' },
  { key: 'published', label: '已發佈' },
  { key: 'draft', label: '草稿' },
];

export default function ArticleSidebar({
  articles,
  loading,
  selectedArticleId,
  isCreateMode,
  pagination,
  currentPage,
  filters,
  onSelectArticle,
  onNewArticle,
  onPageChange,
  onFilterChange,
  onDeleteArticle,
}: ArticleSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header: New Article button */}
      <div className="p-3 border-b border-gray-100">
        <button
          type="button"
          onClick={onNewArticle}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isCreateMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Plus size={16} />
          新文章
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋文章..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex px-3 pt-2 pb-1 gap-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onFilterChange({ ...filters, status: tab.key })}
            className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
              filters.status === tab.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Article list */}
      <div className="flex-1 overflow-y-auto border-t border-gray-100 mt-1">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1.5" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : articles.length > 0 ? (
          <div>
            {articles.map((article) => (
              <ArticleListItem
                key={article.id}
                article={article}
                isSelected={selectedArticleId === article.id}
                onClick={() => onSelectArticle(article.id)}
                onDelete={onDeleteArticle}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-400">
            沒有找到文章
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
