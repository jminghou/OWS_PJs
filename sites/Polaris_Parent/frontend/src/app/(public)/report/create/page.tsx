'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandButton from '@/components/ui/BrandButton';
import { emptyDraft, loadDraft, saveDraft, type ReportDraft } from '@/lib/report/draft';
import { PREVIEW_HREF, REPORT_STEPS, firstIncompleteStep, stepHref } from '@/lib/report/steps';

/**
 * 精靈入口。沒有草稿 → 直接從第一題開始；
 * 這台裝置留有先前填寫的草稿 → 先問要接續還是重新開始（不默默帶入舊資料）。
 * `?variant=digital|physical`（舊網址相容）會預選版本，預覽頁仍可更改。
 */
function Start() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saved, setSaved] = useState<ReportDraft | null>(null);

  const v = searchParams.get('variant');
  const presetVariant = v === 'digital' || v === 'physical' ? v : null;

  const startFresh = () => {
    saveDraft(emptyDraft(presetVariant ?? 'digital'));
    router.replace(stepHref(REPORT_STEPS[0].slug));
  };

  useEffect(() => {
    const d = loadDraft();
    if (d && d.subject_name.trim()) setSaved(d);
    else startFresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!saved) return null;

  const resume = () => {
    const draft: ReportDraft = presetVariant ? { ...saved, variant: presetVariant } : saved;
    saveDraft(draft);
    const pending = firstIncompleteStep(draft);
    router.push(pending ? stepHref(pending.slug) : PREVIEW_HREF);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16 md:px-6 md:py-24">
      <h1 className="font-heading text-[26px] font-normal text-ink md:text-h2">要接續上次填寫的資料嗎？</h1>
      <p className="mt-3 text-text">
        這台裝置還保存著一份尚未下單的報告資料（主角：{saved.subject_name}）。填寫內容會在這台裝置保留 <span className="font-latin">7</span> 天。
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <BrandButton onClick={resume} variant="primary" className="sm:min-w-[12rem]">
          接續填寫
        </BrandButton>
        <BrandButton onClick={startFresh} variant="soft">
          重新開始（清除舊資料）
        </BrandButton>
      </div>
    </div>
  );
}

export default function ReportCreatePage() {
  return (
    <Suspense fallback={null}>
      <Start />
    </Suspense>
  );
}
