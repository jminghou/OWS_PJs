'use client';

/**
 * 文章卡（docs/BRAND_GUIDELINES.md §6.5）。
 *
 * 作者頁與文章頁的「相關推薦」使用；專欄總覽改用 IG 式方格（./column/ColumnGrid）。@ows/site-kit 的 PostCard 是跨站台共用元件，
 * 不改它；這裡依 Polaris 品牌規範另做一張卡，資料欄位與連結（/posts/{slug}）與原本相同。
 */

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { formatDateTime, getImageUrl, getGcsImageUrl, truncateText } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import Tag from '@/components/ui/Tag';

/**
 * 卡片需要的欄位。完整的 Content 與作者頁的 AuthorContentCard（後端輕量投影）都符合。
 */
export interface ArticleCardPost {
  slug: string;
  title: string;
  summary?: string;
  cover_image?: string;
  featured_image?: string;
  published_at?: string;
  created_at?: string;
  category?: { name?: string } | null;
}

export default function ArticleCard({
  post,
  headingAs: Heading = 'h2',
}: {
  post: ArticleCardPost;
  /** 卡片標題的標籤層級：列表頁 h2；放在已有 h2 的區塊（例：相關推薦）裡用 h3 */
  headingAs?: 'h2' | 'h3';
}) {
  // 優先使用封面圖片，沒有的話使用精選圖片
  const displayImage = post.cover_image || post.featured_image;
  const [imgSrc, setImgSrc] = useState(getGcsImageUrl(displayImage || '', 'medium'));
  const date = post.published_at || post.created_at;

  const handleImgError = () => {
    const original = getImageUrl(displayImage || '');
    if (imgSrc !== original) setImgSrc(original);
  };

  return (
    <article className="group h-full overflow-hidden rounded-card bg-white transition-shadow duration-300 ease-out hover:shadow-md focus-within:shadow-md">
      <Link
        href={`/posts/${post.slug}`}
        className="flex h-full flex-col rounded-card text-ink no-underline hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
      >
        {displayImage && (
          <div className="relative m-3 aspect-square overflow-hidden rounded-[24px] bg-tint">
            <Image
              src={imgSrc}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
              onError={handleImgError}
            />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2.5 px-6 pb-6 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {post.category?.name && <Tag tone="category">{post.category.name}</Tag>}
            {date && (
              <time dateTime={date} className="font-latin text-caption text-muted">
                {formatDateTime(date)}
              </time>
            )}
          </div>

          <Heading className="line-clamp-2 font-heading text-[18px] font-normal text-ink [text-wrap:pretty] md:text-h4">
            {post.title}
          </Heading>

          {post.summary && (
            <p className="line-clamp-2 text-small text-text [text-wrap:pretty]">
              {truncateText(post.summary, 120)}
            </p>
          )}

          <span className="mt-auto inline-flex items-center gap-2 pt-1 text-[15px] font-bold text-blue-500 transition-colors duration-150 ease-out group-hover:text-pink-600">
            繼續閱讀
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  );
}

/** 文章卡網格：桌面 3 欄／平板 2 欄／手機 1 欄，卡片間距 16（手機）／24（桌面） */
export const ARTICLE_GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3';
