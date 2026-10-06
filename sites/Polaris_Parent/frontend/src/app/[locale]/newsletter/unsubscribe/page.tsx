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
        footer={<Link href={localePath(locale)} className="text-blue-500 underline underline-offset-[3px] transition-colors duration-150 ease-out hover:text-pink-600 focus-visible:rounded-sm2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">{content.backHome}</Link>}
      />
    </Suspense>
  );
}
