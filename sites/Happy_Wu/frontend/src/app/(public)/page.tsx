import { Metadata } from 'next';
import { getHomePageData } from '@/lib/homepage';
import HomePageContent from '@/components/platform/public/HomePageContent';
import { localeContent } from '@/i18n/homePageData';

// ISR: 每 60 秒重新驗證（新文章發佈後最多 60 秒內出現在首頁，不需手動 redeploy）
export const revalidate = 60;

export const metadata: Metadata = {
  title: '首頁',
  description: '職場媽媽崩潰啥？ 的個人專欄：分享生活、觀察與想法。',
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const { latestPosts, homepageSettings } = await getHomePageData('zh-TW');
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
