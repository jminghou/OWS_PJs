'use client';
import { useState } from 'react';
import { useAuthStore } from '@ows/platform-api';
import { reportOrdersApi, type FulfilmentControl } from '@/lib/api/reportOrders';

export default function FulfilmentControlPanel({ orderNo, control, done }: {
  orderNo: string; control?: FulfilmentControl; done: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canControl = useAuthStore(s => s.user?.permissions?.includes('report_orders.fulfill') ?? false);
  const c = control ?? { revision: 0, desired: 'active', sync: 'synced', blocked: false, reason: null };
  async function change() {
    setBusy(true); setError('');
    try {
      await reportOrdersApi.adminFulfilmentControl(orderNo, {
        desired: c.desired === 'paused' ? 'active' : 'paused', reason, revision: c.revision,
      });
      setReason(''); done();
    } catch (e) { setError(e instanceof Error ? e.message : '操作失敗'); }
    finally { setBusy(false); }
  }
  async function retry() {
    setBusy(true); setError('');
    try { await reportOrdersApi.adminRetryFulfilmentControl(orderNo, c.revision); done(); }
    catch (e) { setError(e instanceof Error ? e.message : '操作失敗'); }
    finally { setBusy(false); }
  }
  return <section aria-label="履約控制" className="mt-3 space-y-2 rounded border border-border p-3 text-sm">
    <p>{c.blocked ? '後續履約暫停' : '履約可進行'} · {c.sync === 'attention' ? '需人工處理' : c.sync === 'pending' ? '待同步' : '已同步'}</p>
    {c.reason && <p>處理原因：{c.reason}</p>}
    {c.error && <p role="alert">{c.error}</p>}
    {canControl && c.sync !== 'synced' && <button type="button" disabled={busy} onClick={retry}
      className="rounded border border-border px-3 py-2">重新排入同步</button>}
    <p className="text-xs text-muted-foreground">作用於本張訂單。恢復須通過資格檢查並等待製作端確認；已送印或出貨的工作需另行聯絡處理。</p>
    {canControl && <><label className="block">操作原因<textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)}
      className="block w-full rounded border border-border bg-background p-2" /></label>
    <button type="button" className="rounded border border-border px-3 py-2" disabled={busy || !reason.trim()} onClick={change}>
      {busy ? '處理中…' : c.desired === 'paused' ? '申請恢復履約' : '暫停履約'}
    </button></>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
