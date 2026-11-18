import { Metadata } from 'next';
import ArticlePreview from '@/components/preview/ArticlePreview';
import { defaultLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '文章預覽',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ArticlePreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ArticlePreview token={token} locale={defaultLocale} />;
}
