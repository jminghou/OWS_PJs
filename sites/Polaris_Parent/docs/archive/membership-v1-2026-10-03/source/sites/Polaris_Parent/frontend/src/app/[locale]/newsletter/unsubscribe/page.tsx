import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import TokenAction from '@ows/newsletter/components/TokenAction';
import { getNewsletterContent, localePath } from '@/i18n/newsletterContent';

interface PageProps {
  params: Promise<{ locale: string }>;
}

// 信件連結專用頁（?token=…），不該被索引
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return { title: getNewsletterContent(locale).unsubscribe.title, robots: { index: false, follow: false } };
}

export default async function NewsletterUnsubscribePage({ params }: PageProps) {
  const { locale } = await params;
  const content = getNewsletterContent(locale);
  return (
    <Suspense>
      <TokenAction
        mode="unsubscribe"
        labels={content.unsubscribe}
        footer={<Link href={localePath(locale)} className="text-brand-purple-700 underline underline-offset-4 hover:text-brand-purple-900">{content.backHome}</Link>}
      />
    </Suspense>
  );
}
