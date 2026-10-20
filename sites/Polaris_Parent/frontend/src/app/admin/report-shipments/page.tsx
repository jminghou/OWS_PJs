'use client';

/**
 * 實體書出貨管理：下單選實體書版與事後加購的實體書都在這裡，依狀態分頁。
 * 上傳打樣 → 會員確認（或期限到自動確認、代為確認）→ 送印 → 登錄物流（寄出貨通知）→ 送達；
 * 確認送印前可取消，已付款的取消後在這裡登錄退款。
 * 後端：/api/v1/admin/report-print-jobs（report_orders.fulfill）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminEmptyState, AdminLoadingSkeleton } from '@ows/ui/admin';
import { Copy, Truck } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { privateFileUrl, reportOrdersApi, type AdminPrintJob, type DesignView, type PrintJobAction } from '@/lib/api/reportOrders';

type Filter = 'all' | 'awaiting_payment' | 'awaiting_customization' | 'awaiting_proof' | 'proof_ready' | 'changes_requested'
  | 'approved' | 'printing' | 'shipped' | 'delivered' | 'cancelled' | 'refund_pending';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'awaiting_customization', label: '待設計內容' },
  { value: 'awaiting_proof', label: '待出打樣' },
  { value: 'proof_ready', label: '待會員確認' },
  { value: 'changes_requested', label: '待修改' },
  { value: 'approved', label: '待送印' },
  { value: 'printing', label: '印製中' },
  { value: 'shipped', label: '已出貨' },
  { value: 'delivered', label: '已送達' },
  { value: 'refund_pending', label: '待退款' },
  { value: 'cancelled', label: '已取消' },
  { value: 'awaiting_payment', label: '待付款' },
  { value: 'all', label: '全部' },
];

const btn =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-admin-accent-600 text-white hover:bg-admin-accent-700`;
const btnGhost = `${btn} border border-border bg-card text-foreground hover:bg-muted`;
const btnDanger = `${btn} text-destructive hover:bg-destructive/10`;
const inputCls =
  'w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500';

const nt = (n: number | null | undefined, currency?: string) => formatMoney(n, currency);
const formatDate = (v: string | null | undefined) =>
  v ? new Date(`${v.replace(/Z$|\+00:00$/, '')}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** 給排版／印刷用的文字摘要 */
function summaryText(j: AdminPrintJob) {
  return [
    `訂單：${j.order_no}${j.parent_order_no ? `（原報告 ${j.parent_order_no}）` : ''}`,
    `報告主角：${j.subject_name ?? ''}（稱呼：${j.call_name ?? ''}）`,
    `規格：${j.spec_label || '—'}・數量：${j.quantity} 本`,
    j.custom_labels.length ? `特殊客製：${j.custom_labels.join('、')}` : '',
    j.options?.cover_name ? `封面名字：${j.options.cover_name}` : '',
    j.options?.cover_style ? `封面款式：${j.options.cover_style}` : '',
    j.dedication ? `扉頁贈言：${j.dedication}` : '',
    j.shipping ? `收件：${j.shipping.recipient_name}・${j.shipping.recipient_phone}・${j.shipping.postal_code ?? ''} ${j.shipping.address}` : '',
  ].filter(Boolean).join('\n');
}

const DESIGN_STATUS: Record<DesignView['status'], string> = { draft: '草稿', submitted: '會員設計中', confirmed: '會員已確認內容' };
const ANNOTATION_LABEL = { text: '改寫文字', image: '換成指定圖片', fix: '回報錯誤' } as const;

