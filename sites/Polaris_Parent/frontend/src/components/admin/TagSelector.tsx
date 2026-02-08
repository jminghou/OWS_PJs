'use client';

import { useState, useEffect, useRef } from 'react';
import { tagApi } from '@/lib/api/media';
import type { MediaTag } from '@/lib/api/strapi';

type Tag = MediaTag;

interface TagSelectorProps {
  selectedTags: Tag[];
  onChange: (tags: Tag[]) => void;
  disabled?: boolean;
}

export function TagSelector({ selectedTags, onChange, disabled }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // 載入所有標籤
  useEffect(() => {
    tagApi.getAll().then(setAllTags).catch(console.error);
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

  // 過濾標籤
  const filteredTags = allTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedTags.some((selected) => selected.id === tag.id)
  );

  // 新增標籤
  const handleAddTag = (tag: Tag) => {
    onChange([...selectedTags, tag]);
    setSearchQuery('');
  };

  // 移除標籤
  const handleRemoveTag = (tagId: number) => {
    onChange(selectedTags.filter((tag) => tag.id !== tagId));
  };

  // 建立新標籤
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const newTag = await tagApi.create(newTagName.trim());
      if (newTag) {
        setAllTags([...allTags, newTag]);
        onChange([...selectedTags, newTag]);
        setNewTagName('');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        標籤
      </label>

      {/* 已選擇的標籤 */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
          >
            {tag.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="hover:text-blue-600"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        ))}
      </div>

      {/* 新增標籤按鈕 */}
      {!disabled && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-3 py-2 text-left text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + 新增標籤
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
                  placeholder="搜尋標籤..."
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* 標籤列表 */}
              <div className="max-h-40 overflow-y-auto">
                {filteredTags.length > 0 ? (
                  filteredTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      {tag.name}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    {searchQuery ? '找不到符合的標籤' : '沒有可用的標籤'}
                  </div>
                )}
              </div>

              {/* 建立新標籤 */}
              <div className="p-2 border-t">
                {isCreating ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                      placeholder="輸入新標籤名稱"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      建立
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setNewTagName('');
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
                    className="w-full text-left text-sm text-blue-600 hover:text-blue-800"
                  >
                    + 建立新標籤
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
