'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { contentApi, categoryApi } from '@/lib/api';
import { Content, ContentListResponse, Category } from '@/types';
import { BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import BrandButton from '@/components/ui/BrandButton';
import Alert from '@/components/ui/Alert';
import { filterTag } from '@/components/ui/Tag';
import ArticleCard, { ARTICLE_GRID, ArticleListSkeleton, SEARCH_INPUT } from './ArticleCard';

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
      {/* 搜尋和篩選 */}
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
              className={SEARCH_INPUT}
            />
          </div>
          <BrandButton variant="secondary" onClick={handleSearch}>
            搜尋
          </BrandButton>
        </div>

        {/* 文章分類（篩選標籤列） */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-ink">文章分類</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={!activeFilters.category}
              onClick={() => handleFilterChange('category', '')}
              className={filterTag(!activeFilters.category)}
            >
              全部分類
            </button>
            {categories.map((category) => {
              // 從slugs中取得當前語言的名稱
              const currentLocale = locale || 'zh-TW';
              const categoryName = category.name || category.slugs?.[currentLocale] || category.code;
              const selected = activeFilters.category === category.id.toString();

              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => handleFilterChange('category', category.id.toString())}
                  className={filterTag(selected)}
                >
                  {categoryName}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 文章列表 */}
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
        <div className="flex flex-col items-center rounded-card bg-white px-6 py-12 text-center md:px-8">
          <BookOpen className="mb-4 h-12 w-12 text-blue-500" strokeWidth={2} aria-hidden="true" />
          <h3 className="mb-2 font-heading text-[22px] font-normal text-ink md:text-h3">暫無文章</h3>
          <p className="text-text">
            {activeFilters.search ? `沒有找到包含 "${activeFilters.search}" 的文章` : '目前還沒有親紫專欄文章'}
          </p>
        </div>
      )}
    </div>
  );
}
