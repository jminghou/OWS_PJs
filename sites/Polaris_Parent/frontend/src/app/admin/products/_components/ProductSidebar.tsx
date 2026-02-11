'use client';

import { ProductAdmin } from '@/types';
import { Search, Plus, Trash2 } from 'lucide-react';
import { AdminPagination } from '@/components/admin/shared';

interface ProductSidebarProps {
  products: ProductAdmin[];
  loading: boolean;
  selectedId: number | null;
  isCreateMode: boolean;
  pagination: { page: number; pages: number; has_prev: boolean; has_next: boolean; total: number };
  currentPage: number;
  searchTerm: string;
  statusFilter: string;
  onSelectProduct: (id: number) => void;
  onNewProduct: () => void;
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onDeleteProduct: (id: number, name: string) => void;
}

const statusTabs: { key: string; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'true', label: '啟用' },
  { key: 'false', label: '停用' },
];

export default function ProductSidebar({
  products,
  loading,
  selectedId,
  isCreateMode,
  pagination,
  currentPage,
  searchTerm,
  statusFilter,
  onSelectProduct,
  onNewProduct,
  onPageChange,
  onSearchChange,
  onStatusFilterChange,
  onDeleteProduct,
}: ProductSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* New product button */}
      <div className="p-3 border-b border-gray-100">
        <button
          type="button"
          onClick={onNewProduct}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isCreateMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Plus size={16} />
          新增產品
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜尋產品名稱或ID..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
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
            onClick={() => onStatusFilterChange(tab.key)}
            className={`flex-1 px-1 py-1 text-xs font-medium rounded transition-colors ${
              statusFilter === tab.key
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Product list */}
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
        ) : products.length > 0 ? (
          <div>
            {products.map((product) => {
              const displayName = product.names['zh-TW'] || product.product_id;
              return (
                <div
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectProduct(product.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectProduct(product.id); }}
                  className={`group w-full text-left px-3 py-2.5 border-l-3 transition-colors cursor-pointer ${
                    selectedId === product.id
                      ? 'border-l-blue-600 bg-blue-50'
                      : 'border-l-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {displayName}
                        </span>
                        <span className={`inline-flex w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          product.is_active ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        {product.is_featured && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">
                            精選
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400 truncate">
                          {product.product_id}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          NT$ {product.price}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProduct(product.id, displayName);
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
            沒有找到產品
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
