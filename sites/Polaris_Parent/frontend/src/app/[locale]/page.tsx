import { Metadata } from 'next';
import { contentApi, homepageApi } from '@/lib/api';
import { Content } from '@/types';
import HomePageContent from '@/components/public/HomePageContent';
import { localeContent } from '@/i18n/homePageData';

// 設定 ISR：每小時重新驗證一次
export const revalidate = 3600;

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

async function getFeaturedPosts(locale: string): Promise<Content[]> {
  try {
    const response = await contentApi.getList({
      status: 'published',
      type: 'article',
      per_page: 3,
      language: locale,
    });
    return response.contents;
  } catch (error: any) {
    console.error('Error fetching featured posts:', error.message || error);
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
  const featuredPosts = await getFeaturedPosts(locale);
  const homepageSettings = await getHomepageSettings();

  return (
    <HomePageContent
      locale={locale}
      content={content}
      featuredPosts={featuredPosts}
      homepageSettings={homepageSettings}
    />
  );
}
