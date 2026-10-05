import { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import HomeLanding from '@/components/home/HomeLanding';
import { localeContent } from '@/i18n/homePageData';
import { getHomepageSettings } from '@/lib/homepage';

// ISR：每 60 秒重新驗證（後台改 Hero 文案時另有 on-demand revalidate）
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
  return <HomeLanding locale={locale} homepageSettings={await getHomepageSettings()} />;
}
