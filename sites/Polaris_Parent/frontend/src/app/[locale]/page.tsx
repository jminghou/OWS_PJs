import { Metadata } from 'next';
import { contentApi, homepageApi } from '@/lib/api';
import { Content } from '@/types';
import HomePageContent from '@/components/public/HomePageContent';
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

async function getLatestPosts(locale: string): Promise<Content[]> {
  try {
    const response = await contentApi.getList({
      status: 'published',
      type: 'article',
      per_page: 12, // 首頁文章牆上限 12 篇
      language: locale,
    });
    return response.contents;
  } catch (error: any) {
    console.error('Error fetching latest posts:', error.message || error);
    return [];
  }
}

async function getHomepageSettings() {
  try {
    const settings = await homepageApi.getSettings();
    return settings;
  } catch (error: any) {
    console.error('Error fetching homepage settings:', error.message || error);
    return { slides: [], button_text: {}, updated_at: '' };
  }
}

export default async function LocaleHomePage({ params }: PageProps) {
  const { locale } = await params;
  const content = localeContent[locale] || localeContent['zh-TW'];
  const latestPosts = await getLatestPosts(locale);
  const homepageSettings = await getHomepageSettings();

  return (
    <HomePageContent
      locale={locale}
      content={content}
      latestPosts={latestPosts}
      homepageSettings={homepageSettings}
    />
  );
}