/** 會員在「設計你的書」填的內容：封面、扉頁、跨頁與每頁的修改標註（照片以短效連結開啟） */
function DesignPanel({ design }: { design: DesignView }) {
  const d = design.data;
  const asset = (id: number | null) => design.assets.find((a) => a.id === id);
  const thumbs = (ids: number[]) => ids.map((id) => asset(id)).filter(Boolean).map((a) => (
    <a key={a!.id} href={privateFileUrl(a!.token)} target="_blank" rel="noreferrer" title={a!.filename}
      className="block h-16 w-16 overflow-hidden rounded border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={privateFileUrl(a!.token)} alt={a!.filename} className="h-full w-full object-cover" />
    </a>
  ));
  const cover = asset(d.cover_asset_id);
  const spreads = [...d.spreads].sort((a, b) => (a.after_page ?? 9999) - (b.after_page ?? 9999));
  const annotations = [...d.annotations].sort((a, b) => a.page - b.page);
  return (
    <details className="mt-2 rounded-md border border-border px-3 py-2 text-xs leading-5">
      <summary className="flex min-h-[40px] cursor-pointer items-center gap-2 md:min-h-0">
        <span className="font-medium">設計內容</span>
        <span className="text-muted-foreground">
          {DESIGN_STATUS[design.status]}{design.confirmed_at ? `（${formatDate(design.confirmed_at)}）` : ''}
          ・修改 {annotations.length} 處・跨頁 {spreads.length}
        </span>
      </summary>
      <div className="mt-2 space-y-3">
        {design.report_token && (
          <a href={privateFileUrl(design.report_token)} target="_blank" rel="noreferrer"
            className="inline-flex text-admin-accent-600 hover:underline dark:text-admin-accent-200">開啟報告 PDF</a>
        )}
        <div>
          <p>封面名字：{d.cover_name || '—'}・款式 {d.cover_style || '—'}</p>
          {cover && <div className="mt-1 flex gap-2">{thumbs([cover.id])}<span className="self-end text-muted-foreground">客製封面圖</span></div>}
          {d.dedication && <p className="whitespace-pre-line">扉頁：{d.dedication}</p>}
        </div>
        {spreads.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium">指定跨頁</p>
            {spreads.map((s) => (
              <div key={s.index} className="rounded bg-muted px-2 py-1.5">
                <p>{s.after_page ? `插在第 ${s.after_page} 頁後` : '尚未選位置'}{s.text ? `：${s.text}` : ''}</p>
                {s.asset_ids.length > 0 && <div className="mt-1 flex flex-wrap gap-2">{thumbs(s.asset_ids)}</div>}
              </div>
            ))}
          </div>
        )}
        {annotations.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium">頁面修改</p>
            {annotations.map((a) => (
              <div key={a.id} className="rounded bg-muted px-2 py-1.5">
                <p>第 {a.page} 頁・{ANNOTATION_LABEL[a.type]}：<span className="whitespace-pre-line">{a.text || '—'}</span></p>
                {a.asset_ids.length > 0 && <div className="mt-1 flex flex-wrap gap-2">{thumbs(a.asset_ids)}</div>}
              </div>
            ))}
          </div>
        )}
        {design.problems.length > 0 && design.status !== 'confirmed' && (
          <p className="text-amber-700 dark:text-amber-300">尚未完成：{design.problems.join('；')}</p>
        )}
      </div>
    </details>
  );
}

const PROOF_STAGES = ['awaiting_proof', 'proof_ready', 'changes_requested'];

