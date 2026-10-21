'use client';

/**
 * 客人檔案的認領碼：發碼（明碼只顯示這一次）、複製給客人的訊息、作廢；認領後顯示由哪個會員認領、
 * 紫微那邊（命盤歸屬、工作單）有沒有同步。後端：/api/v1/admin/external-customers/:id/claim-code（report_orders/claims.py）。
 */
import { useState } from 'react';
import { Copy } from 'lucide-react';
import { reportOrdersApi, type ExternalCustomer } from '@/lib/api/reportOrders';

const btnPrimary =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-admin-accent-600 text-white hover:bg-admin-accent-700';
const btnGhost =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50';
const cardCls = 'rounded-xl border border-border bg-card p-4 text-card-foreground';
const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('zh-TW') : '—');

export default function ClaimSection({ customer, onChange, onError }: {
  customer: ExternalCustomer;
  onChange: (c: ExternalCustomer) => void;
  onError: (message: string) => void;
}) {
  const claim = customer.claim;
  const [days, setDays] = useState(90);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  if (!claim) return null;
  const site = typeof window !== 'undefined' ? window.location.origin : '';
  const message = code
    ? `謝謝你的訂購！你也可以在「親紫之間」網站追蹤這份報告的進度與打樣：到 ${site}/account/claim 註冊（或登入）後，`
      + `輸入認領碼 ${code}（${fmtDate(new Date(Date.now() + days * 86400000).toISOString())} 前有效，只能使用一次）。`
    : '';

  const issue = async () => {
    if (claim.has_code && !window.confirm('重新發碼後，舊的認領碼會立刻失效。確定要重發？')) return;
    setBusy(true);
    onError('');
    try {
      const r = await reportOrdersApi.issueClaimCode(customer.id, days);
      setCode(r.code);
      onChange(r.customer);
    } catch (e: any) {
      onError(e.message || '發碼失敗');
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    if (!window.confirm('作廢後客人就不能用這組認領碼了。確定作廢？')) return;
    setBusy(true);
    try {
      const r = await reportOrdersApi.revokeClaimCode(customer.id);
      setCode(null);
      onChange(r.customer);
    } catch (e: any) {
      onError(e.message || '作廢失敗');
    } finally {
      setBusy(false);
    }
  };
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      onError('無法複製，請手動選取');
    }
  };

  return (
    <section className={cardCls}>
      <h2 className="mb-1 text-sm font-semibold">認領碼</h2>
      <p className="mb-3 text-xs text-muted">
        客人到官網註冊、驗證 Email 後輸入認領碼，這份檔案的訂單與命盤就會轉到他的會員帳號。認領碼只存雜湊，發出後只顯示這一次。
      </p>

      {claim.claimed ? (
        <div className="space-y-1 text-sm">
          <p>已由會員 <span className="font-medium">{claim.claimed_by_email ?? '—'}</span> 於 {fmt(claim.claimed_at)} 認領。</p>
          {claim.ziwei_synced ? (
            <p className="text-muted">紫微系統的命盤歸屬與工作單已一併轉過去。</p>
          ) : (
            <p className="text-amber-700 dark:text-amber-300">
              紫微系統的命盤歸屬與工作單尚未同步，系統會自動重試{claim.ziwei_error ? `（上次錯誤：${claim.ziwei_error}）` : ''}。
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            {claim.has_code ? `目前有一組有效的認領碼：${fmt(claim.issued_at)} 發出，${fmtDate(claim.expires_at)} 到期。`
              : claim.expired ? `上一組認領碼已在 ${fmtDate(claim.expires_at)} 過期。` : '還沒有發過認領碼。'}
          </p>
          {code && (
            <div className="space-y-2 rounded-md border border-admin-accent-500 bg-admin-accent-50 p-3 dark:bg-admin-accent-800/30">
              <p className="text-xs text-muted">新的認領碼（關掉這頁後就看不到了）：</p>
              <p className="font-mono text-xl font-semibold tracking-widest">{code}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnGhost} onClick={() => copy(code, 'code')}>
                  <Copy className="h-4 w-4" />{copied === 'code' ? '已複製' : '複製認領碼'}
                </button>
                <button type="button" className={btnGhost} onClick={() => copy(message, 'message')}>
                  <Copy className="h-4 w-4" />{copied === 'message' ? '已複製' : '複製給客人的訊息'}
                </button>
              </div>
              <p className="whitespace-pre-line text-xs text-muted">{message}</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                訊息含官網網址：請先確認該平台的規定允許在對話中提供站外連結；不允許時只傳認領碼。
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-muted">
              有效
              <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 90)}
                className="w-16 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground" />
              天
            </label>
            <button type="button" className={btnPrimary} disabled={busy} onClick={issue}>
              {claim.has_code ? '重新發碼' : '發認領碼'}
            </button>
            {claim.has_code && <button type="button" className={btnGhost} disabled={busy} onClick={revoke}>作廢</button>}
          </div>
        </div>
      )}
    </section>
  );
}
