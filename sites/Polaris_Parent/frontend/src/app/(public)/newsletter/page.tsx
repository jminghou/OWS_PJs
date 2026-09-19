import type { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import NewsletterLanding from '@/components/home/NewsletterLanding';
import { getNewsletterContent } from '@/i18n/newsletterContent';

const LOCALE = 'zh-TW';
const { page } = getNewsletterContent(LOCALE);

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: buildStaticPageAlternates('/newsletter', LOCALE),
};

export default function NewsletterPage() {
  return <NewsletterLanding locale={LOCALE} />;
}
