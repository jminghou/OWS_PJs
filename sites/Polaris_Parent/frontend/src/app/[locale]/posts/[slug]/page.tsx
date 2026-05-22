import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentApi } from '@/lib/api';
import { Content } from '@/types';
import PostDetailContent from '@/app/(public)/posts/[slug]/PostDetailContent';
import JsonLd from '@/components/seo/JsonLd';
import { buildArticleJsonLd, buildContentAlternates, buildFaqJsonLd, buildHowToJsonLd } from '@/lib/seo';
import { getRelatedPosts } from '@/lib/relatedPosts';

// ISR：靜態產生 + 背景重新驗證（從邊緣快取直接送出，慢後端不卡使用者）
export const revalidate = 3600;

const notFoundLabel: Record<string, string> = {
  'zh-TW': '文章不存在',
  'zh-CN': '文章不存在',
  'en': 'Article not found',
  'ja': '記事が見つかりません',
};

interface PostDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

// React cache 去重：generateMetadata 與頁面共用同一次抓取
const getPost = cache(async (slug: string): Promise<Content | null> => {
  try {
    const response = await contentApi.getBySlug(slug);
    if (response.status !== 'published') return null;
    return response;
  } catch (error: any) {
    console.error('Error fetching post:', error.message || error);
    return null;
  }
});

// 生成靜態路徑以利於 ISR
export async function generateStaticParams() {
  try {
    const response = await contentApi.getList({ per_page: 100, status: 'published' });
    const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];
    const params = [];
    for (const post of response.contents) {
      for (const locale of locales) {
        params.push({ locale, slug: post.slug });
      }
    }
    return params;
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: notFoundLabel[locale] || notFoundLabel['zh-TW'] };
  }

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.summary,
    keywords: post.tags?.map(tag => tag.name).join(', '),
    // 以當前語言為自我 canonical，並由翻譯群組組出 hreflang
    alternates: buildContentAlternates(post, locale),
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.summary,
      images: post.featured_image ? [post.featured_image] : undefined,
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: post.author?.username ? [post.author.username] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary,
      images: post.featured_image ? [post.featured_image] : undefined,
    },
  };
}

export default async function LocalePostDetailPage({ params }: PostDetailPageProps) {
  const { locale, slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const faq = buildFaqJsonLd(post);
  const howTo = buildHowToJsonLd(post);
  const relatedPosts = await getRelatedPosts(post);

  return (
    <>
      <JsonLd data={[buildArticleJsonLd(post, locale), ...(faq ? [faq] : []), ...(howTo ? [howTo] : [])]} />
      <PostDetailContent post={post} relatedPosts={relatedPosts} />
    </>
  );
}
