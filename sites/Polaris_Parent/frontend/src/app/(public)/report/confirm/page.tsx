'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/platform/ui/Button';
import ReportDraftSummary from '@/components/report/ReportDraftSummary';
import { useAuthStore } from '@/store/auth';
import { hasErrors, loadDraft, validateDraft, type ReportDraft } from '@/lib/report/draft';

const CHECKOUT = '/report/checkout';

export default function ReportConfirmPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    // 草稿不完整（例如直接打開本頁）→ 回到表單
    if (d && hasErrors(validateDraft(d))) {
      router.replace('/report/customize');
      return;
    }
    setDraft(d);
    setLoaded(true);
  }, [router]);

  if (!loaded) return null;

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900">找不到填寫中的資料</h1>
        <p className="mt-2 text-sm text-gray-600">填寫內容只保存在填寫時使用的裝置與瀏覽器，超過 7 天會自動清除。</p>
        <Link href="/report" className="mt-6 inline-block text-brand-purple-700 hover:underline">
          回到客製報告
        </Link>
      </div>
    );
  }

  const proceed = () =>
    router.push(isAuthenticated ? CHECKOUT : `/login?next=${encodeURIComponent(CHECKOUT)}`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">確認報告資料</h1>
      <p className="mt-2 text-sm text-gray-600">確認無誤後，登入會員即可前往結帳。</p>

      <div className="mt-8">
        <ReportDraftSummary draft={draft} />
      </div>

      <p className="mt-6 rounded-banner bg-white p-4 text-sm leading-6 text-gray-600">
        本報告依你提供的出生資料個別製作，屬客製化商品，不適用七日解除權；付款後不受理取消或退款。
        結帳前會再請你確認一次。
      </p>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link href="/report/customize" className="text-center text-sm text-brand-purple-700 hover:underline sm:text-left">
          ← 修改資料
        </Link>
        <Button onClick={proceed} className="bg-brand-purple-600 hover:bg-brand-purple-700 sm:min-w-[12rem]">
          {isAuthenticated ? '前往結帳' : '登入並前往結帳'}
        </Button>
      </div>
    </div>
  );
}
