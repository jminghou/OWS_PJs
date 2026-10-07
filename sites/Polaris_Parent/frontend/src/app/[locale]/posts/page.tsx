import { Metadata } from 'next';
import { Suspense } from 'react';
import ColumnPage from '@/app/(public)/articles/column/ColumnPage';
import { ColumnPageSkeleton } from '@/app/(public)/articles/column/ColumnGrid';
import { getColumnProfile } from '@/lib/columnProfile';

export const revalidate = 60;

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
  const profile = await getColumnProfile(locale);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <Suspense fallback={<ColumnPageSkeleton />}>
        <ColumnPage profile={profile} locale={locale} />
      </Suspense>
    </div>
  );
}
