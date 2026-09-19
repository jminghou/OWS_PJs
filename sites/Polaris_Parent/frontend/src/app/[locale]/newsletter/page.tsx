import type { Metadata } from 'next';
import { buildStaticPageAlternates } from '@ows/site-kit/seo';
import NewsletterLanding from '@/components/home/NewsletterLanding';
import { getNewsletterContent } from '@/i18n/newsletterContent';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { page } = getNewsletterContent(locale);
  return {
    title: page.title,
    description: page.description,
    alternates: buildStaticPageAlternates('/newsletter', locale),
  };
}

export default async function LocaleNewsletterPage({ params }: PageProps) {
  const { locale } = await params;
  return <NewsletterLanding locale={locale} />;
}
