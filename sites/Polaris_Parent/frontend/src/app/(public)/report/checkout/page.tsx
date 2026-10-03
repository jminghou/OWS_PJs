'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReportDraftSummary from '@/components/report/ReportDraftSummary';
import { useAuthStore } from '@/store/auth';
import { loadDraft, type ReportDraft } from '@/lib/report/draft';

/**
 * 結帳頁（佔位）。下一階段在這裡加上：Email 驗證檢查、實體書收件資料、
 * 交易政策同意、建立訂單（POST，帶 submission_key）與付款佔位。
 */
export default function ReportCheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [draft, setDraft] = useState<ReportDraft | null>(null);

  useEffect(() => {
    checkAuth().finally(() => setChecked(true));
    setDraft(loadDraft());
  }, [checkAuth]);

  useEffect(() => {
    if (checked && !isAuthenticated) router.replace(`/login?next=${encodeURIComponent('/report/checkout')}`);
  }, [checked, isAuthenticated, router]);

  if (!checked || !isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">結帳</h1>
      <div className="mt-6 rounded-banner border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        結帳功能建置中，目前尚無法送出訂單。
      </div>
      {draft ? (
        <div className="mt-8">
          <ReportDraftSummary draft={draft} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-gray-600">
          找不到填寫中的資料。<Link href="/report" className="text-brand-purple-700 hover:underline">回到客製報告</Link>
        </p>
      )}
    </div>
  );
}
