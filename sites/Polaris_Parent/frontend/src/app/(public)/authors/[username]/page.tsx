import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authorApi, type AuthorDetailResponse } from '@/lib/api';
import { getImageUrl, formatDate } from '@/lib/utils';
import JsonLd from '@/components/platform/seo/JsonLd';
import {
  buildPersonJsonLd,
  buildBreadcrumbJsonLd,
  absoluteUrl,
  authorPath,
} from '@/lib/seo';

// ISR：每小時重新驗證
export const revalidate = 3600;

interface AuthorPageProps {
  params: Promise<{ username: string }>;
}

async function getAuthor(username: string): Promise<AuthorDetailResponse | null> {
  try {
    return await authorApi.getByUsername(username);
  } catch {
    return null;
  }
}

// 社群連結顯示名稱對照
const SOCIAL_LABELS: Record<string, string> = {
  website: '官方網站',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  line: 'LINE',
};

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await getAuthor(username);
  if (!data) return { title: '作者不存在' };

  const { author } = data;
  const description =
    author.bio ||
    [author.title, author.name].filter(Boolean).join('，') ||
    `${author.name} 在親紫之間的文章`;

  return {
    title: author.name,
    description,
    alternates: { canonical: absoluteUrl(authorPath(author)) },
    openGraph: {
      type: 'profile',
      title: author.name,
      description,
      images: author.avatar ? [getImageUrl(author.avatar)] : undefined,
    },
  };
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { username } = await params;
  const data = await getAuthor(username);
  if (!data) notFound();

  const { author, contents } = data;
  const socialEntries = Object.entries(author.social_links || {}).filter(([, v]) => !!v);

  const personJsonLd = buildPersonJsonLd(author);
  const breadcrumb = buildBreadcrumbJsonLd([
    { name: '首頁', path: '/' },
    { name: author.name, path: authorPath(author) },
  ]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <JsonLd data={[personJsonLd, breadcrumb]} />

      <div className="mx-auto px-4 sm:px-6 w-full lg:w-[1080px]">
        {/* 作者檔案 */}
        <header className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* 頭像 */}
            {author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getImageUrl(author.avatar)}
                alt={author.name}
                className="w-24 h-24 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-3xl font-bold flex-shrink-0">
                {author.name.charAt(0)}
              </div>
            )}

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{author.name}</h1>
              {author.title && (
                <p className="text-sm text-amber-700 font-medium mt-1">{author.title}</p>
              )}
              {author.credentials && (
                <p className="text-xs text-gray-500 mt-1">{author.credentials}</p>
              )}
              {author.bio && (
                <p className="text-sm text-gray-700 leading-relaxed mt-4">{author.bio}</p>
              )}

              {/* 專長領域 */}
              {author.expertise && author.expertise.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                  {author.expertise.map((item) => (
                    <span
                      key={item}
                      className="text-xs text-gray-700 bg-gray-100 px-3 py-1 rounded-full"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}

              {/* 社群連結（rel="me" 協助 AI 驗證作者身分） */}
              {socialEntries.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 justify-center sm:justify-start">
                  {socialEntries.map(([key, url]) => (
                    <a
                      key={key}
                      href={url as string}
                      target="_blank"
                      rel="me noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {SOCIAL_LABELS[key] || key}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 作者文章列表 */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="w-3 h-3 bg-amber-500 rounded-full mr-2"></span>
            {author.name} 的文章（{contents.length}）
          </h2>

          {contents.length === 0 ? (
            <p className="text-sm text-gray-500">目前還沒有發佈的文章。</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {contents.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.slug}`}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                >
                  {(post.cover_image || post.featured_image) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(post.cover_image || post.featured_image)}
                      alt={post.title}
                      className="w-full aspect-[16/9] object-cover"
                    />
                  )}
                  <div className="p-4 flex-1 flex flex-col">
                    {post.category?.name && (
                      <span className="text-xs text-amber-700 mb-1">{post.category.name}</span>
                    )}
                    <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
                      {post.title}
                    </h3>
                    {post.summary && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{post.summary}</p>
                    )}
                    {post.published_at && (
                      <span className="text-xs text-gray-400 mt-auto pt-3">
                        {formatDate(post.published_at)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
