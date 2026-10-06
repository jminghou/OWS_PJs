import { Metadata } from 'next';
import { Suspense } from 'react';
import ArticlesContent from './ArticlesContent';
import { ArticleListSkeleton } from './ArticleCard';

export const metadata: Metadata = {
  title: '親紫專欄 - 親紫之間',
  description: '專業的親子教養文章，發掘孩子天賦，理解星性特質',
};

export default function ArticlesPage() {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <div className="mx-auto max-w-content px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-16">
        <header className="mb-8 md:mb-12">
          <h1 className="font-heading text-[32px] font-normal text-ink [text-wrap:pretty] md:text-h1">
            親紫專欄
          </h1>
        </header>
        <Suspense fallback={<ArticleListSkeleton />}>
          <ArticlesContent />
        </Suspense>
      </div>
    </div>
  );
}
