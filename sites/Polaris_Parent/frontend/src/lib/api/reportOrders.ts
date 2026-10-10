/**
 * 客製報告訂單 API client（會員 v2）
 * 對應後端 sites/Polaris_Parent/backend/extensions/report_orders
 *   GET  /api/v1/report-payment-mode                                 （公開）
 *   GET  /api/v1/report-physical-config                              （公開，實體書與專人解讀設定）
 *   POST /api/v1/report-orders                                       （會員）
 *   GET  /api/v1/report-orders                                       （會員）
 *   GET  /api/v1/report-orders/:orderNo                              （會員）
 *   POST /api/v1/report-orders/:orderNo/transfer                     （會員，人工收款回報）
 *   POST /api/v1/report-orders/:orderNo/addons                       （會員，事後加購實體書／專人解讀）
 *   POST /api/v1/report-orders/:orderNo/physical-cancel              （會員，送印前取消實體書）
 *   GET  /api/v1/admin/report-orders                                 （report_orders.read）
 *   POST /api/v1/admin/report-orders/:orderNo/confirm-payment        （report_orders.confirm_payment）
 *   POST /api/v1/admin/report-orders/:orderNo/reject-transfer        （report_orders.confirm_payment）
 *   GET  /api/v1/admin/report-print-jobs                             （report_orders.fulfill）
 *   POST /api/v1/admin/report-print-jobs/:id/:action                 （report_orders.fulfill）
 *   GET  /api/v1/admin/report-consultations                          （report_orders.fulfill）
 *   POST /api/v1/admin/report-consultations/:id/:action              （report_orders.fulfill）
 */
import { request } from '@ows/platform-api/client';
import type { ReportDraft } from '@/lib/report/draft';

export type PaymentMode = 'placeholder' | 'manual';

export interface ShippingInfo {
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address: string;
}

// ── 實體書與專人解讀的設定與計價 ─────────────────────────────────────────

export type CustomKey = 'custom_cover' | 'text_unlock' | 'image_insert';

/** 實體書的下單選擇 */
export interface PhysicalSelection {
  spec_key?: string | null;
  quantity?: number;
  /** 勾選的特殊客製 */
  custom?: CustomKey[];
  /** 指定跨頁數 */
  spreads?: number;
}

export interface PhysicalConfig {
  /** 是否開放實體書 */
  enabled: boolean;
  digital_price: number | null;
  /** 第一本（含運費） */
  first_copy_price: number;
  /** 第二本起每本 */
  extra_copy_price: number;
  /** 規格；加減價只影響第一本 */
  specs: { key: string; label: string; price_delta: number }[];
  cover_styles: { key: string; label: string; image?: string }[];
  /** 特殊客製（一張訂單收一次）；只列出開放中的 */
  custom_options: { key: CustomKey; label: string; note: string; price: number }[];
  /** 指定跨頁；null＝不開放 */
  spreads: { label: string; price: number; max: number } | null;
  /** 專人解讀；null＝不開放 */
  consult: { label: string; minutes: number; price: number; max_sessions: number } | null;
  max_quantity: number;
  currency: string;
}

export interface PriceLine { label: string; amount: number }

/** 實體書一筆的金額與明細（與後端 physical.price_physical 相同算法；實際金額以後端為準） */
export function pricePhysical(cfg: PhysicalConfig, sel: PhysicalSelection): { total: number; lines: PriceLine[] } {
  const spec = cfg.specs.find((s) => s.key === sel.spec_key);
  const qty = sel.quantity ?? 1;
  const lines: PriceLine[] = [
    { label: spec ? `第一本・${spec.label}` : '第一本', amount: cfg.first_copy_price + (spec?.price_delta ?? 0) },
  ];
  if (qty > 1) lines.push({ label: `第二本起 × ${qty - 1}`, amount: (qty - 1) * cfg.extra_copy_price });
  for (const key of sel.custom ?? []) {
    const opt = cfg.custom_options.find((o) => o.key === key);
    if (opt) lines.push({ label: opt.label, amount: opt.price });
  }
  if (sel.spreads && cfg.spreads) {
    lines.push({ label: `${cfg.spreads.label} × ${sel.spreads} 跨頁`, amount: sel.spreads * cfg.spreads.price });
  }
  return { total: lines.reduce((a, l) => a + l.amount, 0), lines };
}

