import Link from 'next/link';
import type { Author } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { authorPath } from '@/lib/seo';

const HEADINGS: Record<string, string> = {
  'zh-TW': '關於作者',
  'zh-CN': '关于作者',
  'en': 'Meet the Authors',
  'ja': '執筆者について',
};

const VIEW_LABEL: Record<string, string> = {
  'zh-TW': '查看文章 →',
  'zh-CN': '查看文章 →',
  'en': 'View articles →',
  'ja': '記事を見る →',
};

const SOCIAL_LABELS: Record<string, string> = {
  website: '官網',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  line: 'LINE',
};

interface AuthorsSectionProps {
  authors: Author[];
  locale?: string;
}

/**
 * 「關於我們」頁的作者區塊：把品牌與真實作者連結起來（E-E-A-T）。
 * 作者頁僅存在於非語言前綴路徑（/authors/...），故連結一律用 authorPath（不加 locale）。
 */
export default function AuthorsSection({ authors, locale = 'zh-TW' }: AuthorsSectionProps) {
  if (!authors || authors.length === 0) return null;

  const heading = HEADINGS[locale] || HEADINGS['zh-TW'];
  const viewLabel = VIEW_LABEL[locale] || VIEW_LABEL['zh-TW'];

  return (
    <section className="not-prose mb-16">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">{heading}</h2>

      <div className={`grid gap-6 ${authors.length === 1 ? 'max-w-2xl mx-auto' : 'sm:grid-cols-2'}`}>
        {authors.map((author) => {
          const social = Object.entries(author.social_links || {}).filter(([, v]) => !!v);
          return (
            <div
              key={author.id}
              className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row gap-4 items-center sm:items-start"
            >
              {author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getImageUrl(author.avatar)}
                  alt={author.name}
                  className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                  {author.name.charAt(0)}
                </div>
              )}

              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-gray-900">
                  <Link href={authorPath(author)} className="hover:text-blue-700 transition-colors">
                    {author.name}
                  </Link>
                </h3>
                {author.title && <p className="text-sm text-amber-700 mt-0.5">{author.title}</p>}
                {author.bio && (
                  <p className="text-sm text-gray-600 leading-relaxed mt-2 line-clamp-3">{author.bio}</p>
                )}

                {author.expertise && author.expertise.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 justify-center sm:justify-start">
                    {author.expertise.map((item) => (
                      <span key={item} className="text-xs text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {social.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 justify-center sm:justify-start">
                    {social.map(([key, url]) => (
                      <a
                        key={key}
                        href={url as string}
                        target="_blank"
                        rel="me noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        {SOCIAL_LABELS[key] || key}
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <Link href={authorPath(author)} className="text-sm text-blue-600 hover:text-blue-800">
                    {viewLabel}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
