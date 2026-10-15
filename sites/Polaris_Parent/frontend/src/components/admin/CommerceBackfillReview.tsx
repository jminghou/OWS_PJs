'use client';

import { useState } from 'react';
import { reportOrdersApi, type CommerceBackfillReview as Review } from '@/lib/api/reportOrders';

const status: Record<string, string> = { available: '可使用', in_use: '使用中', completed: '已完成', revoked: '已撤銷' };
const kinds: Record<string, string> = { report: '報告製作', book: '書籍客製', consult: '專人解讀' };
const button = 'rounded border border-border px-3 py-1.5 text-xs disabled:opacity-50';

export default function CommerceBackfillReview({ orderNo, onApplied }: { orderNo: string; onApplied: () => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const preview = async () => {
    setBusy(true); setError(''); setConfirmed(false); setReview(null);
    try { setReview((await reportOrdersApi.reviewBackfill(orderNo)).review); }
    catch (err: any) { setError(err.message || '無法產生回填預覽'); }
    finally { setBusy(false); }
  };

  return <div className="my-3 space-y-3 rounded border border-border p-3">
    <p className="font-medium">歷史交易資格回填</p>
    <p className="text-xs text-muted-foreground">先核對舊付款與工作進度。回填會保留已完成、已取消的狀態，不會再次核款、寄信或派工。</p>
    <button type="button" className={button} disabled={busy} onClick={preview}>{busy ? '處理中…' : '產生／重新整理審查預覽'}</button>
    {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    {review && <>
      <p>{{ review_required: '請審查以下轉換計畫', blocked: '資料需先釐清，不能套用',
        skip_unpaid: '未付款，不發放資格', already_tracked: '已建立交易契約，無須回填' }[review.decision]}</p>
      {review.reasons.map((reason) => <p key={reason.code} className="text-xs text-muted-foreground">{reason.message}</p>)}
      {review.decision === 'review_required' && <>
        <p className="text-xs">會員 #{review.owner_id}・成功付款紀錄 #{review.payment_attempt_id}・{review.currency} {review.amount?.toLocaleString('zh-TW')}</p>
        <div className="space-y-3">
          {review.lines.map((line) => <div key={line.item_no} className="border-t border-border pt-2 text-xs">
            <p className="font-medium">{line.name}（{line.item_no}）</p>
            <p>原單價 {line.original_unit_amount.toLocaleString('zh-TW')}／原數量 {line.original_quantity}
              → 計價單位 {line.unit_amount.toLocaleString('zh-TW')} × {line.quantity}，小計 {line.line_total.toLocaleString('zh-TW')}
              {line.print_copies > 0 && `，印刷 ${line.print_copies} 本`}</p>
            <p className="text-muted-foreground">{line.components.map((part) => `${part.label} ${part.amount.toLocaleString('zh-TW')}`).join(' ＋ ')}</p>
            {line.grants.map((grant) => <p key={grant.kind}>
              {kinds[grant.kind] ?? grant.kind} × {grant.units} → {status[grant.status] ?? grant.status}
              {grant.status !== 'available' && `，關聯既有工作 #${grant.target_id}`}
            </p>)}
          </div>)}
        </div>
        {!review.apply_enabled ? <p className="text-xs text-muted-foreground">目前僅開放預覽，尚未啟用正式回填操作。</p> : <div className="space-y-2 border-t border-border pt-3">
          <label className="block text-xs">審查備註（對帳依據或處理紀錄編號；不要填出生資料或完整銀行帳號）
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
              className="mt-1 block w-full rounded border border-border bg-card p-2 text-sm" />
          </label>
          <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)} />我已核對付款、會員歸屬及履約狀態，確認套用此計畫。</label>
          <p className="text-xs text-muted-foreground">審查憑證有效 30 分鐘；資料變更後必須重新預覽。套用後保留稽核紀錄，不能直接刪除資格回退。</p>
          <button type="button" className={button} disabled={busy || !confirmed || !note.trim() || !review.review_token}
            onClick={async () => {
              setBusy(true); setError('');
              try {
                await reportOrdersApi.applyBackfill(orderNo, review.review_token!, note.trim(), confirmed);
                setReview(null); setNote(''); onApplied();
              } catch (err: any) {
                setError(err.message || '回填失敗，請重新預覽'); setReview(null); setConfirmed(false);
              } finally { setBusy(false); }
            }}>確認套用歷史轉換</button>
        </div>}
      </>}
    </>}
  </div>;
}
