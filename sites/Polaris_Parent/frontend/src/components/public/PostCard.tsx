import Link from 'next/link';
import Image from 'next/image';
import { Content } from '@/types';
import { formatDateTime, truncateText, getImageUrl } from '@/lib/utils';

interface PostCardProps {
  post: Content;
}

export default function PostCard({ post }: PostCardProps) {
  // 優先使用封面圖片 (1:1)，沒有的話使用精選圖片 (16:9)
  const displayImage = post.cover_image || post.featured_image;

  return (
    <article className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border overflow-hidden">
      {displayImage && (
        <div className="aspect-square relative overflow-hidden">
          <Image
            src={getImageUrl(displayImage)}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
            className="hover:text-blue-600 transition-colors"
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
              <span>作者：{post.author.username}</span>
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