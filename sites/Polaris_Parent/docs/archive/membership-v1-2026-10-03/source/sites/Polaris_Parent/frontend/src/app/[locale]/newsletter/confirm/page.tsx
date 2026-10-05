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
  return { title: getNewsletterContent(locale).confirm.title, robots: { index: false, follow: false } };
}

export default async function NewsletterConfirmPage({ params }: PageProps) {
  const { locale } = await params;
  const content = getNewsletterContent(locale);
  return (
    <Suspense>
      <TokenAction
        mode="confirm"
        labels={content.confirm}
        footer={<Link href={localePath(locale)} className="text-brand-purple-700 underline underline-offset-4 hover:text-brand-purple-900">{content.backHome}</Link>}
      />
    </Suspense>
  );
}
