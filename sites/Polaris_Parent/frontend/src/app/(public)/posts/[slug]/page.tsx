import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentApi } from '@/lib/api';
import { Content } from '@/types';
import PostDetailContent from './PostDetailContent';

// ISR: 每小時重新驗證
export const revalidate = 3600;

interface PostDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    preview?: string;
  }>;
}

async function getPost(slug: string, isPreview: boolean = false): Promise<Content | null> {
  try {
    console.log('Fetching post with slug:', slug, 'Preview mode:', isPreview);
    const response = await contentApi.getBySlug(slug);
    console.log('API response:', response);
    
    // 如果不是預覽模式，只允許已發佈的文章
    if (!isPreview && response.status !== 'published') {
      console.log('Post not published and not preview mode');
      return null;
    }
    
    return response;
  } catch (error: any) {
    console.error('Error fetching post:', error.message || error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      errors: error.errors,
    });
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: PostDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const isPreview = resolvedSearchParams.preview === 'true';
  const post = await getPost(resolvedParams.slug, isPreview);

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

export default async function PostDetailPage({ params, searchParams }: PostDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const isPreview = resolvedSearchParams.preview === 'true';
  const post = await getPost(resolvedParams.slug, isPreview);

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
      name: '紫微斗數諮詢',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {isPreview && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">
                您正在預覽模式中檢視此文章。這個頁面只有管理員可以存取。
              </p>
            </div>
          </div>
        </div>
      )}
      <PostDetailContent post={post} />
    </>
  );
}