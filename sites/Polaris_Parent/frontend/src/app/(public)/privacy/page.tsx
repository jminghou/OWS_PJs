import type { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import PrivacyPolicy from '@/components/platform/public/PrivacyPolicy';
import { getPrivacyContent } from '@/i18n/privacyContent';
import { getPublicLocales } from '@/lib/i18n/publicLocales';

const LOCALE = 'zh-TW';
const content = getPrivacyContent(LOCALE);

export async function generateMetadata(): Promise<Metadata> {
  const publicLocales = await getPublicLocales();
  return {
    title: content.title,
    description: content.description,
    alternates: buildStaticPageAlternates('/privacy', LOCALE, publicLocales),
  };
}

export default function PrivacyPage() {
  return <PrivacyPolicy locale={LOCALE} />;
}
