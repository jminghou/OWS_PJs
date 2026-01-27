import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentApi } from '@/lib/api';
import { Content } from '@/types';
import PostDetailContent from '@/app/(public)/posts/[slug]/PostDetailContent';

// 設定 ISR：每小時重新驗證一次 (3600 秒)
export const revalidate = 3600;

// 多語言內容
const localeContent: Record<string, { notFound: string; previewWarning: string }> = {
  'zh-TW': {
    notFound: '文章不存在',
    previewWarning: '您正在預覽模式中檢視此文章。這個頁面只有管理員可以存取。',
  },
  'zh-CN': {
    notFound: '文章不存在',
    previewWarning: '您正在预览模式中查看此文章。这个页面只有管理员可以访问。',
  },
  'en': {
    notFound: 'Article not found',
    previewWarning: 'You are viewing this article in preview mode. This page is only accessible to administrators.',
  },
  'ja': {
    notFound: '記事が見つかりません',
    previewWarning: 'プレビューモードでこの記事を表示しています。このページは管理者のみがアクセスできます。',
  },
};

interface PostDetailPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
  searchParams: Promise<{
    preview?: string;
  }>;
}

async function getPost(slug: string, isPreview: boolean = false): Promise<Content | null> {
  try {
    console.log('Fetching post with slug:', slug, 'Preview mode:', isPreview);
    
    // 如果是預覽模式，我們不使用快取
    const options = isPreview ? { cache: 'no-store' as RequestCache } : {};
    
    const response = await contentApi.getBySlug(slug, undefined, options);
    console.log('API response:', response);

    // 如果不是預覽模式，只允許已發佈的文章
    if (!isPreview && response.status !== 'published') {
      console.log('Post not published and not preview mode');
      return null;
    }

    return response;
  } catch (error: any) {
    console.error('Error fetching post:', error);
    return null;
  }
}

// 生成靜態路徑以利於 ISR
export async function generateStaticParams() {
  try {
    const response = await contentApi.getList({ per_page: 100, status: 'published' });
    
    // 為每個支援的語言生成路徑
    const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];
    const params = [];

    for (const post of response.contents) {
      for (const locale of locales) {
        params.push({
          locale,
          slug: post.slug,
        });
      }
    }

    return params;
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

export async function generateMetadata({ params, searchParams }: PostDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const isPreview = resolvedSearchParams.preview === 'true';
  const post = await getPost(resolvedParams.slug, isPreview);
  const content = localeContent[resolvedParams.locale] || localeContent['zh-TW'];

  if (!post) {
    return {
      title: content.notFound,
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

export default async function LocalePostDetailPage({ params, searchParams }: PostDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const isPreview = resolvedSearchParams.preview === 'true';
  const post = await getPost(resolvedParams.slug, isPreview);
  const content = localeContent[resolvedParams.locale] || localeContent['zh-TW'];

  if (!post) {
    notFound();
  }

  return (
    <>
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
                {content.previewWarning}
              </p>
            </div>
          </div>
        </div>
      )}
      <PostDetailContent post={post} />
    </>
  );
}
