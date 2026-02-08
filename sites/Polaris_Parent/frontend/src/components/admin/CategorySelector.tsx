'use client';

import { useState, useEffect, useRef } from 'react';
import { tagApi } from '@/lib/api/media';
import type { MediaTag } from '@/lib/api/strapi';

type Category = MediaTag;

interface CategorySelectorProps {
  selectedCategories: Category[];
  onChange: (categories: Category[]) => void;
  disabled?: boolean;
}

export function CategorySelector({ selectedCategories, onChange, disabled }: CategorySelectorProps) {
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // 載入所有分類
  useEffect(() => {
    tagApi.getAll().then(setAllCategories).catch(console.error);
  }, []);

  // 點擊外部關閉下拉選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 過濾分類
  const filteredCategories = allCategories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedCategories.some((selected) => selected.id === category.id)
  );

  // 新增分類
  const handleAddCategory = (category: Category) => {
    onChange([...selectedCategories, category]);
    setSearchQuery('');
  };

  // 移除分類
  const handleRemoveCategory = (categoryId: number) => {
    onChange(selectedCategories.filter((category) => category.id !== categoryId));
  };

  // 建立新分類
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const newCategory = await tagApi.create(newCategoryName.trim());
      if (newCategory) {
        setAllCategories([...allCategories, newCategory]);
        onChange([...selectedCategories, newCategory]);
        setNewCategoryName('');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        分類
      </label>

      {/* 已選擇的分類 */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedCategories.map((category) => (
          <span
            key={category.id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full"
          >
            {category.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemoveCategory(category.id)}
                className="hover:text-green-600"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        ))}
      </div>

      {/* 新增分類按鈕 */}
      {!disabled && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-3 py-2 text-left text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            + 新增分類
          </button>

          {/* 下拉選單 */}
          {isOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
              {/* 搜尋框 */}
              <div className="p-2 border-b">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋分類..."
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  autoFocus
                />
              </div>

              {/* 分類列表 */}
              <div className="max-h-40 overflow-y-auto">
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleAddCategory(category)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      <span>{category.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    {searchQuery ? '找不到符合的分類' : '沒有可用的分類'}
                  </div>
                )}
              </div>

              {/* 建立新分類 */}
              <div className="p-2 border-t">
                {isCreating ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                      placeholder="輸入新分類名稱"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      建立
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setNewCategoryName('');
                      }}
                      className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="w-full text-left text-sm text-green-600 hover:text-green-800"
                  >
                    + 建立新分類
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
