'use client';

import { useState } from 'react';
import { request } from '@ows/platform-api/client';

type Plan = { review_token: string; apply_enabled: boolean; order_no: string; member_id: number; item_no: string;
  profile: { unit_amount: number; currency: string; product_code: string };
  channel: { channel: string; store_key: string; revision: number; policy_reference: string };
  mapping: { external_sku: string; revision: number; policy_reference: string; review_note: string } };
const button = 'rounded border border-border px-3 py-2 text-sm disabled:opacity-50';

export default function ExternalContractBinding({ receiptId, done }: { receiptId: number; done: () => void }) {
  const [orderNo, setOrderNo] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return <div className="space-y-3 border-t border-border pt-3">
    <h4 className="font-medium">對應官網數位報告契約</h4>
    <p className="text-xs text-muted-foreground">限同一會員已填妥資料、尚未付款的單份數位報告。請核對報告客製對象與平台成交內容一致；金額、權利或商品不符時不能強制套用。</p>
    <label className="block text-sm">官網訂單編號<input value={orderNo} maxLength={100} disabled={busy}
      onChange={e => { setOrderNo(e.target.value); setPlan(null); setConfirmed(false); }} className="block w-full rounded border border-border bg-card p-2" /></label>
    <button className={button} disabled={busy || !orderNo.trim()} onClick={async () => {
      setBusy(true); setError(''); setPlan(null); setConfirmed(false);
      try { setPlan((await request<{ review: Plan }>(`/admin/commerce-receipts/${receiptId}/contract-preview`,
        { method: 'POST', body: JSON.stringify({ order_no: orderNo.trim() }) })).review); }
      catch (err) { setError(err instanceof Error ? err.message : '無法預覽'); }
      finally { setBusy(false); }
    }}>預覽資格發放計畫</button>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {plan && <>
      <p className="text-sm">{plan.order_no}・會員 #{plan.member_id}・品項 {plan.item_no}</p>
      <p className="text-sm">{plan.mapping.external_sku} → {plan.profile.product_code}・{plan.profile.currency} {plan.profile.unit_amount.toLocaleString()}・數位報告製作資格 × 1</p>
      <p className="text-xs">渠道版本 {plan.channel.revision}／商品對應版本 {plan.mapping.revision}・履約審查依據：{plan.mapping.policy_reference}・{plan.mapping.review_note}</p>
      <p className="text-xs text-muted-foreground">套用後會確認平台成交、發放資格並建立報告待交接工作。不得再次向會員收款；尚不會送出外部派工或通知。審查預覽有效 30 分鐘。</p>
      {!plan.apply_enabled ? <p>發放功能尚未開啟，目前僅可預覽。</p> : <>
        <label className="block text-sm">核對備註<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} className="block w-full rounded border border-border bg-card p-2" /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />已核對平台商品、會員歸屬、報告客製對象及官網履約政策，確認發放一份資格。</label>
        <button className={button} disabled={busy || !confirmed || !note.trim()} onClick={async () => {
          setBusy(true); setError('');
          try { await request(`/admin/commerce-receipts/${receiptId}/contract`, { method: 'POST',
            body: JSON.stringify({ review_token: plan.review_token, note, confirmed }) }); setPlan(null); done(); }
          catch (err) { setError(err instanceof Error ? err.message : '套用失敗'); setPlan(null); setConfirmed(false); }
          finally { setBusy(false); }
        }}>確認發放資格</button>
      </>}
    </>}
  </div>;
}
