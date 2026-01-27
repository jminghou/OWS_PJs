'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { contentApi, categoryApi } from '@/lib/api';
import { Content, ContentListResponse, Category } from '@/types';
import PostCard from '@/components/public/PostCard';
import Button from '@/components/ui/Button';

interface ArticlesContentProps {
  locale?: string;
}

export default function ArticlesContent({ locale }: ArticlesContentProps) {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Content[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  const currentPage = parseInt(searchParams.get('page') || '1');
  const searchQuery = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';

  const [filters, setFilters] = useState({
    search: searchQuery,
    category: categoryFilter,
  });

  // 分離搜尋狀態和實際執行搜尋的狀態
  const [activeFilters, setActiveFilters] = useState({
    search: searchQuery,
    category: categoryFilter,
  });

  useEffect(() => {
    fetchCategories();
  }, [locale]);

  useEffect(() => {
    fetchPosts();
  }, [currentPage, activeFilters]);

  const fetchCategories = async () => {
    try {
      const categoryList = await categoryApi.getList(locale || 'zh-TW');
      setCategories(categoryList);
    } catch (err: any) {
      console.error('載入分類時發生錯誤:', err);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        per_page: 12,
        status: 'published',
        type: 'article', // 只顯示一般文章
        language: locale || 'zh-TW',
      };

      if (activeFilters.search) {
        params.search = activeFilters.search;
      }

      if (activeFilters.category) {
        params.category_id = parseInt(activeFilters.category);
      }

      const response: ContentListResponse = await contentApi.getList(params);
      setPosts(response.contents);
      setPagination(response.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.message || '載入文章時發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...activeFilters, [key]: value };
    setActiveFilters(newFilters);

    // 同時更新輸入框的顯示狀態
    if (key === 'search') {
      setFilters(prev => ({ ...prev, search: value }));
    }

    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (value) {
      newSearchParams.set(key, value);
    } else {
      newSearchParams.delete(key);
    }
    newSearchParams.delete('page');

    const newUrl = `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleSearch = () => {
    setActiveFilters(prev => ({ ...prev, search: filters.search }));

    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (filters.search) {
      newSearchParams.set('search', filters.search);
    } else {
      newSearchParams.delete('search');
    }
    newSearchParams.delete('page');

    const newUrl = `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`;
    window.history.pushState({}, '', newUrl);
  };

  const handlePageChange = (page: number) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set('page', page.toString());
    const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  if (loading) {
    return <ArticlesLoading />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg">{error}</p>
        <Button onClick={fetchPosts} className="mt-4">
          重新載入
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 搜尋和篩選 */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜尋親子教養文章..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isComposing) {
                  handleSearch();
                }
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700"
          >
            搜尋
          </Button>
        </div>

        {/* 文章分類 */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">文章分類</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!activeFilters.category ? 'default' : 'outline'}
              onClick={() => handleFilterChange('category', '')}
              size="sm"
              className={!activeFilters.category ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              全部分類
            </Button>
            {categories.map((category) => {
              // 從slugs中取得當前語言的名稱
              const currentLocale = locale || 'zh-TW';
              const categoryName = category.name || category.slugs?.[currentLocale] || category.code;

              return (
                <Button
                  key={category.id}
                  variant={activeFilters.category === category.id.toString() ? 'default' : 'outline'}
                  onClick={() => handleFilterChange('category', category.id.toString())}
                  size="sm"
                  className={activeFilters.category === category.id.toString() ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  {categoryName}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 文章列表 */}
      {posts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.has_prev}
              >
                上一頁
              </Button>

              <span className="text-sm text-gray-600">
                第 {pagination.page} 頁，共 {pagination.pages} 頁
              </span>

              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.has_next}
              >
                下一頁
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暫無文章</h3>
          <p className="text-gray-500">
            {activeFilters.search ? `沒有找到包含 "${activeFilters.search}" 的文章` : '目前還沒有親紫專欄文章'}
          </p>
        </div>
      )}
    </div>
  );
}

function ArticlesLoading() {
  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="border-t pt-6">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4"></div>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="aspect-square bg-gray-200 animate-pulse"></div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="h-6 w-12 bg-gray-200 rounded-full animate-pulse"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}