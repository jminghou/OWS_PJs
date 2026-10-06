import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { authorApi, type AuthorDetailResponse } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import Tag from '@/components/ui/Tag';
import ArticleCard, { ARTICLE_GRID } from '@/app/(public)/articles/ArticleCard';
import { JsonLd } from '@ows/site-kit';
import {
  buildPersonJsonLd,
  buildBreadcrumbJsonLd,
  absoluteUrl,
  authorPath,
} from '@ows/site-kit';

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
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <JsonLd data={[personJsonLd, breadcrumb]} />

      <div className="mx-auto max-w-content px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-16">
        {/* 作者檔案 */}
        <header className="rounded-card bg-white p-6 md:p-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* 頭像 */}
            {author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getImageUrl(author.avatar)}
                alt={author.name}
                className="h-24 w-24 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 font-heading text-[32px] text-blue-800">
                {author.name.charAt(0)}
              </div>
            )}

            <div className="flex-1 text-center sm:text-left">
              <h1 className="font-heading text-[32px] font-normal text-ink [text-wrap:pretty] md:text-h1">{author.name}</h1>
              {author.title && (
                <p className="mt-1 text-small font-medium text-blue-800">{author.title}</p>
              )}
              {author.credentials && (
                <p className="mt-1 text-caption text-muted">{author.credentials}</p>
              )}
              {author.bio && (
                <p className="mt-4 max-w-prose text-text [text-wrap:pretty]">{author.bio}</p>
              )}

              {/* 專長領域 */}
              {author.expertise && author.expertise.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {author.expertise.map((item) => (
                    <Tag key={item} tone="category">
                      {item}
                    </Tag>
                  ))}
                </div>
              )}

              {/* 社群連結（rel="me" 協助 AI 驗證作者身分） */}
              {socialEntries.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 sm:justify-start">
                  {socialEntries.map(([key, url]) => (
                    <a
                      key={key}
                      href={url as string}
                      target="_blank"
                      rel="me noopener noreferrer"
                      className="text-small text-blue-500 underline-offset-[3px] transition-colors duration-150 ease-out hover:text-pink-600 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
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
        <section className="mt-12 md:mt-16">
          <h2 className="mb-8 font-heading text-[26px] font-normal text-ink [text-wrap:pretty] md:text-h2">
            {author.name} 的文章（<span className="font-latin">{contents.length}</span>）
          </h2>

          {contents.length === 0 ? (
            <p className="text-text">目前還沒有發佈的文章。</p>
          ) : (
            <div className={ARTICLE_GRID}>
              {contents.map((post) => (
                <ArticleCard key={post.id} post={post} headingAs="h3" />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
