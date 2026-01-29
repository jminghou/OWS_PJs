'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Content } from '@/types';
import { getImageUrl, truncateText } from '@/lib/utils';

interface ArticleCarouselProps {
  title: string;
  description: string;
  articles: Content[];
  viewMoreLink: string;
  viewMoreText: string;
  emptyMessage: string;
}

function CarouselArticleCard({ article }: { article: Content }) {
  const displayImage = article.cover_image || article.featured_image;

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden h-full">
      {displayImage && (
        <div className="aspect-[4/3] relative overflow-hidden">
          <Image
            src={getImageUrl(displayImage)}
            alt={article.title}
            fill
            className="object-cover"
            sizes="320px"
          />
        </div>
      )}

      <div className="p-4 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          <Link
            href={`/posts/${article.slug}`}
            className="hover:text-brand-purple-600 transition-colors"
          >
            {article.title}
          </Link>
        </h3>
        {article.summary && (
          <p className="text-sm text-gray-600 line-clamp-3">
            {truncateText(article.summary, 80)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ArticleCarousel({
  title,
  description,
  articles,
  viewMoreLink,
  viewMoreText,
  emptyMessage,
}: ArticleCarouselProps) {
  return (
    <section id="articles" className="py-12 md:py-16 bg-gray-50 overflow-hidden scroll-mt-16">
      {/* Section Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          {title}
        </h2>
        <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
          {description}
        </p>
      </div>

      {articles.length > 0 ? (
        <>
          {/* Horizontal Scroll Container */}
          <div className="relative">
            <div
              className="flex gap-6 overflow-x-auto px-4 sm:px-8 lg:px-16 pb-4 snap-x snap-mandatory scrollbar-hide"
              style={{
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {articles.map((article) => (
                <article
                  key={article.id}
                  className="flex-shrink-0 w-[280px] md:w-[320px] snap-start"
                >
                  <CarouselArticleCard article={article} />
                </article>
              ))}
            </div>

            {/* Gradient Fade Edges */}
            <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
          </div>

          {/* View More Link */}
          <div className="text-center mt-8">
            <Link
              href={viewMoreLink}
              className="inline-flex items-center px-6 py-3 bg-brand-purple-100 hover:bg-brand-purple-200 text-brand-purple-800 font-medium rounded-lg transition-colors"
            >
              {viewMoreText}
              <svg
                className="ml-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}
