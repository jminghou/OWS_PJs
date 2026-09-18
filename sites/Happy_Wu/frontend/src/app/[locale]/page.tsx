import { Metadata } from 'next';
import { getHomePageData } from '@/lib/homepage';
import HomePageContent from '@/components/platform/public/HomePageContent';
import { localeContent } from '@/i18n/homePageData';

// ISR：每 60 秒重新驗證（新文章 60 秒內出現在首頁）
export const revalidate = 60;

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

export default async function LocaleHomePage({ params }: PageProps) {
  const { locale } = await params;
  const content = localeContent[locale] || localeContent['zh-TW'];
  const { latestPosts, homepageSettings } = await getHomePageData(locale);

  return (
    <HomePageContent
      locale={locale}
      content={content}
      latestPosts={latestPosts}
      homepageSettings={homepageSettings}
    />
  );
}
