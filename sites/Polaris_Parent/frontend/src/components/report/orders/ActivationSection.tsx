'use client';

import { useState } from 'react';
import { reportOrdersApi, type ReportOrderSummary } from '@/lib/api';
import Alert from '@/components/ui/Alert';
import BrandButton from '@/components/ui/BrandButton';

export default function ActivationSection({ order, onUpdated }: {
  order: ReportOrderSummary; onUpdated: (order: ReportOrderSummary) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = order.commerce?.entitlements.filter((e) =>
    e.status !== 'revoked' && e.activation && e.activation.status !== 'redeemed') ?? [];
  if (order.status !== 'paid' || pending.length === 0) return null;
  const canRedeem = order.commerce?.activation_enabled && pending.some((e) => e.activation?.status === 'issued');

  return (
    <section className="mt-6 rounded-card bg-white p-6 md:p-8">
      <h2 className="font-heading text-[18px] text-ink">啟用已購買的服務</h2>
      <p className="mt-2 text-sm text-muted">請使用客服提供給此帳號的啟用碼。完成後即可使用對應服務，不需再次付款。</p>
      <ul className="my-3 space-y-1 text-sm text-ink">
        {pending.map((e) => <li key={e.id}>
          {e.kind === 'book' ? '書籍客製' : e.kind === 'consult' ? '專人解讀' : '報告製作'} #{e.unit_index}：
          {e.activation?.status === 'issued' ? `請於 ${new Date(e.activation.expires_at).toLocaleString('zh-TW')} 前啟用`
            : '啟用碼已到期或撤銷，請聯絡客服補發'}
        </li>)}
      </ul>
      {error && <Alert tone="error">{error}</Alert>}
      {canRedeem ? <form className="mt-3 space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true); setError('');
        try {
          const result = await reportOrdersApi.redeemActivation(code, order.order_no);
          setCode(''); onUpdated(result.order);
        } catch (err: any) {
          setError(err.message || '啟用失敗，請稍後再試');
        } finally { setBusy(false); }
      }}>
        <label htmlFor="activation-code" className="block text-sm font-medium text-ink">啟用碼</label>
        <input id="activation-code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={80}
          autoComplete="off" spellCheck={false} autoCapitalize="characters"
          className="w-full rounded-2xl border border-line-strong bg-white px-4 py-3 font-mono text-ink"
          placeholder="PP-…" />
        <BrandButton type="submit" disabled={busy || !code.trim()}>{busy ? '啟用中…' : '啟用服務'}</BrandButton>
      </form> : !order.commerce?.activation_enabled && <p className="text-sm text-muted">啟用碼服務暫停，請稍後再試或聯絡客服。</p>}
    </section>
  );
}
