import { Metadata } from 'next';
import { contentApi, homepageApi } from '@/lib/api';
import { Content } from '@/types';
import HomePageContent from '@/components/public/HomePageContent';
import { localeContent } from '@/i18n/homePageData';

// ISR: 每 10 分鐘重新驗證
export const revalidate = 600;

export const metadata: Metadata = {
  title: '親紫之間 - 首頁',
  description: '透過紫微斗數與數據分析，幫助家長理解孩子，成為孩子穩定的弓，讓孩子如箭般飛向遠方',
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
