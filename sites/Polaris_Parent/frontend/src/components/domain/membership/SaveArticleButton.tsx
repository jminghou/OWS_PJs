'use client';

/**
 * 收藏文章按鈕。
 *
 * 為什麼在 domain/ 而不是 platform/：它打的是 membershipApi
 * （/api/v1/membership/saved-articles），那是 Polaris 的 membership 擴充，
 * 不是 core 契約。第三個站台沒有這個擴充就沒有這個端點。
 *
 * 「收藏文章」本身是通用的內容平台能力，等 saved-articles 從站台擴充搬進 core
 * （見 core/backend_engine 的 P5 規劃），這個元件就能升格回 platform/。
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { membershipApi } from '@/lib/api';
import { Bookmark } from 'lucide-react';
import { brandButton } from '@/components/ui/BrandButton';

// 已收藏狀態不用漸層：與 BrandButton S 同尺寸的膠囊，底色走「選中」的 blue-50
const SAVED_BASE =
  'relative inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 px-4 text-[14px] font-bold ' +
  'transition-[filter,box-shadow,background-color] duration-150 ease-out hover:shadow-md ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:shadow-none ' +
  "before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] md:before:hidden";

/**
 * 文章收藏按鈕（會員功能）。
 * 未登入 → 點擊導向登入頁；已登入 → 切換收藏／取消收藏（blog.saved_articles）。
 */
export default function SaveArticleButton({ contentId }: { contentId: number }) {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    (async () => {
      try {
        const r = await membershipApi.savedArticles();
        if (active) setSaved((r.articles || []).some((a) => a.content_id === contentId));
      } catch {
        /* 忽略：載入收藏狀態失敗不影響閱讀 */
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, contentId]);

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setBusy(true);
    try {
      if (saved) {
        await membershipApi.unsaveArticle(contentId);
        setSaved(false);
      } else {
        await membershipApi.saveArticle(contentId);
        setSaved(true);
      }
    } catch {
      /* 忽略：暫時性錯誤 */
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className={
        saved
          ? // 已收藏：選中狀態（blue-50 底），hover 稍深
            `${SAVED_BASE} bg-blue-50 text-blue-800 hover:bg-blue-100 active:brightness-90 disabled:bg-line disabled:text-muted`
          : brandButton({ variant: 'soft', size: 'S' })
      }
    >
      <Bookmark className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} strokeWidth={2} aria-hidden="true" />
      {saved ? '已收藏' : '收藏文章'}
    </button>
  );
}
