'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { contentApi } from '@/lib/api';
import { Content, ContentListResponse } from '@/types';
import PostCard from '@/components/public/PostCard';
import Button from '@/components/ui/Button';

interface PostsContentProps {
  locale?: string;
}

export default function PostsContent({ locale }: PostsContentProps) {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Content[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  const currentPage = parseInt(searchParams.get('page') || '1');
  const searchQuery = searchParams.get('search') || '';

  const [filters, setFilters] = useState({
    type: 'article',
    search: searchQuery,
    tag: searchParams.get('tag') || '',
  });

  // 分離搜尋狀態和實際執行搜尋的狀態
  const [activeFilters, setActiveFilters] = useState({
    type: 'article',
    search: searchQuery,
    tag: searchParams.get('tag') || '',
  });

  useEffect(() => {
    fetchPosts();
  }, [currentPage, activeFilters]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        per_page: 12,
        status: 'published',
        language: locale || 'zh-TW',
      };

      if (activeFilters.type !== 'all') {
        params.type = activeFilters.type;
      }

      if (activeFilters.search) {
        params.search = activeFilters.search;
      }

      if (activeFilters.tag) {
        params.tag = activeFilters.tag;
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
    if (value && key === 'type' && value !== 'all') {
      newSearchParams.set(key, value);
    } else if (value && key === 'search') {
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
    return <PostsLoading />;
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
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-6 rounded-lg shadow-sm">
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜尋文章..."
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

      {/* 標籤篩選器 */}
      {(
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">文章分類</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!filters.tag ? 'default' : 'outline'}
              onClick={() => handleFilterChange('tag', '')}
              size="sm"
            >
              全部分類
            </Button>
            <Button
              variant={filters.tag === '《親子教養》' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('tag', '《親子教養》')}
              size="sm"
            >
              《親子教養》
            </Button>
            <Button
              variant={filters.tag === '《發掘天賦》' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('tag', '《發掘天賦》')}
              size="sm"
            >
              《發掘天賦》
            </Button>
            <Button
              variant={filters.tag === '《星性解釋》' ? 'default' : 'outline'}
              onClick={() => handleFilterChange('tag', '《星性解釋》')}
              size="sm"
            >
              《星性解釋》
            </Button>
          </div>
        </div>
      )}

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
          <p className="text-gray-500 text-lg">
            {filters.search ? `沒有找到包含 "${filters.search}" 的文章` : '暫無文章'}
          </p>
        </div>
      )}
    </div>
  );
}

function PostsLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
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