export function priceConsult(cfg: PhysicalConfig, sessions: number): PriceLine | null {
  if (!sessions || !cfg.consult) return null;
  return { label: `${cfg.consult.label} ${cfg.consult.minutes} 分鐘 × ${sessions}`, amount: sessions * cfg.consult.price };
}

export interface CreateReportOrderRequest extends Omit<ReportDraft, 'submission_key'> {
  submission_key: string;
  policy_consented: boolean;
  policy_version: string;
  shipping?: ShippingInfo;
  physical?: PhysicalSelection;
  consult_sessions?: number;
}

// ── 訂單 ─────────────────────────────────────────────────────────────────

export type PrintJobStatus =
  | 'awaiting_payment' | 'awaiting_customization' | 'awaiting_proof' | 'proof_ready' | 'changes_requested'
  | 'approved' | 'printing' | 'shipped' | 'delivered' | 'cancelled';

export type ConsultStatus = 'awaiting_payment' | 'to_schedule' | 'scheduled' | 'completed' | 'cancelled';

export interface PhysicalView {
  id: number;
  status: PrintJobStatus;
  status_label: string;
  spec_label: string;
  quantity: number;
  custom: CustomKey[];
  spreads: number;
  custom_labels: string[];
  line_total: number | null;
  breakdown: PriceLine[];
  cancellable: boolean;
  cancelled_at: string | null;
  refund_due: number | null;
  refund_amount: number | null;
  refunded_at: string | null;
}

export interface ConsultView {
  id: number;
  status: ConsultStatus;
  status_label: string;
  sessions: number;
  minutes: number;
  amount: number;
  scheduled_at: string | null;
  cancelled_at: string | null;
  refund_due: number | null;
  refunded_at: string | null;
}

export interface AddonChild {
  order_no: string;
  order_status: string;
  amount: number;
  created_at: string | null;
  physical: { quantity: number; status: PrintJobStatus; status_label: string } | null;
  consult: { sessions: number; status: ConsultStatus; status_label: string } | null;
}

export interface BankInfo {
  bank_name: string;
  bank_code: string;
  account_no: string;
  account_name: string;
}

export interface TransferReport {
  /** created=待確認 / succeeded=已確認 / failed=已退回 / expired */
  status: 'created' | 'succeeded' | 'failed' | 'expired';
  last5: string | null;
  transferred_on: string | null;
  reported_amount: number | null;
  member_note: string | null;
  review_note: string | null;
  reported_at: string | null;
  paid_at: string | null;
}

export interface ReportOrderSummary {
  order_no: string;
  status: 'pending' | 'paid' | 'cancelled' | string;
  amount: number;
  currency: string;
  payment_mode: PaymentMode | string;
  payment: {
    mode: PaymentMode | string;
    deadline: string | null;
    bank?: BankInfo | null;
    transfer?: TransferReport | null;
  };
  created_at: string | null;
  paid_at: string | null;
  /** 主項目：報告＞實體書加購＞專人解讀 */
  item: {
    item_no: string; name: string; variant: string; subject_name: string; call_name: string;
    kind: 'purchase' | 'addon' | 'service'; quantity: number; parent_order_no: string | null;
  } | null;
  /** 這張訂單的所有品項 */
  lines: { name: string; kind: string; variant: string; quantity: number; amount: number }[];
  production: { handoff_status: string; ziwei_status: string | null; member_note: string | null } | null;
  shipment: { status: string; carrier: string | null; tracking_no: string | null } | null;
  /** 這張訂單的實體書 */
  physical: PhysicalView | null;
  /** 這張訂單的專人解讀 */
  consult: ConsultView | null;
  /** 這份報告事後加購的訂單 */
  addons: AddonChild[];
  /** 已付款的報告訂單才有：現在能加購什麼 */
  addon_offer: { physical: boolean; consult: boolean; available: boolean } | null;
}

export interface AdminReportOrder extends ReportOrderSummary {
  buyer_email: string | null;
}

