import { Metadata } from 'next';
import { Suspense } from 'react';
import PostsContent from '@/app/(public)/posts/PostsContent';

// 多語言標題和描述
const localeContent: Record<string, { title: string; pageTitle: string; description: string }> = {
  'zh-TW': {
    title: '策略專欄 - 數位鍊金室',
    pageTitle: '策略專欄',
    description: '探索數位轉型策略的智慧，掌握企業增長與競爭優勢',
  },
  'zh-CN': {
    title: '策略专栏 - 数位炼金室',
    pageTitle: '策略专栏',
    description: '探索数字化转型策略的智慧，掌握企业增长与竞争优势',
  },
  'en': {
    title: 'Posts - Digital Alchemy Lab',
    pageTitle: 'Posts',
    description: 'Explore digital transformation strategy insights for enterprise growth and competitive advantage',
  },
  'ja': {
    title: '投稿 - デジタル錬金室',
    pageTitle: '投稿',
    description: 'デジタルトランスフォーメーション戦略の知恵を探求し、企業成長と競争優位を把握',
  },
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const content = localeContent[locale] || localeContent['zh-TW'];
  return {
    title: content.title,
    description: content.description,
  };
}

export default async function LocalePostsPage({ params }: PageProps) {
  const { locale } = await params;
  const content = localeContent[locale] || localeContent['zh-TW'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {content.pageTitle}
          </h1>
          <p className="text-lg text-gray-600">
            {content.description}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<PostsLoading />}>
          <PostsContent locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}

function PostsLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="aspect-square bg-gray-200 animate-pulse"></div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="h-6 w-12 bg-gray-200 rounded-full animate-pulse"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
