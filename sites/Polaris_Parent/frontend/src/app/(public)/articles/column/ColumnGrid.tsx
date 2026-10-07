'use client';

/**
 * IG 式 3 欄方格文章牆。
 *
 * - 手機也維持 3 欄、間距 3px；邊角用規範的 sm2（12px），桌面放大到 inner（20px）。
 * - 有封面：只顯示 1:1 封面（文章的 cover_image 本來就是 1:1）；桌面 hover 浮出標題。
 * - 沒封面：品牌淺色底＋標題字卡，讓文字文章在牆上也站得住。
 */
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { clsx } from 'clsx';
import type { Content } from '@/types';
import { formatDateTime, getGcsImageUrl, getImageUrl } from '@/lib/utils';

export const COLUMN_GRID = 'grid grid-cols-3 gap-[3px] md:gap-3 lg:gap-4';
const TILE_SHAPE = 'relative aspect-square overflow-hidden rounded-sm2 md:rounded-inner';

/** 無封面字卡的底色輪替（只用品牌淺色階） */
const TEXT_TILE_TONES = [
  'bg-blue-50 text-blue-800',
  'bg-pink-50 text-pink-800',
  'bg-star-100 text-star-800',
  'bg-leaf-100 text-leaf-800',
  'bg-tint text-ink',
];

function PostTile({ post, priority }: { post: Content; priority: boolean }) {
  const cover = post.cover_image || post.featured_image;
  const [src, setSrc] = useState(cover ? getGcsImageUrl(cover, 'medium') : '');
  const date = post.published_at || post.created_at;

  const handleError = () => {
    const original = getImageUrl(cover || '');
    if (src !== original) setSrc(original);
    else setSrc('');
  };

  return (
    <li>
      <Link
        href={`/posts/${post.slug}`}
        aria-label={post.title}
        className={clsx(
          TILE_SHAPE,
          'group block no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100'
        )}
      >
        {src ? (
          <>
            <Image
              src={src}
              alt=""
              fill
              priority={priority}
              sizes="(max-width: 768px) 33vw, 380px"
              className="object-cover transition-transform duration-300 ease-out md:group-hover:scale-[1.03]"
              onError={handleError}
            />
            {/* 桌面 hover／鍵盤聚焦時浮出標題；手機維持純圖（IG 的觀看方式） */}
            <span className="absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-ink/80 via-ink/25 to-transparent p-5 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 md:flex">
              {post.category?.name && <span className="mb-1 text-caption font-bold text-blue-100">{post.category.name}</span>}
              <span className="line-clamp-3 font-heading text-h4 text-white [text-wrap:pretty]">{post.title}</span>
            </span>
          </>
        ) : (
          <span
            className={clsx(
              'flex h-full w-full flex-col justify-between p-2.5 transition-[filter] duration-150 ease-out group-hover:brightness-[.97] md:p-6',
              TEXT_TILE_TONES[post.id % TEXT_TILE_TONES.length]
            )}
          >
            <span className="truncate text-[10px] font-bold opacity-70 md:text-caption">{post.category?.name || ' '}</span>
            <span className="line-clamp-4 font-heading text-[13px] leading-snug [text-wrap:pretty] md:line-clamp-3 md:text-h4 lg:text-[24px]">
              {post.title}
            </span>
            <span className="hidden font-latin text-caption opacity-60 md:block">{date ? formatDateTime(date).slice(0, 10) : ' '}</span>
          </span>
        )}
      </Link>
    </li>
  );
}

export default function ColumnGrid({ posts }: { posts: Content[] }) {
  return (
    <ul className={COLUMN_GRID}>
      {posts.map((post, i) => (
        <PostTile key={post.id} post={post} priority={i < 6} />
      ))}
    </ul>
  );
}

/** 整頁骨架（Suspense fallback）：頁頭 → 圓圈 → 分頁列 → 方格 */
export function ColumnPageSkeleton() {
  return (
    <div className="mx-auto max-w-[975px] px-4 pt-6 md:px-6 md:pt-12" aria-hidden="true">
      <div className="flex items-center gap-5 md:gap-16 lg:px-12">
        <div className="h-[88px] w-[88px] shrink-0 animate-pulse rounded-full bg-tint md:h-[160px] md:w-[160px]" />
        <div className="flex-1 space-y-3">
          <div className="h-7 w-40 animate-pulse rounded-inner bg-tint" />
          <div className="h-5 w-full max-w-xs animate-pulse rounded-inner bg-tint" />
          <div className="h-4 w-full max-w-md animate-pulse rounded-inner bg-tint" />
        </div>
      </div>
      <div className="mt-8 flex gap-4 md:mt-12 md:gap-8 md:px-12">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-[68px] w-[68px] shrink-0 animate-pulse rounded-full bg-tint md:h-[88px] md:w-[88px]" />
        ))}
      </div>
      <div className="-mx-3 mt-6 border-t border-line pt-14 md:mx-0 md:mt-10">
        <ColumnGridSkeleton />
      </div>
    </div>
  );
}

export function ColumnGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <ul className={COLUMN_GRID} aria-hidden="true">
      {[...Array(count)].map((_, i) => (
        <li key={i} className={clsx(TILE_SHAPE, 'animate-pulse bg-tint')} />
      ))}
    </ul>
  );
}
