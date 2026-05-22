import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentApi } from '@/lib/api';
import { Content } from '@/types';
import PostDetailContent from './PostDetailContent';
import JsonLd from '@/components/seo/JsonLd';
import { buildArticleJsonLd, buildBreadcrumbJsonLd, buildContentAlternates, buildFaqJsonLd, buildHowToJsonLd } from '@/lib/seo';
import { getRelatedPosts } from '@/lib/relatedPosts';

// ISR：靜態產生 + 每小時背景重新驗證。文章頁因此從 Vercel 邊緣快取直接送出（點擊秒開），
// 慢的後端 API 只在「建置 / 背景重新產生」時才被呼叫，不會卡到使用者。
export const revalidate = 3600;

interface PostDetailPageProps {
  params: Promise<{ slug: string }>;
}

// 用 React cache 去重：generateMetadata 與頁面共用同一次抓取
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

// 預先產生已發佈文章的靜態頁（建置時）。新文章未在清單內者，首次造訪時 on-demand 產生並快取。
export async function generateStaticParams() {
  try {
    const response = await contentApi.getList({
      status: 'published',
      type: 'article',
      per_page: 1000,
      language: 'zh-TW',
    });
    return response.contents.map((post) => ({ slug: post.slug }));
  } catch (error) {
    console.error('generateStaticParams (posts) failed:', error);
    return [];
  }
}

export async function generateMetadata({ params }: PostDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: '文章不存在' };
  }

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.summary,
    keywords: post.tags?.map(tag => tag.name).join(', '),
    // 自我 canonical + 由翻譯群組組出的 hreflang（沒有翻譯時僅輸出自身）
    alternates: buildContentAlternates(post),
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
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const breadcrumb = buildBreadcrumbJsonLd([
    { name: '首頁', path: '/' },
    { name: '親紫專欄', path: '/posts' },
    ...(post.category?.name ? [{ name: post.category.name, path: `/posts?category=${post.category.slug ?? ''}` }] : []),
    { name: post.title, path: `/posts/${post.slug}` },
  ]);
  const faq = buildFaqJsonLd(post);
  const howTo = buildHowToJsonLd(post);
  const relatedPosts = await getRelatedPosts(post);

  return (
    <>
      <JsonLd data={[buildArticleJsonLd(post), breadcrumb, ...(faq ? [faq] : []), ...(howTo ? [howTo] : [])]} />
      <PostDetailContent post={post} relatedPosts={relatedPosts} />
    </>
  );
}
