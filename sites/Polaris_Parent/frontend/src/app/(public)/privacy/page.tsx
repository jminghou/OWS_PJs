import type { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import PrivacyPolicy from '@/components/platform/public/PrivacyPolicy';
import { getPrivacyContent } from '@/i18n/privacyContent';

const LOCALE = 'zh-TW';
const content = getPrivacyContent(LOCALE);

export const metadata: Metadata = {
  title: content.title,
  description: content.description,
  alternates: buildStaticPageAlternates('/privacy', LOCALE),
};

export default function PrivacyPage() {
  return <PrivacyPolicy locale={LOCALE} />;
}
