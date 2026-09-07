'use client';

import Link from 'next/link';
import { Content } from '@ows/platform-api/types';
import PostCard from './PostCard';
import JsonLd from './JsonLd';
import { buildItemListJsonLd } from '../seo';

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
  articles,
  viewMoreLink,
  viewMoreText,
  emptyMessage,
}: LatestArticlesSectionProps) {
  const itemList = buildItemListJsonLd(articles);

  return (
    <section id="articles" className="py-12 md:py-16 bg-white scroll-mt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {itemList && <JsonLd data={itemList} />}

        {articles.length === 0 ? (
          <p className="text-center text-gray-500">{emptyMessage}</p>
        ) : (
          <>
            {/* IG 式純圖磚牆：手機固定 2 欄，桌面起 auto-fill 讓每張圖磚維持約 200px 基本寬度，
                避免瀏覽器寬窄造成圖片尺寸落差過大 */}
            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-1.5 sm:gap-2">
              {articles.map((post) => (
                <PostCard key={post.id} post={post} variant="tile" />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href={viewMoreLink}
                className="inline-flex items-center px-7 py-3 bg-brand-purple-600 hover:bg-brand-purple-700 text-white font-medium rounded-banner shadow-[0_8px_24px_rgba(139,92,246,0.25)] hover:shadow-[0_10px_30px_rgba(139,92,246,0.35)] hover:-translate-y-0.5 transition-all duration-300"
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
