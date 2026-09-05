'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { membershipApi } from '@/lib/api';

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
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors disabled:opacity-60 ${
        saved
          ? 'bg-brand-purple-600 text-white border-brand-purple-600 hover:bg-brand-purple-700'
          : 'bg-white text-brand-purple-700 border-brand-purple-300 hover:bg-brand-purple-50'
      }`}
    >
      <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
      {saved ? '已收藏' : '收藏文章'}
    </button>
  );
}
