import { Metadata } from 'next';
import { Suspense } from 'react';
import PostsContent from '@/app/(public)/posts/PostsContent';
import { ArticleListSkeleton } from '@/app/(public)/articles/ArticleCard';

// 多語言標題和描述
const localeContent: Record<string, { title: string; pageTitle: string; description: string }> = {
  'zh-TW': {
    title: '親紫專欄 - 親紫之間',
    pageTitle: '親紫專欄',
    description: '探索紫微斗數的智慧，理解孩子的天賦與特質',
  },
  'zh-CN': {
    title: '亲紫专栏 - 亲紫之间',
    pageTitle: '亲紫专栏',
    description: '探索紫微斗数的智慧，理解孩子的天赋与特质',
  },
  'en': {
    title: 'Posts - Qin Zi Blog',
    pageTitle: 'Posts',
    description: 'Explore the wisdom of Zi Wei Dou Shu, understand your child\'s talents and characteristics',
  },
  'ja': {
    title: '投稿 - 親紫の間',
    pageTitle: '投稿',
    description: '紫微斗数の知恵を探求し、お子様の才能と特質を理解しましょう',
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
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <div className="mx-auto max-w-content px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-16">
        <header className="mb-8 md:mb-12">
          <h1 className="font-heading text-[32px] font-normal text-ink [text-wrap:pretty] md:text-h1">
            {content.pageTitle}
          </h1>
          <p className="mt-4 max-w-prose text-[17px] text-text [text-wrap:pretty] md:text-lead">
            {content.description}
          </p>
        </header>
        <Suspense fallback={<ArticleListSkeleton />}>
          <PostsContent locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
