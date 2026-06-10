import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentApi } from '@/lib/api';
import { Content } from '@/types';
import PostDetailContent from './PostDetailContent';

// ISR: 每小時重新驗證；後台存檔會經由 /api/revalidate 立即清快取。
// 注意：此頁不可讀取 searchParams/cookies 等動態 API，否則整個路由會退回
// 動態渲染，每次點擊都要等後端與資料庫（Neon 冷啟動），ISR 形同失效。
export const revalidate = 3600;

interface PostDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function getPost(slug: string): Promise<Content | null> {
  try {
    const response = await contentApi.getBySlug(slug);

    // 公開頁只允許已發佈的文章
    if (response.status !== 'published') {
      return null;
    }

    return response;
  } catch (error: any) {
    console.error('Error fetching post:', error.message || error);
    return null;
  }
}

// build 時預先產生所有已發佈文章的靜態頁，讓第一次點擊直接由 CDN 回應。
// 之後新發佈的文章（dynamicParams 預設 true）會在第一次造訪時產生並快取。
export async function generateStaticParams() {
  try {
    const response = await contentApi.getList({
      per_page: 100,
      status: 'published',
      type: 'article',
    });
    return response.contents.map((post) => ({ slug: post.slug }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const post = await getPost(resolvedParams.slug);

  if (!post) {
    return {
      title: '文章不存在',
    };
  }

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.summary,
    keywords: post.tags?.map(tag => tag.name).join(', '),
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

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const resolvedParams = await params;
  const post = await getPost(resolvedParams.slug);

  if (!post) {
    notFound();
  }

  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.summary,
    image: post.featured_image,
    url: `${BASE_URL}/posts/${post.slug}`,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: post.author ? {
      '@type': 'Person',
      name: post.author.username,
    } : undefined,
    publisher: {
      '@type': 'Organization',
      name: '數位轉型策略諮詢',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PostDetailContent post={post} />
    </>
  );
}