/** 打樣：上傳新版、歷次版本與會員意見、加給修改次數、代為確認送印 */
function ProofPanel({ job, onDone, onError }: { job: AdminPrintJob; onDone: (t: string) => void; onError: (t: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const pr = job.proofs;
  if (!pr || (!PROOF_STAGES.includes(job.status) && pr.versions.length === 0)) return null;
  const canUpload = PROOF_STAGES.includes(job.status);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) return onError('請選擇 PDF 檔');
    setBusy(true);
    try {
      await reportOrdersApi.adminUploadProof(job.id, file, note);
      setNote('');
      onDone(`${job.order_no} 已上傳打樣並通知會員確認`);
    } catch (e: any) {
      onError(e.message || '上傳失敗');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const open = async (proofId: number) => {
    const win = window.open('', '_blank');
    try {
      const { url } = await reportOrdersApi.adminProofLink(job.id, proofId);
      if (win) win.location.href = url;
    } catch (e: any) {
      win?.close();
      onError(e.message || '無法開啟打樣');
    }
  };
  const act = async (action: PrintJobAction, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await reportOrdersApi.adminPrintJobAction(job.id, action, body);
      onDone(done);
    } catch (e: any) {
      onError(e.message || '操作失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border px-3 py-2 text-[13px]">
      <p className="font-medium">
        打樣
        <span className="ml-2 font-normal text-muted-foreground">
          免費修改 {pr.free_revisions} 次・剩 {pr.revisions_left} 次・會員 {pr.response_days} 天內沒回應自動確認送印
        </span>
      </p>
      {pr.versions.length > 0 && (
        <ul className="space-y-1">
          {pr.versions.map((v) => (
            <li key={v.id} className="rounded bg-muted/60 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span>第 {v.version} 版</span>
                <span className="text-muted-foreground">{formatDate(v.created_at)}</span>
                <span className={v.decision ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-300'}>
                  {v.decision_label ?? `等待會員確認（期限 ${formatDate(v.due_at)}）`}
                </span>
                <button type="button" className="ml-auto text-admin-accent-600 hover:underline dark:text-admin-accent-200" onClick={() => open(v.id)}>開啟</button>
              </div>
              {v.admin_note && <p className="text-muted-foreground">說明：{v.admin_note}</p>}
              {v.comment && <p className="whitespace-pre-line">{v.decision === 'changes_requested' ? '會員修改意見' : '備註'}：{v.comment}</p>}
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="space-y-1.5">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
            placeholder="給會員看的這版說明（選填，例如：已修正封面名字）" />
          <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <button type="button" className={`${btnPrimary} w-full`} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? '處理中…' : pr.versions.length ? `上傳第 ${pr.versions.length + 1} 版打樣並通知會員` : '上傳打樣並通知會員'}
          </button>
        </div>
      )}
      {job.status === 'proof_ready' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} disabled={busy}
            onClick={() => window.confirm('多給會員一次免費修改？（會員來信要求、你同意時使用）') && act('grant_revision', {}, '已多給一次修改')}>
            多給一次修改
          </button>
          <button type="button" className={btnGhost} disabled={busy} onClick={() => setApproving((v) => !v)}>代為確認送印</button>
        </div>
      )}
      {approving && job.status === 'proof_ready' && (
        <div className="flex gap-2">
          <input className={inputCls} value={approveNote} onChange={(e) => setApproveNote(e.target.value)}
            placeholder="說明，例如：會員 10/20 來電確認" maxLength={1000} />
          <button type="button" className={btnPrimary} disabled={busy || !approveNote.trim()}
            onClick={() => act('approve_proof', { note: approveNote }, '已代為確認送印')}>確認</button>
        </div>
      )}
    </div>
  );
}

function Actions({ job, onDone, onError }: {
  job: AdminPrintJob;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(job.refund_due ? String(job.refund_due) : '');
  const [refundNote, setRefundNote] = useState('');

  const run = async (action: PrintJobAction, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await reportOrdersApi.adminPrintJobAction(job.id, action, body);
      onDone(done);
    } catch (e: any) {
      onError(e.message || '操作失敗');
    } finally {
      setBusy(false);
    }
  };

  const refundPending = job.status === 'cancelled' && job.refund_due != null && !job.refunded_at;
  const cancellable = job.cancellable && (job.kind === 'addon' || job.order_status === 'paid');

  return (
    <div className="space-y-3">
      {job.status === 'approved' && (
        <button type="button" className={`${btnPrimary} w-full`} disabled={busy}
          onClick={() => window.confirm(`確定已把 ${job.order_no} 送印？`) && run('printing', {}, `${job.order_no} 已標記送印`)}>
          標記送印
        </button>
      )}

      {job.status === 'printing' && (
        <div className="space-y-2">
          <input className={inputCls} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="物流業者，例如：黑貓宅急便" />
          <input className={`${inputCls} font-mono`} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="物流單號" />
          <button type="button" className={`${btnPrimary} w-full`} disabled={busy || !carrier.trim() || !tracking.trim()}
            onClick={() => run('shipped', { carrier, tracking_no: tracking }, `${job.order_no} 已登錄出貨並通知會員`)}>
            <Truck className="h-4 w-4" /> 登錄出貨並通知會員
          </button>
        </div>
      )}

      {job.status === 'shipped' && (
        <button type="button" className={`${btnGhost} w-full`} disabled={busy}
          onClick={() => run('delivered', {}, `${job.order_no} 已標記送達`)}>
          標記已送達
        </button>
      )}

      {refundPending && (
        <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-900/30">
          <p className="font-medium text-amber-900 dark:text-amber-100">待退款 {nt(job.refund_due, job.currency)}</p>
          <input className={inputCls} inputMode="numeric" value={refund} onChange={(e) => setRefund(e.target.value.replace(/\D/g, ''))} placeholder="實際退款金額" />
          <input className={inputCls} value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="備註（例如：退至會員帳戶末五碼）" maxLength={500} />
          <button type="button" className={`${btnPrimary} w-full`} disabled={busy || !refund}
            onClick={() => run('refund', { amount: Number(refund), note: refundNote }, `${job.order_no} 已登錄退款並通知會員`)}>
            登錄退款並通知會員
          </button>
        </div>
      )}

      {cancellable && (
        cancelling ? (
          <div className="space-y-2">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="取消原因（會寄給會員）" maxLength={500} />
            <div className="flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setCancelling(false)}>返回</button>
              <button type="button" className={`${btnPrimary} flex-1`} disabled={busy || !reason.trim()}
                onClick={() => run('cancel', { reason }, `${job.order_no} 的實體書已取消`)}>
                確認取消
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${btnDanger} w-full`} onClick={() => setCancelling(true)}>取消實體書</button>
        )
      )}
    </div>
  );
}

export default function ReportShipmentsPage() {
  const [filter, setFilter] = useState<Filter>('awaiting_customization');
  const [jobs, setJobs] = useState<AdminPrintJob[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportOrdersApi.adminPrintJobs(filter);
      setJobs(res.jobs);
      setCounts(res.counts);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '載入失敗' });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const copy = async (j: AdminPrintJob) => {
    try {
      await navigator.clipboard.writeText(summaryText(j));
      setMessage({ type: 'success', text: `已複製 ${j.order_no} 的實體書資料` });
    } catch {
      setMessage({ type: 'error', text: '無法複製，請手動選取文字' });
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">實體書出貨</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            下單選實體書版與事後加購的實體書都在這裡。送印前會員可以取消；已付款的取消後請到「待退款」轉帳並登錄。
          </p>
        </div>

        <div className="mb-4 -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {FILTERS.map((f) => {
            const n = f.value === 'all' ? null : counts[f.value];
            return (
              <button key={f.value} type="button" onClick={() => setFilter(f.value)}
                className={`flex-shrink-0 whitespace-nowrap rounded px-2.5 py-2 md:py-1 text-xs font-medium transition ${
                  filter === f.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                {f.label}{n ? <span className="ml-1 tabular-nums opacity-70">{n}</span> : null}
              </button>
            );
          })}
        </div>

        {message && (
          <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <AdminLoadingSkeleton variant="list" count={4} />
        ) : jobs.length === 0 ? (
          <AdminEmptyState icon={<Truck className="h-10 w-10" />} title="沒有符合的實體書" />
        ) : (
          <div className="space-y-3">
            {jobs.map((j) => (
              <div key={j.id} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">{j.order_no}</span>
                      <span className="rounded bg-admin-accent-100 px-2 py-0.5 text-[11px] font-medium text-admin-accent-800 dark:bg-admin-accent-800/40 dark:text-admin-accent-100">
                        {j.status_label}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {j.kind === 'addon' ? `事後加購・原訂單 ${j.parent_order_no}` : '下單選實體書版'}
                      </span>
                    </div>
                    <p>主角 {j.subject_name}（{j.call_name}）・{j.spec_label || '未分規格'}・{j.quantity} 本{j.custom_labels.length ? `・${j.custom_labels.join('、')}` : ''}</p>
                    <p className="text-muted-foreground">購買者 {j.buyer_email ?? '—'}・訂單金額 {nt(j.amount, j.currency)}・付款 {formatDate(j.paid_at)}</p>
                    {j.dedication && <p className="whitespace-pre-line text-muted-foreground">扉頁贈言：{j.dedication}</p>}
                    {j.shipping && (
                      <div className="mt-2 rounded-md bg-muted px-3 py-2 text-xs leading-5">
                        <p>收件人 {j.shipping.recipient_name}・<span className="font-mono">{j.shipping.recipient_phone}</span></p>
                        <p>{j.shipping.postal_code} {j.shipping.address}</p>
                        {j.shipping.tracking_no && <p>物流 {j.shipping.carrier}・<span className="font-mono">{j.shipping.tracking_no}</span>・出貨 {formatDate(j.shipping.shipped_at)}</p>}
                      </div>
                    )}
                    {j.design && <DesignPanel design={j.design} />}
                    <ProofPanel job={j} onDone={(text) => { setMessage({ type: 'success', text }); load(); }}
                      onError={(text) => setMessage({ type: 'error', text })} />
                    {j.status === 'cancelled' && (
                      <p className="text-xs text-muted-foreground">
                        {j.cancelled_by === 'member' ? '會員取消' : j.cancelled_by === 'admin' ? '管理者取消' : '系統取消'}
                        {j.cancel_reason ? `：${j.cancel_reason}` : ''}
                        {j.refunded_at ? `・已退款 ${nt(j.refund_amount, j.currency)}（${formatDate(j.refunded_at)}）${j.refund_note ? `・${j.refund_note}` : ''}` : ''}
                      </p>
                    )}
                    <button type="button" onClick={() => copy(j)}
                      className="mt-1 inline-flex min-h-[40px] md:min-h-0 items-center gap-1 text-xs text-admin-accent-600 hover:underline dark:text-admin-accent-200">
                      <Copy className="h-3.5 w-3.5" /> 複製實體書資料
                    </button>
                  </div>
                  <div className="w-full md:w-72">
                    <Actions job={j} onDone={(text) => { setMessage({ type: 'success', text }); load(); }}
                      onError={(text) => setMessage({ type: 'error', text })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
