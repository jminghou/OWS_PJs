import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Content } from '@/types';
import { formatDateTime, truncateText, getImageUrl, getGcsImageUrl } from '@/lib/utils';

interface PostCardProps {
  post: Content;
  /** 'default' = 完整卡片；'tile' = IG 式方形圖磚（圖片為主 + 標題疊字） */
  variant?: 'default' | 'tile';
}

export default function PostCard({ post, variant = 'default' }: PostCardProps) {
  // 優先使用封面圖片 (1:1)，沒有的話使用精選圖片 (16:9)
  const displayImage = post.cover_image || post.featured_image;
  const [imgSrc, setImgSrc] = useState(getGcsImageUrl(displayImage || '', 'medium'));

  const handleImgError = () => {
    const original = getImageUrl(displayImage || '');
    if (imgSrc !== original) setImgSrc(original);
  };

  // IG 式純圖磚：只顯示封面（封面本身已含設計文字），無額外標題、無圓角。
  // 標題仍透過 alt + 列表的 ItemList JSON-LD 提供給爬蟲／報讀器，SEO/AEO 不扣分。
  if (variant === 'tile') {
    return (
      <Link href={`/posts/${post.slug}`} className="group block">
        {/* 仿 IG 單篇貼文 3:4 直式封面（更高），無圓角 */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-brand-purple-100 to-warm-200">
          {displayImage ? (
            <Image
              src={imgSrc}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, (max-width: 1536px) 25vw, 16vw"
              onError={handleImgError}
            />
          ) : (
            // 沒有封面圖時顯示標題，避免空白磚（同時作為連結文字）
            <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm font-medium text-gray-800">
              {post.title}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <article className="group bg-white rounded-banner border border-warm-200/70 overflow-hidden shadow-[0_8px_30px_rgba(139,92,246,0.06)] hover:shadow-[0_14px_40px_rgba(139,92,246,0.14)] hover:-translate-y-1 transition-all duration-300">
      {displayImage && (
        <div className="aspect-square relative overflow-hidden">
          <Image
            src={imgSrc}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={handleImgError}
          />
        </div>
      )}

      <div className="p-6">
        {post.category && (
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm text-gray-500">
              {post.category.name}
            </span>
          </div>
        )}

        <h2 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
          <Link
            href={`/posts/${post.slug}`}
            className="hover:text-brand-purple-600 transition-colors"
          >
            {post.title}
          </Link>
        </h2>

        {post.summary && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
            {truncateText(post.summary, 120)}
          </p>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            {post.author && (
              <span>作者：{post.author.name || post.author.username}</span>
            )}
            <span>閱讀：{post.views_count}</span>
          </div>

          <time dateTime={post.published_at || post.created_at}>
            {formatDateTime(post.published_at || post.created_at)}
          </time>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
            {post.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag.id}
                href={`/posts?tag=${tag.name}`}
                className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
              >
                #{tag.slug}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
