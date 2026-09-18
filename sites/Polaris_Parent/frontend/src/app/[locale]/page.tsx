import { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import HomeLanding from '@/components/home/HomeLanding';
import { localeContent } from '@/i18n/homePageData';
import { getHomePageData } from '@/lib/homepage';

// ISR：每 60 秒重新驗證（新文章 60 秒內出現在首頁）
export const revalidate = 60;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const content = localeContent[locale] || localeContent['zh-TW'];
  return {
    // absolute：首頁不套 layout 的「%s | 親紫之間」模板，避免站名重複
    title: { absolute: `${content.heroBrand}｜${content.heroTitle}` },
    description: content.description,
    alternates: buildStaticPageAlternates('/', locale),
  };
}

export default async function LocaleHomePage({ params }: PageProps) {
  const { locale } = await params;
  const { homepageSettings, articles } = await getHomePageData(locale);
  return <HomeLanding locale={locale} homepageSettings={homepageSettings} articles={articles} />;
}
