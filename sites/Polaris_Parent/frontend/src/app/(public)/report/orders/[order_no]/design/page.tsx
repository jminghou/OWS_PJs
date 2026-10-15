'use client';

/**
 * 付款後設計／最後確認實體書內容：訂單裡那本實體書的「設計你的書」。
 * 付款前在加購頁設計過的，這裡會帶出原本的內容，只要檢查後按「確認內容，開始製作打樣」。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import BrandButton from '@/components/ui/BrandButton';
import BookDesigner from '@/components/report/design/BookDesigner';
import { useAuthStore } from '@/store/auth';
import { reportOrdersApi, type DesignView, type PhysicalConfig } from '@/lib/api/reportOrders';

export default function OrderDesignPage() {
  const router = useRouter();
  const { order_no: orderNo } = useParams<{ order_no: string }>();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [design, setDesign] = useState<DesignView | null>(null);
  const [cfg, setCfg] = useState<PhysicalConfig | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { checkAuth().finally(() => setChecked(true)); }, [checkAuth]);

  useEffect(() => {
    if (!checked) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(`/report/orders/${orderNo}/design`)}`);
      return;
    }
    reportOrdersApi.orderDesign(orderNo).then((r) => setDesign(r.design)).catch((e) => setError(e.message || '無法載入設計'));
    reportOrdersApi.physicalConfig().then((r) => setCfg(r.config)).catch(() => setCfg(null));
  }, [checked, isAuthenticated, orderNo, router]);

  const back = (
    <Link href={`/report/orders/${orderNo}`} className="inline-flex min-h-[44px] items-center gap-1 text-sm text-blue-500 hover:underline">
      <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> 回到訂單
    </Link>
  );

  if (error && !design) {
    return <div className="mx-auto max-w-xl px-4 py-16">{back}<Alert tone="error" className="mt-4">{error}</Alert></div>;
  }
  if (!design) return null;

  const purchased = design.purchased ?? { custom: [], spreads: 0 };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await reportOrdersApi.confirmDesign(design.id);
      setDesign(r.design);
      setConfirming(false);
      router.push(`/report/orders/${orderNo}`);
    } catch (e: any) {
      setError(e.errors?.design || e.message || '確認失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-8 md:px-6 md:pt-12">
      {back}
      <h1 className="mt-2 font-heading text-[28px] font-normal text-ink md:text-h1">設計你的書</h1>
      <p className="mt-2 text-text">
        這是你的報告印成書的樣子。翻到封面和扉頁可以直接填寫；看到想調整的地方，就在那一頁提出修改。內容會自動儲存。
      </p>

      <div className="mt-6">
        <BookDesigner design={design} onDesignChange={setDesign} cfg={cfg} purchased={purchased} />
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      {design.editable && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            {confirming ? (
              <>
                <p className="min-w-0 flex-1 text-sm text-text">確認後內容就會鎖定，開始製作打樣；之後想修改請在確認打樣時提出。</p>
                <div className="flex gap-2">
                  <BrandButton variant="soft" size="S" onClick={() => setConfirming(false)}>再看看</BrandButton>
                  <BrandButton variant="primary" size="S" onClick={confirm} disabled={busy}>{busy ? '處理中…' : '確定送出'}</BrandButton>
                </div>
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-sm text-text">
                  {design.confirmable
                    ? design.problems.length ? `還有 ${design.problems.length} 個項目沒完成` : '內容都完成了，可以送出開始製作打樣。'
                    : '內容會自動儲存；付款確認後就能送出。'}
                </p>
                <BrandButton variant="primary" onClick={() => setConfirming(true)} disabled={!design.confirmable || design.problems.length > 0}>
                  確認內容，開始製作打樣
                </BrandButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
