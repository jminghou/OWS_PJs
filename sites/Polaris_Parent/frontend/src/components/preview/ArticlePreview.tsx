import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { request } from '@/lib/api';
import { Content } from '@/types';
import PostDetailContent from '@/app/(public)/posts/[slug]/PostDetailContent';
import { getRelatedPosts } from '@ows/site-kit';
import { isLocale, localeNames } from '@/i18n/config';

// Studio 工作草稿的網站預覽（packages/studio/api/preview.py）。/preview/{token} 與 /{locale}/preview/{token} 共用。
// 憑簽章連結讀取、每次即時抓、不進 ISR 快取；不輸出 canonical／JSON-LD，頁面標 noindex。

interface PreviewVersion { language: string; title: string | null; website_status: string; path: string }

type PreviewContent = Content & {
  preview: { document_id: number; language: string; website_status: string; draft_updated_at: string | null; versions: PreviewVersion[] };
};

const STATUS_LABEL: Record<string, string> = {
  published: '網站上已有舊版本，這裡是尚未發布的修改',
  draft: '這篇文章尚未發布',
};

const langName = (code: string) => (isLocale(code) ? localeNames[code] : code);

export default async function ArticlePreview({ token, locale }: { token: string; locale: string }) {
  let post: PreviewContent;
  try {
    post = await request<PreviewContent>(`/studio/preview/${encodeURIComponent(token)}`, { cache: 'no-store' });
  } catch {
    notFound();
  }
  // 網址語言與文件語言不符（例如在預覽頁手動改網址）：導回正確的那一個
  const self = post.preview.versions.find((v) => v.language === post.preview.language);
  if (post.preview.language !== locale && self) redirect(self.path);
  const relatedPosts = await getRelatedPosts(post).catch(() => []);

  return (
    <>
      <div role="status" className="bg-amber-100 text-amber-950 text-sm border-b border-amber-300">
        <div className="mx-auto max-w-6xl px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span>
            <strong>文章預覽（{langName(post.preview.language)}）</strong>：只有拿到連結的人看得到，讀者與搜尋引擎看不到。
            {STATUS_LABEL[post.preview.website_status] || STATUS_LABEL.draft}
          </span>
          {post.preview.versions.length > 1 && (
            <nav aria-label="這篇文章的其他語言版本" className="flex flex-wrap gap-1.5">
              {post.preview.versions.map((v) => (
                <Link key={v.language} href={v.path} hrefLang={v.language}
                  aria-current={v.language === post.preview.language ? 'page' : undefined}
                  className={`rounded-full px-2.5 py-0.5 border ${v.language === post.preview.language ? 'bg-amber-900 text-white border-amber-900' : 'border-amber-400 hover:bg-amber-200'}`}>
                  {langName(v.language)}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
      <PostDetailContent post={post} relatedPosts={relatedPosts} />
    </>
  );
}
