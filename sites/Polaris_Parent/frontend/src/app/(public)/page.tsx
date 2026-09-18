import { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import HomeLanding from '@/components/home/HomeLanding';
import { localeContent } from '@/i18n/homePageData';
import { getHomePageData } from '@/lib/homepage';

// ISR: 每 60 秒重新驗證（新文章發佈後最多 60 秒內出現在首頁，不需手動 redeploy）
export const revalidate = 60;

const LOCALE = 'zh-TW';
const content = localeContent[LOCALE];

export const metadata: Metadata = {
  // absolute：首頁不套 layout 的「%s | 親紫之間」模板，避免站名重複
  title: { absolute: `${content.heroBrand}｜${content.heroTitle}` },
  description: content.description,
  alternates: buildStaticPageAlternates('/', LOCALE),
};

export default async function HomePage() {
  const { homepageSettings, articles } = await getHomePageData(LOCALE);
  return <HomeLanding locale={LOCALE} homepageSettings={homepageSettings} articles={articles} />;
}
