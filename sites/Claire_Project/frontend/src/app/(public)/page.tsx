import { Metadata } from 'next';
import { contentApi, homepageApi } from '@/lib/api';
import { Content } from '@/types';
import HomePageContent from '@/components/public/HomePageContent';
import { localeContent } from '@/i18n/homePageData';

// ISR: 每 10 分鐘重新驗證
export const revalidate = 600;

export const metadata: Metadata = {
  title: '數位鍊金室 - 首頁',
  description: '專為長期主義者設計的策略顧問服務，協助決策者掌握數位轉型、MarTech 與電商增長策略',
};

async function getFeaturedPosts(): Promise<Content[]> {
  try {
    const response = await contentApi.getList({
      status: 'published',
      type: 'article',
      per_page: 3,
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

export default async function HomePage() {
  const featuredPosts = await getFeaturedPosts();
  const homepageSettings = await getHomepageSettings();
  const content = localeContent['zh-TW'];

  return (
    <HomePageContent
      locale="zh-TW"
      content={content}
      featuredPosts={featuredPosts}
      homepageSettings={homepageSettings}
    />
  );
}
