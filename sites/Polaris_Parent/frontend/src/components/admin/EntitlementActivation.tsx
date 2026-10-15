'use client';

import { useState } from 'react';
import { reportOrdersApi, type CommerceSummary } from '@/lib/api';

export type IssuedActivation = { code: string; recipient_id: number; expires_at: string };

export default function EntitlementActivation({ entitlement, enabled, canManage, onIssued, onChanged, onError }: {
  entitlement: CommerceSummary['entitlements'][number]; enabled: boolean; canManage: boolean;
  onIssued: (result: IssuedActivation) => void; onChanged: () => void; onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(14);
  const activation = entitlement.activation;
  const available = entitlement.status === 'available' && !entitlement.task;
  const canIssue = available && enabled && (!activation || ['expired', 'revoked'].includes(activation.status));
  const canRevoke = activation && ['issued', 'expired'].includes(activation.status);
  return <div className="mt-2 space-y-2 text-xs">
    {activation && <p>啟用碼：{{ issued: '待會員啟用', expired: '已到期', redeemed: '已啟用', revoked: '已撤銷' }[activation.status]}
      ・到期 {new Date(activation.expires_at).toLocaleString('zh-TW')}</p>}
    {canManage && canIssue && <div className="flex flex-wrap items-center gap-2">
      <label>有效天數 <input type="number" min={1} max={90} value={days}
        onChange={(e) => setDays(Number(e.target.value))} className="w-16 rounded border border-border bg-card px-2 py-1" /></label>
      <button type="button" disabled={busy || !Number.isInteger(days) || days < 1 || days > 90}
        className="rounded border border-border px-2 py-1 disabled:opacity-50" onClick={async () => {
          if (!window.confirm('發碼後，這項資格須由購買會員兌換才能使用。明碼只顯示一次，請妥善交付給指定會員。確定發放？')) return;
          setBusy(true);
          try { onIssued(await reportOrdersApi.issueActivation(entitlement.id, days)); }
          catch (err: any) { onError(err.message || '發放失敗'); }
          finally { setBusy(false); }
        }}>發放啟用碼</button>
    </div>}
    {canManage && canRevoke && <div className="flex flex-wrap gap-2">
      <input aria-label="啟用碼撤銷原因" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)}
        placeholder="撤銷原因（例如遺失補發）" className="rounded border border-border bg-card px-2 py-1" />
      <button type="button" disabled={busy || !reason.trim()} className="rounded border border-border px-2 py-1 disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          try { await reportOrdersApi.revokeActivation(activation.id, reason); setReason(''); onChanged(); }
          catch (err: any) { onError(err.message || '撤銷失敗'); }
          finally { setBusy(false); }
        }}>撤銷此碼</button>
    </div>}
  </div>;
}
