import type { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import PrivacyPolicy from '@/components/platform/public/PrivacyPolicy';
import { getPrivacyContent } from '@/i18n/privacyContent';
import { getPublicLocales } from '@/lib/i18n/publicLocales';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const content = getPrivacyContent(locale);
  return {
    title: content.title,
    description: content.description,
    alternates: buildStaticPageAlternates('/privacy', locale, await getPublicLocales()),
  };
}

export default async function LocalePrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  return <PrivacyPolicy locale={locale} />;
}
