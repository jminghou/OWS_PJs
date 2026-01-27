'use client';

import Image from 'next/image';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkSupersub from 'remark-supersub';
import rehypeRaw from 'rehype-raw';
import { Content } from '@/types';
import { formatDateTime, getImageUrl } from '@/lib/utils';

interface PostDetailContentProps {
  post: Content;
}

export default function PostDetailContent({ post }: PostDetailContentProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* 主要內容區域 - 寬度 1000px (電腦版) */}
      <div className="mx-auto px-4 sm:px-6 w-full lg:w-[1080px]">
        <main>
            {/* 
              控制內容與外框的間距：修改下方 article 的 padding class
              目前設定：p-6 (手機), sm:p-8 (平板), lg:px-12 (電腦版左右間距)
              若要調整內文與框線的距離，請修改這裡的 padding 數值
            */}
            <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-10 lg:px-20">
              {/* 1. 分類 - 麵包屑樣式 */}
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                <span>
                  親紫專欄
                </span>
                {post.category && (
                  <>
                    <span className="text-gray-400">&gt;</span>
                    <span className="font-medium text-gray-900">
                      {post.category.name}
                    </span>
                  </>
                )}
              </div>

              {/* 2. 圖片 */}
              {post.featured_image && (
                <div className="aspect-[16/9] relative overflow-hidden rounded-lg mb-8">
                  <Image
                    src={getImageUrl(post.featured_image)}
                    alt={post.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 1000px) 100vw, 1000px"
                  />
                </div>
              )}

              {/* 3. 標題 */}
              <h1 className="text-2xl md:text-2xl lg:text-2xl font-bold text-gray-900 mb-4 leading-tight">
                {post.title}
              </h1>

              {/* 4. 作者與日期 (取消瀏覽次數) */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 mb-8">
                {post.author && (
                  <span>作者：{post.author.username}</span>
                )}
                <span>發布於：{formatDateTime(post.published_at || post.created_at)}</span>
                {/* 取消瀏覽次數 */}
                {post.likes_count > 0 && (
                  <span>讚：{post.likes_count}</span>
                )}
              </div>

              {/* 5. 文章摘要 (字級縮小) */}
              {post.summary && (
                <div className="bg-gray-50 rounded-lg p-4 mb-8">
                  <h2 className="text-sm font-bold text-gray-900 mb-2">文章摘要</h2>
                  <p className="text-sm text-gray-700 leading-relaxed">{post.summary}</p>
                </div>
              )}

              {/* 6. 內文 */}
              <div className="prose prose-lg max-w-none">
                {post.content && (
                  <ReactMarkdown
                    className="prose-content"
                    remarkPlugins={[remarkGfm, remarkSupersub]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {post.content}
                  </ReactMarkdown>
                )}
              </div>

              {/* 標籤 */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700 mr-2">標籤：</span>
                  {post.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/posts?tag=${tag.name}`}
                      className="text-sm text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full transition-colors"
                    >
                      #{tag.slug}
                    </Link>
                  ))}
                </div>
              )}
            </article>

            {/* 相關推薦 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-3 h-3 bg-amber-500 rounded-full mr-2"></span>
                相關推薦
              </h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  正在載入相關文章...
                </p>
              </div>
            </div>

        </main>
      </div>
    </div>
  );
}



