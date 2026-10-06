'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { contentApi } from '@/lib/api';
import { Content, ContentListResponse } from '@/types';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import BrandButton from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import { filterTag } from '@/components/ui/Tag';
import ArticleCard, { ARTICLE_GRID, ArticleListSkeleton, SEARCH_INPUT } from '@/app/(public)/articles/ArticleCard';

// 標籤篩選（值與文字同原本的四顆按鈕）
const TAG_FILTERS = [
  { value: '', label: '全部分類' },
  { value: '《親子教養》', label: '《親子教養》' },
  { value: '《發掘天賦》', label: '《發掘天賦》' },
  { value: '《星性解釋》', label: '《星性解釋》' },
];

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
    return <ArticleListSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-12">
        <Alert tone="error" className="w-full">{error}</Alert>
        <BrandButton variant="soft" onClick={fetchPosts}>
          重新載入
        </BrandButton>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-[18px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
              strokeWidth={2}
              aria-hidden="true"
            />
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
              className={SEARCH_INPUT}
            />
          </div>

          <BrandButton variant="secondary" onClick={handleSearch}>
            搜尋
          </BrandButton>
        </div>

        {/* 標籤篩選器 */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-ink">文章分類</h3>
          <div className="flex flex-wrap gap-2">
            {TAG_FILTERS.map(({ value, label }) => (
              <button
                key={label}
                type="button"
                aria-pressed={activeFilters.tag === value}
                onClick={() => handleFilterChange('tag', value)}
                className={filterTag(activeFilters.tag === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {posts.length > 0 ? (
        <>
          <div className={ARTICLE_GRID}>
            {posts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <BrandButton
                variant="soft"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.has_prev}
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                上一頁
              </BrandButton>

              <span className="text-small text-muted">
                第 <span className="font-latin">{pagination.page}</span> 頁，共 <span className="font-latin">{pagination.pages}</span> 頁
              </span>

              <BrandButton
                variant="soft"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.has_next}
              >
                下一頁
                <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </BrandButton>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-card bg-white px-6 py-12 text-center md:px-8">
          <p className="text-lg text-text">
            {filters.search ? `沒有找到包含 "${filters.search}" 的文章` : '暫無文章'}
          </p>
        </div>
      )}
    </div>
  );
}
