import Link from 'next/link';
import JsonLd from '@ows/site-kit/components/JsonLd';
import { buildItemListJsonLd } from '@ows/site-kit/seo';
import type { Content } from '@/types';
import { localePath } from '@/i18n/newsletterContent';

interface ArticleTextListProps {
  locale: string;
  articles: Content[];
  heading: string;
  viewAllText: string;
  emptyText: string;
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    iso: date.toISOString().slice(0, 10),
    text: date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
  };
}

/** 精選文章：只放標題與日期的文字清單。同時輸出 ItemList 結構化資料。 */
export default function ArticleTextList({ locale, articles, heading, viewAllText, emptyText }: ArticleTextListProps) {
  const itemList = buildItemListJsonLd(articles, locale);
  return (
    <section id="articles" aria-labelledby="home-articles-heading" className="scroll-mt-20">
      {itemList && <JsonLd data={itemList} />}
      <h2 id="home-articles-heading" className="text-2xl font-bold text-gray-900">{heading}</h2>
      {articles.length === 0 ? (
        <p className="mt-6 text-gray-500">{emptyText}</p>
      ) : (
        <ul className="mt-6 divide-y divide-warm-200">
          {articles.map((post) => {
            const date = formatDate(post.published_at || post.created_at, locale);
            return (
              <li key={post.id}>
                <Link href={localePath(locale, `/posts/${post.slug}`)} className="group flex items-baseline justify-between gap-6 py-4">
                  <span className="text-lg leading-snug text-gray-900 underline-offset-4 group-hover:text-brand-purple-700 group-hover:underline">
                    {post.title}
                  </span>
                  {date && (
                    <time dateTime={date.iso} className="hidden flex-shrink-0 text-sm tabular-nums text-gray-500 sm:block">
                      {date.text}
                    </time>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6">
        <Link href={localePath(locale, '/articles')} className="font-medium text-brand-purple-700 underline-offset-4 hover:underline">
          {viewAllText} →
        </Link>
      </p>
    </section>
  );
}
