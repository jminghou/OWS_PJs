'use client';

import Link from 'next/link';
import { Content } from '@/types';
import PostCard from '@/components/public/PostCard';
import JsonLd from '@/components/seo/JsonLd';
import { buildItemListJsonLd } from '@/lib/seo';

interface LatestArticlesSectionProps {
  title: string;
  description?: string;
  articles: Content[];
  viewMoreLink: string;
  viewMoreText: string;
  emptyMessage: string;
}

/**
 * 首頁「最新文章」牆：最多 12 篇網格 + 查看更多。
 * 同時輸出 ItemList 結構化資料，幫 AI 理解這是一組內容集合。
 */
export default function LatestArticlesSection({
  title,
  description,
  articles,
  viewMoreLink,
  viewMoreText,
  emptyMessage,
}: LatestArticlesSectionProps) {
  const itemList = buildItemListJsonLd(articles);

  return (
    <section id="articles" className="py-12 md:py-16 bg-gray-50 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {itemList && <JsonLd data={itemList} />}

        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{title}</h2>
          {description && <p className="text-gray-600 max-w-2xl mx-auto">{description}</p>}
        </div>

        {articles.length === 0 ? (
          <p className="text-center text-gray-500">{emptyMessage}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href={viewMoreLink}
                className="inline-flex items-center px-6 py-3 bg-brand-purple-600 hover:bg-brand-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                {viewMoreText}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
