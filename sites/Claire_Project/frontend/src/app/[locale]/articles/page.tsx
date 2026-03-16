import { Metadata } from 'next';
import { Suspense } from 'react';
import ArticlesContent from '@/app/(public)/articles/ArticlesContent';

// 多語言標題和描述
const localeContent: Record<string, { title: string; pageTitle: string; description: string }> = {
  'zh-TW': {
    title: '策略專欄 - 數位鍊金室',
    pageTitle: '策略專欄',
    description: '探索數位轉型策略的應用，掌握 MarTech、電商增長與企業數位化趨勢',
  },
  'zh-CN': {
    title: '策略专栏 - 数位炼金室',
    pageTitle: '策略专栏',
    description: '探索数字化转型策略的应用，掌握 MarTech、电商增长与企业数字化趋势',
  },
  'en': {
    title: 'Articles - Digital Alchemy Lab',
    pageTitle: 'Articles',
    description: 'Explore digital transformation strategies, MarTech architecture, and e-commerce growth insights',
  },
  'ja': {
    title: '記事 - デジタル錬金室',
    pageTitle: '記事',
    description: 'デジタルトランスフォーメーション戦略、MarTechアーキテクチャ、EC成長の知見を探求',
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

export default async function LocaleArticlesPage({ params }: PageProps) {
  const { locale } = await params;
  const content = localeContent[locale] || localeContent['zh-TW'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {content.pageTitle}
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl">
            {content.description}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<ArticlesLoading />}>
          <ArticlesContent locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}

function ArticlesLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
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
