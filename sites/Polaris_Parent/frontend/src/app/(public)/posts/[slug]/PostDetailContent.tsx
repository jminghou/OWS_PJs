'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkSupersub from 'remark-supersub';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import { Content } from '@/types';
import { formatDateTime, getImageUrl, getGcsImageUrl } from '@/lib/utils';
import { extractToc, extractKeyTakeaways } from '@ows/content-kit';
import { absoluteUrl } from '@ows/site-kit';
import { ShareButtons as ShareButtons } from '@ows/site-kit';
import SaveArticleButton from '@/components/domain/membership/SaveArticleButton';
import { Lightbulb, ListTree } from 'lucide-react';
import Tag, { TAG_BASE } from '@/components/ui/Tag';
import SubscribeBlock from '@/components/home/SubscribeBlock';
import { getNewsletterContent } from '@/i18n/newsletterContent';
import ArticleCard, { ARTICLE_GRID } from '@/app/(public)/articles/ArticleCard';

// 文字連結：blue-500，hover 變 pink-600（規範 §4.3 / §8.1）
const TEXT_LINK =
  'text-blue-500 underline-offset-[3px] transition-colors duration-150 ease-out hover:text-pink-600 hover:underline ' +
  'focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

interface PostDetailContentProps {
  post: Content;
  relatedPosts?: Content[];
}

export default function PostDetailContent({ post, relatedPosts = [] }: PostDetailContentProps) {
  const [imgSrc, setImgSrc] = useState(getGcsImageUrl(post.featured_image || '', 'large'));

  // 抽出「重點整理」並從內文移除；目錄由移除後的內文產生（與 rehype-slug 的 id 對齊）
  const { takeaways, body } = extractKeyTakeaways(post.content);
  const toc = extractToc(body);
  // 分享用的是 canonical 網址（不含語言前綴/查詢字串）
  const shareUrl = absoluteUrl(`/posts/${post.slug}`);
  // 文末電子報卡：與首頁、電子報頁同一個 SubscribeBlock，語系跟著文章
  const newsletterLocale = post.language || 'zh-TW';
  const newsletter = getNewsletterContent(newsletterLocale);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper">
      <main>
        <article className="mx-auto max-w-prose px-4 pb-16 pt-12 md:px-0 md:pb-24 md:pt-16">
          {/* 1. 標籤＋日期（親紫專欄 › 分類） */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Tag tone="category">親紫專欄</Tag>
            {post.category && <Tag tone="category">{post.category.name}</Tag>}
            <time
              dateTime={post.published_at || post.created_at}
              className="text-caption text-muted"
            >
              發布於：<span className="font-latin">{formatDateTime(post.published_at || post.created_at)}</span>
            </time>
          </div>

          {/* 2. 標題 */}
          <h1 className="font-heading text-[32px] font-normal text-ink [text-wrap:pretty] md:text-h1">
            {post.title}
          </h1>

          {/* 作者（取消瀏覽次數） */}
          {(post.author || post.likes_count > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-4 text-small text-muted">
              {post.author && (
                <span>
                  作者：
                  <Link
                    href={`/authors/${post.author.slug || post.author.username}`}
                    className={TEXT_LINK}
                  >
                    {post.author.name || post.author.username}
                  </Link>
                </span>
              )}
              {post.likes_count > 0 && (
                <span>讚：<span className="font-latin">{post.likes_count}</span></span>
              )}
            </div>
          )}

          {/* 3. 封面圖 */}
          {post.featured_image && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-[32px] bg-tint">
              <Image
                src={imgSrc}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 672px) 100vw, 640px"
                onError={() => {
                  const original = getImageUrl(post.featured_image);
                  if (imgSrc !== original) {
                    setImgSrc(original);
                  }
                }}
              />
            </div>
          )}

          {/* 文章摘要 */}
          {post.summary && (
            <div className="mt-8 rounded-inner bg-white p-5 md:p-6">
              <h2 className="mb-2 font-heading text-[18px] font-normal text-ink md:text-h4">文章摘要</h2>
              <p className="text-small text-text [text-wrap:pretty]">{post.summary}</p>
            </div>
          )}

          {/* 重點整理 (TL;DR)：AI 最易整段抽取的格式 */}
          {takeaways.length > 0 && (
            <aside className="mt-6 rounded-inner bg-blue-50 p-5 md:p-6">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-[18px] font-normal text-blue-800 md:text-h4">
                <Lightbulb className="h-5 w-5 shrink-0 text-blue-500" strokeWidth={2} aria-hidden="true" />
                重點整理
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-small text-blue-800 marker:text-blue-500">
                {takeaways.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </aside>
          )}

          {/* 目錄 (錨點對齊 rehype-slug 的標題 id)；長文才顯示 */}
          {toc.length >= 3 && (
            <nav aria-label="目錄" className="mt-6 rounded-inner bg-white p-5 md:p-6">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-[18px] font-normal text-ink md:text-h4">
                <ListTree className="h-5 w-5 shrink-0 text-blue-500" strokeWidth={2} aria-hidden="true" />
                目錄
              </h2>
              <ul className="space-y-1.5 text-small">
                {toc.map((item) => (
                  <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
                    <a href={`#${item.id}`} className={TEXT_LINK}>
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* 4. 內文 (scroll-mt 讓錨點不被 sticky 頁首遮住) */}
          <div className="prose prose-lg mt-10 max-w-none [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24 [&_h4]:scroll-mt-24">
            {body && (
              <ReactMarkdown
                className="prose-content"
                remarkPlugins={[remarkGfm, remarkSupersub]}
                rehypePlugins={[rehypeRaw, rehypeSlug]}
              >
                {body}
              </ReactMarkdown>
            )}
          </div>

          {/* 標籤 */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-6">
              <span className="mr-2 text-sm font-medium text-ink">標籤：</span>
              {post.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/posts?tag=${tag.name}`}
                  className={`${TAG_BASE} bg-blue-50 text-blue-800 no-underline transition-colors duration-150 ease-out hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100`}
                >
                  #{tag.slug}
                </Link>
              ))}
            </div>
          )}

          {/* 收藏 + 社群分享 */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <SaveArticleButton contentId={post.id} />
            <ShareButtons url={shareUrl} title={post.title} />
          </div>

          {/* 5. 文末電子報卡（§6.5），沿用站台既有的訂閱表單 */}
          <section aria-labelledby="post-subscribe-heading" className="mt-12 rounded-card bg-pink-50 p-7">
            <h2
              id="post-subscribe-heading"
              className="font-heading text-[24px] font-normal leading-[1.4] text-ink [text-wrap:pretty]"
            >
              {newsletter.page.title}
            </h2>
            <p className="mt-3 text-text [text-wrap:pretty]">{newsletter.page.intro}</p>
            <div className="mt-6">
              <SubscribeBlock locale={newsletterLocale} source="article" />
            </div>
          </section>
        </article>

        {/* 6. 相關推薦（伺服器端渲染，進入初始 HTML 利於 AI/搜尋抓取與站內連結） */}
        {relatedPosts.length > 0 && (
          <section aria-labelledby="related-posts-heading" className="bg-tint py-16 md:py-24">
            <div className="mx-auto max-w-content px-4 md:px-6">
              <h2
                id="related-posts-heading"
                className="mb-8 font-heading text-[26px] font-normal text-ink [text-wrap:pretty] md:mb-12 md:text-h2"
              >
                相關推薦
              </h2>
              <div className={ARTICLE_GRID}>
                {relatedPosts.map((related) => (
                  <ArticleCard key={related.id} post={related} headingAs="h3" />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
