'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import BrandButton from '@/components/ui/BrandButton';
import StepFields from './StepFields';
import { REPORT_PRODUCT, productHref } from '@/lib/report/catalog';
import { emptyDraft, hasErrors, loadDraft, saveDraft, tidyDraft, type DraftErrors, type ReportDraft } from '@/lib/report/draft';
import { PREVIEW_HREF, firstIncompleteStep, isStepSlug, stepErrors, stepHref, visibleSteps } from '@/lib/report/steps';

/**
 * 客製報告填寫精靈：一題一頁，每次修改都自動存進草稿。
 * 直接打開後面的步驟時，若前面還沒填好就導回第一個未完成的步驟。
 * `?return=preview`：從預覽頁按「修改」進來，改完資料齊全就直接回預覽頁。
 */
export default function ReportWizard({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') === 'preview' ? 'preview' : undefined;
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [timeUnknown, setTimeUnknown] = useState(false);

  useEffect(() => {
    const d = loadDraft() ?? emptyDraft();
    const steps = visibleSteps(d);
    const current = isStepSlug(slug) ? steps.find((s) => s.slug === slug) : undefined;
    const pending = firstIncompleteStep(d);
    if (!current) {
      router.replace(stepHref((pending ?? steps[0]).slug, returnTo));
      return;
    }
    if (pending && steps.indexOf(pending) < steps.indexOf(current)) {
      router.replace(stepHref(pending.slug, returnTo));
      return;
    }
    setDraft(d);
    setErrors({});
    setTimeUnknown(false);
  }, [slug, returnTo, router]);

  if (!draft) return null;

  const steps = visibleSteps(draft);
  const index = steps.findIndex((s) => s.slug === slug);
  const step = steps[index];
  // 例如在出生時間改回一般時間後，出生地這一步就不存在；等上方 effect 處理
  if (!step) return null;
  const isLast = index === steps.length - 1;

  const change = (next: ReportDraft) => {
    setDraft(next);
    setErrors({});
    saveDraft(next);
  };

  const goNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (timeUnknown) return;
    const found = stepErrors(step, draft);
    if (hasErrors(found)) {
      setErrors(found);
      requestAnimationFrame(() => document.querySelector('[data-field-error]')?.scrollIntoView({ block: 'center' }));
      return;
    }
    const tidy = tidyDraft(draft);
    saveDraft(tidy);
    const nextSteps = visibleSteps(tidy);
    const next = nextSteps[nextSteps.findIndex((s) => s.slug === step.slug) + 1];
    if (!next || (returnTo && !firstIncompleteStep(tidy))) router.push(PREVIEW_HREF);
    else router.push(stepHref(next.slug, returnTo));
  };

  const goBack = () => {
    if (index > 0) router.push(stepHref(steps[index - 1].slug, returnTo));
    else router.push(returnTo ? PREVIEW_HREF : productHref(REPORT_PRODUCT));
  };

  const progress = Math.round(((index + 1) / steps.length) * 100);

  return (
    <div className="mx-auto max-w-xl px-4 py-12 md:px-6 md:py-16">
      <div className="flex items-center justify-between gap-4 text-caption text-muted">
        <span className="whitespace-nowrap">
          第 <span className="font-latin font-semibold text-blue-500">{index + 1}</span> / <span className="font-latin">{steps.length}</span> 步
        </span>
        <span className="text-right">資料會自動保存在這台裝置 7 天</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar"
           aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={steps.length}>
        <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
      </div>

      <form onSubmit={goNext} noValidate className="mt-10">
        <h1 className="font-heading text-[26px] font-normal text-ink md:text-h2">{step.title}</h1>
        {step.hint && <p className="mt-2 text-text">{step.hint}</p>}

        <div className="mt-8">
          <StepFields
            slug={step.slug}
            draft={draft}
            onChange={change}
            errors={errors}
            timeUnknown={timeUnknown}
            onTimeUnknownChange={setTimeUnknown}
          />
        </div>

        <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BrandButton type="button" onClick={goBack} variant="soft" className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {index > 0 ? '上一步' : returnTo ? '回到預覽' : '返回商品介紹'}
          </BrandButton>
          <BrandButton type="submit" disabled={timeUnknown} variant="primary" className="w-full sm:w-auto sm:min-w-[12rem]">
            {isLast ? '看看我的報告' : '下一步'}
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </BrandButton>
        </div>
      </form>
    </div>
  );
}
