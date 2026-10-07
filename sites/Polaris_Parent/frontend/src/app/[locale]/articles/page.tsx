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
    description: '探索紫微斗數在親子教養中的應用，理解孩子的天賦特質，建立更深層的親子連結',
  },
  'zh-CN': {
    title: '亲紫专栏 - 亲紫之间',
    pageTitle: '亲紫专栏',
    description: '探索紫微斗数在亲子教养中的应用，理解孩子的天赋特质，建立更深层的亲子连结',
  },
  'en': {
    title: 'Articles - Qin Zi Blog',
    pageTitle: 'Articles',
    description: 'Explore the application of Zi Wei Dou Shu in parenting, understand your child\'s unique talents',
  },
  'ja': {
    title: '記事 - 親紫の間',
    pageTitle: '記事',
    description: '紫微斗数の育児への応用を探求し、お子様のユニークな才能を理解しましょう',
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
  const profile = await getColumnProfile(locale);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <Suspense fallback={<ColumnPageSkeleton />}>
        <ColumnPage profile={profile} locale={locale} />
      </Suspense>
    </div>
  );
}
