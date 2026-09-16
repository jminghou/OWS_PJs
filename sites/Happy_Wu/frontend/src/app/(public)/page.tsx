import { Metadata } from 'next';
import { contentApi, homepageApi } from '@/lib/api';
import { Content } from '@/types';
import HomePageContent from '@/components/platform/public/HomePageContent';
import { localeContent } from '@/i18n/homePageData';

// ISR: 每 60 秒重新驗證（新文章發佈後最多 60 秒內出現在首頁，不需手動 redeploy）
export const revalidate = 60;

export const metadata: Metadata = {
  title: '首頁',
  description: 'Happy Wu 的個人專欄：分享生活、觀察與想法。',
  alternates: { canonical: '/' },
};

async function getLatestPosts(): Promise<Content[]> {
  try {
    const response = await contentApi.getList({
      status: 'published',
      type: 'article',
      per_page: 12, // 首頁文章牆上限 12 篇
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

export default async function HomePage() {
  const latestPosts = await getLatestPosts();
  const homepageSettings = await getHomepageSettings();
  const content = localeContent['zh-TW'];

  return (
    <HomePageContent
      locale="zh-TW"
      content={content}
      latestPosts={latestPosts}
      homepageSettings={homepageSettings}
    />
  );
}
