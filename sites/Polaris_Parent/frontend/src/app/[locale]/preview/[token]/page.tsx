import { Metadata } from 'next';
import ArticlePreview from '@/components/preview/ArticlePreview';

// 其他語言版本的文章預覽：頁首頁尾用該語言。middleware 對 /{locale}/preview/ 不做語言關卡（憑連結即可看）。
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false, follow: false, nocache: true },
};

export default async function LocaleArticlePreviewPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  return <ArticlePreview token={token} locale={locale} />;
}