export interface AdminPrintJob extends PhysicalView {
  order_no: string;
  order_status: string;
  amount: number;
  paid_at: string | null;
  created_at: string | null;
  buyer_email: string | null;
  item_no: string;
  item_name: string;
  kind: 'purchase' | 'addon';
  parent_order_no: string | null;
  subject_name: string | null;
  call_name: string | null;
  dedication: string;
  options: Record<string, any>;
  pages: any[];
  cancel_reason: string | null;
  cancelled_by: string | null;
  refund_note: string | null;
  shipping: {
    recipient_name: string; recipient_phone: string; postal_code: string | null; address: string; status: string;
    carrier: string | null; tracking_no: string | null; print_sent_at: string | null; shipped_at: string | null;
  } | null;
}

export type PrintJobAction = 'printing' | 'shipped' | 'delivered' | 'cancel' | 'refund';

export interface AdminConsultation extends ConsultView {
  order_no: string;
  order_status: string;
  paid_at: string | null;
  created_at: string | null;
  buyer_email: string | null;
  report_order_no: string | null;
  subject_name: string | null;
  call_name: string | null;
  admin_note: string | null;
  cancel_reason: string | null;
  refund_amount: number | null;
  refund_note: string | null;
}

export type ConsultAction = 'schedule' | 'complete' | 'cancel' | 'refund';

export interface TransferReportRequest {
  last5: string;
  transferred_on: string;
  amount: number;
  note?: string;
}

export interface CreateAddonRequest {
  submission_key: string;
  policy_consented: boolean;
  policy_version: string;
  /** 不加購實體書時省略 */
  physical?: PhysicalSelection;
  /** 專人解讀次數，0＝不買 */
  consult_sessions: number;
  shipping?: ShippingInfo;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const reportOrdersApi = {
  paymentMode: () =>
    request<{ success: boolean; mode: PaymentMode | string; available: boolean; deadline_days: number | null }>(
      '/report-payment-mode'
    ),

  physicalConfig: () => request<{ success: boolean; config: PhysicalConfig }>('/report-physical-config'),

  create: (body: CreateReportOrderRequest) =>
    post<{ success: boolean; created: boolean; order: ReportOrderSummary }>('/report-orders', body),

  list: () => request<{ success: boolean; orders: ReportOrderSummary[] }>('/report-orders'),

  get: (orderNo: string) =>
    request<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}`),

  reportTransfer: (orderNo: string, body: TransferReportRequest) =>
    post<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}/transfer`, body),

  createAddon: (orderNo: string, body: CreateAddonRequest) =>
    post<{ success: boolean; created: boolean; order: ReportOrderSummary }>(
      `/report-orders/${encodeURIComponent(orderNo)}/addons`, body
    ),

  cancelPhysical: (orderNo: string, reason?: string) =>
    post<{ success: boolean; order: ReportOrderSummary }>(
      `/report-orders/${encodeURIComponent(orderNo)}/physical-cancel`, { reason }
    ),

  // ── 管理端 ──
  adminList: (params: { status?: string; awaiting?: boolean } = {}) =>
    request<{ success: boolean; orders: AdminReportOrder[] }>('/admin/report-orders', {
      params: { status: params.status ?? 'pending', awaiting: params.awaiting ? 1 : undefined },
    }),

  adminConfirmPayment: (orderNo: string, body: { received_amount: number; last5?: string; note?: string }) =>
    post<{ success: boolean; order: AdminReportOrder }>(
      `/admin/report-orders/${encodeURIComponent(orderNo)}/confirm-payment`, body
    ),

  adminRejectTransfer: (orderNo: string, reason: string) =>
    post<{ success: boolean; order: AdminReportOrder }>(
      `/admin/report-orders/${encodeURIComponent(orderNo)}/reject-transfer`, { reason }
    ),

  adminPrintJobs: (status = 'all') =>
    request<{ success: boolean; jobs: AdminPrintJob[]; counts: Record<string, number> }>('/admin/report-print-jobs', {
      params: { status },
    }),

  adminPrintJobAction: (id: number, action: PrintJobAction, body: Record<string, unknown> = {}) =>
    post<{ success: boolean; job: AdminPrintJob }>(`/admin/report-print-jobs/${id}/${action}`, body),

  adminConsultations: (status = 'all') =>
    request<{ success: boolean; consultations: AdminConsultation[]; counts: Record<string, number> }>(
      '/admin/report-consultations', { params: { status } }
    ),

  adminConsultationAction: (id: number, action: ConsultAction, body: Record<string, unknown> = {}) =>
    post<{ success: boolean; consultation: AdminConsultation }>(`/admin/report-consultations/${id}/${action}`, body),
};
