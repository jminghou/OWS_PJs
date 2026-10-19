'use client';

/**
 * 報告交付：已付款的報告訂單在這裡上傳完成的報告 PDF。
 * 第一次上傳會寄「報告完成」通知（有實體書在等設計的，信中邀請客人來設計）；更正後可重傳，會員下載的是最新一版。
 * 檔案存在私有儲存，不會出現在媒體庫。後端：/api/v1/admin/report-deliveries（report_orders.fulfill）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@ows/admin-app';
import { AdminEmptyState, AdminLoadingSkeleton } from '@ows/ui/admin';
import { ExternalLink, FileText, Upload } from 'lucide-react';
import { reportOrdersApi, type AdminDelivery, type DeliveryChart, type HandoffView } from '@/lib/api/reportOrders';

type Filter = 'pending' | 'delivered' | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: '待上傳' },
  { value: 'delivered', label: '已上傳' },
  { value: 'all', label: '全部' },
];

const btn =
  'inline-flex min-h-[40px] md:min-h-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-admin-accent-600 text-white hover:bg-admin-accent-700`;
const btnGhost = `${btn} border border-border bg-card text-foreground hover:bg-muted`;

const formatDate = (v: string | null | undefined) =>
  v ? new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** 到紫微系統製作報告用的命盤資訊：命盤編號、客人原始填寫的出生資料、實際排盤時間 */
function ChartInfo({ chart }: { chart: DeliveryChart }) {
  if (!chart.chart_id) return <p className="text-muted-foreground">命盤編號：—（舊訂單沒有記錄）</p>;
  const input = `${chart.birth_date ?? '—'} ${chart.birth_time ?? ''}`.trim();
  const typeLabel = chart.time_type === 'solar_time' ? '真太陽時' : '一般時間';
  const adjusted = chart.used_time && chart.used_time !== input;
  return (
    <div className="mt-2 space-y-0.5 rounded-md bg-muted/60 px-3 py-2 text-[13px]">
      <p>
        命盤編號 <span className="select-all font-mono">{chart.chart_id}</span>
      </p>
      <p className="text-muted-foreground">
        客人填寫：{chart.gender ?? '—'}・{input}（{typeLabel}）{chart.place ? `・${chart.place}` : ''}
      </p>
      {adjusted && (
        <p className="text-muted-foreground">
          排盤時間：<span className="font-mono">{chart.used_time}</span>
          {chart.dst_minutes ? `（已扣夏令時 ${chart.dst_minutes / 60} 小時）` : chart.time_type === 'solar_time' ? '（真太陽時換算後）' : ''}
          ——紫微系統顯示的 Clock time 是這個
        </p>
      )}
    </div>
  );
}

const HANDOFF_CLS: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  pending: 'bg-muted text-muted-foreground',
  failed: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200',
};

/** 紫微工作單：付款後由背景排程自動建立；失敗會自動重試，也可以按「立即送出」 */
function HandoffInfo({ h }: { h: HandoffView | null }) {
  if (!h || h.status === 'not_ready' || h.status === 'cancelled') return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
      <span>紫微工作單</span>
      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${HANDOFF_CLS[h.status] ?? 'bg-muted'}`}>{h.status_label}</span>
      {h.status === 'sent' && <span>{formatDate(h.sent_at)} 建立</span>}
      {h.status === 'pending' && <span>幾分鐘內會自動送出</span>}
      {h.status === 'failed' && (
        <span className="text-destructive">
          已試 {h.attempts} 次：{h.error ?? '未知錯誤'}{h.next_attempt_at ? `・下次自動重試 ${formatDate(h.next_attempt_at)}` : ''}
        </span>
      )}
    </p>
  );
}

function Row({ d, onDone, onError }: { d: AdminDelivery; onDone: (t: string) => void; onError: (t: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      onError('請選擇 PDF 檔');
      return;
    }
    setBusy(true);
    try {
      const res = await reportOrdersApi.adminUploadReportPdf(d.order_no, file);
      onDone(res.first_time ? `${d.order_no} 已上傳報告並通知會員` : `${d.order_no} 已更新報告（會員下載的是新版）`);
    } catch (e: any) {
      onError(e.message || '上傳失敗');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const sendHandoff = async () => {
    setBusy(true);
    try {
      await reportOrdersApi.adminSendHandoff(d.order_no);
      onDone(`${d.order_no} 已在紫微系統建立工作單`);
    } catch (e: any) {
      onError(e.message || '送出失敗');
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    const win = window.open('', '_blank');
    try {
      const { url } = await reportOrdersApi.adminReportPdfLink(d.order_no);
      if (win) win.location.href = url;
    } catch (e: any) {
      win?.close();
      onError(e.message || '無法開啟報告');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-medium">{d.order_no}</span>
            <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${d.document
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'}`}>
              {d.document ? '已上傳' : '待上傳'}
            </span>
            {d.variant === 'physical' && <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">含實體書</span>}
          </div>
          <p>{d.name}・主角 {d.subject_name}（{d.call_name}）</p>
          <p className="text-muted-foreground">購買者 {d.buyer_email ?? '—'}・付款 {formatDate(d.paid_at)}</p>
          <ChartInfo chart={d.chart} />
          <HandoffInfo h={d.handoff} />
          {d.document && (
            <p className="text-muted-foreground">
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              {d.document.filename}・{(d.document.bytes / 1024 / 1024).toFixed(1)} MB・{formatDate(d.document.uploaded_at)}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 md:w-60">
          {d.chart.workbench_url && (
            <a href={d.chart.workbench_url} target="_blank" rel="noopener noreferrer" className={`${btnGhost} w-full`}>
              <ExternalLink className="h-4 w-4" /> 在紫微系統開啟
            </a>
          )}
          {(d.handoff?.status === 'pending' || d.handoff?.status === 'failed') && (
            <button type="button" className={`${btnGhost} w-full`} disabled={busy} onClick={sendHandoff}>
              立即送到紫微
            </button>
          )}
          <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <button type="button" className={`${btnPrimary} w-full`} disabled={busy} onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4" /> {busy ? '上傳中…' : d.document ? '上傳更正版' : '上傳報告 PDF'}
          </button>
          {d.document && <button type="button" className={`${btnGhost} w-full`} onClick={preview}>開啟目前的 PDF</button>}
        </div>
      </div>
    </div>
  );
}

export default function ReportDeliveriesPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<AdminDelivery[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportOrdersApi.adminDeliveries(filter);
      setRows(res.deliveries);
      setCounts(res.counts);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || '載入失敗' });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">報告交付</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            報告做好後在這裡上傳 PDF。第一次上傳會寄信通知會員來下載；有訂實體書的，信中會邀請他用整本書的預覽設計內容。
            檔案存在不公開的空間，只有會員本人和後台看得到。
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded px-2.5 py-2 md:py-1 text-xs font-medium transition ${
                filter === f.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}>
              {f.label}{counts[f.value] ? <span className="ml-1 tabular-nums opacity-70">{counts[f.value]}</span> : null}
            </button>
          ))}
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
        ) : rows.length === 0 ? (
          <AdminEmptyState icon={<FileText className="h-10 w-10" />} title={filter === 'pending' ? '沒有待上傳的報告' : '沒有符合的報告'} />
        ) : (
          <div className="space-y-3">
            {rows.map((d) => (
              <Row key={d.order_no} d={d} onDone={(text) => { setMessage({ type: 'success', text }); load(); }}
                onError={(text) => setMessage({ type: 'error', text })} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
