'use client';

/**
 * 親紫專欄總覽頁（IG 個人檔案式）。
 *
 * 頁頭「關於我」→ 精選主題圓圈（標籤）→ 吸頂分頁（分類）→ 3 欄方格文章牆（無限捲動）。
 * 標籤與分類可疊加篩選；狀態寫進網址（?category=&tag=&search=），分享與返回都能還原。
 * 頁頭資料由伺服器端帶入（SEO），文章與分類在瀏覽器端載入。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { BookOpen, Grid3x3, Loader2, Search, X } from 'lucide-react';
import { contentApi, categoryApi, type ColumnProfile } from '@/lib/api';
import type { Category, Content, ContentListResponse } from '@/types';
import BrandButton from '@/components/ui/BrandButton';
import ColumnHeader, { ColumnHighlights } from './ColumnHeader';
import ColumnGrid, { ColumnGridSkeleton } from './ColumnGrid';
import { getColumnCopy, resolveProfileText } from './columnCopy';

const PER_PAGE = 18; // 3 的倍數，每批剛好補滿 6 列
const HEADER_HEIGHT = 72; // 站台頁首（sticky）高度，分頁列吸在它下面

interface Filters {
  category: string;
  tag: string;
  search: string;
}

export default function ColumnPage({ profile, locale = 'zh-TW' }: { profile: ColumnProfile; locale?: string }) {
  const searchParams = useSearchParams();
  const copy = getColumnCopy(locale);
  const basePath = locale === 'zh-TW' ? '' : `/${locale}`;
  const text = resolveProfileText(profile, locale, copy);
  const actions = profile.actions.length > 0 ? profile.actions : copy.defaultActions(basePath);

  const [filters, setFilters] = useState<Filters>(() => ({
    category: searchParams.get('category') || '',
    tag: searchParams.get('tag') || '',
    search: searchParams.get('search') || '',
  }));
  const [searchOpen, setSearchOpen] = useState(() => Boolean(searchParams.get('search')));
  const [draft, setDraft] = useState(filters.search);
  const [isComposing, setIsComposing] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [totalPosts, setTotalPosts] = useState<number>();
  const [posts, setPosts] = useState<Content[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const requestId = useRef(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 分類（分頁列）與全站文章總數（頁頭數字，不受篩選影響）
  useEffect(() => {
    categoryApi.getList(locale).then(setCategories).catch(() => setCategories([]));
    contentApi
      .getList({ page: 1, per_page: 1, status: 'published', type: 'article', language: locale })
      .then((res: ContentListResponse) => setTotalPosts(res.pagination?.total))
      .catch(() => setTotalPosts(undefined));
  }, [locale]);

  const fetchPage = useCallback(
    async (target: number) => {
      const id = ++requestId.current;
      target === 1 ? setLoading(true) : setLoadingMore(true);
      setError(false);
      try {
        const params: Record<string, unknown> = {
          page: target,
          per_page: PER_PAGE,
          status: 'published',
          type: 'article',
          language: locale,
        };
        if (filters.category) params.category_id = parseInt(filters.category, 10);
        if (filters.tag) params.tag = filters.tag;
        if (filters.search) params.search = filters.search;
        const res: ContentListResponse = await contentApi.getList(params as any);
        if (id !== requestId.current) return; // 篩選已改變，丟掉過期回應
        setPosts((prev) => (target === 1 ? res.contents : [...prev, ...res.contents.filter((p) => !prev.some((x) => x.id === p.id))]));
        setPage(target);
        setHasNext(Boolean(res.pagination?.has_next));
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filters, locale]
  );

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  // 無限捲動：哨兵進入視窗前 600px 就先載下一批
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNext || loading || loadingMore || error) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && fetchPage(page + 1),
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNext, loading, loadingMore, error, page, fetchPage]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const applyFilters = (next: Partial<Filters>) => {
    const merged = { ...filters, ...next };
    setFilters(merged);

    const params = new URLSearchParams(searchParams.toString());
    (Object.keys(merged) as (keyof Filters)[]).forEach((key) => {
      if (merged[key]) params.set(key, merged[key]);
      else params.delete(key);
    });
    params.delete('page');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);

    // 已捲過分頁列時，切換後回到牆頂（像 IG 切分頁），否則不動
    const tabs = tabsRef.current;
    if (tabs) {
      const top = tabs.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
      if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const submitSearch = () => applyFilters({ search: draft.trim() });
  const clearSearch = () => {
    setDraft('');
    applyFilters({ search: '' });
  };

  const activeHighlight = useMemo(
    () => profile.highlights.find((h) => h.code === filters.tag),
    [profile.highlights, filters.tag]
  );
  const activeTagLabel = activeHighlight?.name || filters.tag;

  const tabs = [{ id: '', label: copy.all }, ...categories.map((c) => ({ id: String(c.id), label: c.name || c.slugs?.[locale] || c.code }))];

  return (
    <div className="mx-auto max-w-[975px] px-4 pb-20 md:px-6 md:pb-24">
      <ColumnHeader
        profile={profile}
        text={text}
        actions={actions}
        copy={copy}
        stats={{ posts: totalPosts, categories: categories.length, topics: profile.highlights.length }}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
      />

      {/* 搜尋列（由頁頭放大鏡展開） */}
      {searchOpen && (
        <form
          id="column-search"
          role="search"
          className="mt-5 md:mx-12"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isComposing) submitSearch();
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" strokeWidth={2} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              enterKeyHint="search"
              value={draft}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.search}
              onChange={(e) => setDraft(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              className="w-full rounded-2xl border-[1.5px] border-line-strong bg-white py-3 pl-11 pr-11 text-base text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150 ease-out focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 [&::-webkit-search-cancel-button]:hidden"
            />
            {draft && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={copy.clear}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-tint hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              </button>
            )}
          </div>
        </form>
      )}

      <ColumnHighlights
        highlights={profile.highlights}
        activeTag={filters.tag}
        onSelect={(code) => applyFilters({ tag: code })}
        label={copy.highlightsLabel}
      />

      {/* 分頁列（分類）：吸在站台頁首下方；超出寬度可橫向滑動 */}
      <div
        ref={tabsRef}
        className="sticky z-30 -mx-4 mt-6 border-t border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80 md:mx-0 md:mt-10"
        style={{ top: HEADER_HEIGHT }}
      >
        <nav aria-label={copy.tabsLabel} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex min-w-full px-2 md:justify-center md:gap-10 md:px-0">
            {tabs.map((tab) => {
              const active = filters.category === tab.id;
              return (
                <li key={tab.id || 'all'} className="flex-1 shrink-0 md:flex-none">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyFilters({ category: tab.id })}
                    className={clsx(
                      '-mt-px flex h-12 w-full items-center justify-center gap-1.5 whitespace-nowrap border-t-2 px-3 text-[14px] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-100 md:px-1 md:text-[15px]',
                      active ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'
                    )}
                  >
                    {!tab.id && <Grid3x3 className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />}
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* 目前套用中的標籤／搜尋 */}
      {(filters.tag || filters.search) && (
        <div className="flex flex-wrap gap-2 py-3" aria-live="polite">
          {filters.tag && (
            <button
              type="button"
              onClick={() => applyFilters({ tag: '' })}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-blue-50 px-3 text-[13px] font-bold text-blue-700 hover:bg-blue-100"
            >
              #{activeTagLabel}
              <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-label={copy.clear} />
            </button>
          )}
          {filters.search && (
            <button
              type="button"
              onClick={clearSearch}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-tint px-3 text-[13px] font-bold text-ink hover:bg-line"
            >
              {copy.searching(filters.search)}
              <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-label={copy.clear} />
            </button>
          )}
        </div>
      )}

      <section aria-busy={loading} className={clsx('-mx-3 md:mx-0', !(filters.tag || filters.search) && 'pt-[3px] md:pt-4')}>
        {loading ? (
          <ColumnGridSkeleton />
        ) : error && posts.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="text-text">{copy.loadError}</p>
            <BrandButton variant="soft" onClick={() => fetchPage(1)}>
              {copy.retry}
            </BrandButton>
          </div>
        ) : posts.length === 0 ? (
          <div className="mx-3 flex flex-col items-center rounded-card bg-white px-6 py-14 text-center md:mx-0">
            <BookOpen className="mb-4 h-12 w-12 text-blue-500" strokeWidth={2} aria-hidden="true" />
            <p className="text-text">{filters.search ? copy.emptySearch(filters.search) : copy.empty}</p>
          </div>
        ) : (
          <>
            <ColumnGrid posts={posts} />
            <div ref={sentinelRef} className="flex min-h-[64px] items-center justify-center py-6">
              {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted" aria-label={copy.loadMore} />}
              {error && hasNext && (
                <BrandButton variant="soft" size="S" onClick={() => fetchPage(page + 1)}>
                  {copy.retry}
                </BrandButton>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
