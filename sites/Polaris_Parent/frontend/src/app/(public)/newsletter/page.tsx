import type { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import NewsletterLanding from '@/components/home/NewsletterLanding';
import { getNewsletterContent } from '@/i18n/newsletterContent';
import { getPublicLocales } from '@/lib/i18n/publicLocales';

const LOCALE = 'zh-TW';
const { page } = getNewsletterContent(LOCALE);

export async function generateMetadata(): Promise<Metadata> {
  const publicLocales = await getPublicLocales();
  return {
    title: page.title,
    description: page.description,
    alternates: buildStaticPageAlternates('/newsletter', LOCALE, publicLocales),
  };
}

export default function NewsletterPage() {
  return <NewsletterLanding locale={LOCALE} />;
}
