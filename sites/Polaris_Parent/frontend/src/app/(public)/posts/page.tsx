import { Metadata } from 'next';
import { Suspense } from 'react';
import PostsContent from './PostsContent';
import { ArticleListSkeleton } from '@/app/(public)/articles/ArticleCard';

export const metadata: Metadata = {
  title: '親紫之間 - 親紫專欄',
  description: '瀏覽親紫專欄文章，理解孩子的獨特之處',
};

export default function PostsPage() {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <div className="mx-auto max-w-content px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-16">
        <header className="mb-8 md:mb-12">
          <h1 className="font-heading text-[32px] font-normal text-ink [text-wrap:pretty] md:text-h1">
            親紫專欄
          </h1>
          <p className="mt-4 max-w-prose text-[17px] text-text [text-wrap:pretty] md:text-lead">
            探索紫微斗數的智慧，理解孩子的天賦與特質
          </p>
        </header>
        <Suspense fallback={<ArticleListSkeleton />}>
          <PostsContent />
        </Suspense>
      </div>
    </div>
  );
}
