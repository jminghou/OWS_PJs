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
 *   POST /api/v1/report-orders/:orderNo/report-pdf/link              （會員，報告 PDF 短效網址）
 *   GET  /api/v1/admin/report-deliveries                             （report_orders.fulfill）
 *   POST /api/v1/admin/report-orders/:orderNo/report-pdf             （report_orders.fulfill，上傳報告 PDF）
 *   POST /api/v1/admin/report-orders/:orderNo/report-pdf/link        （report_orders.fulfill）
 *   POST /api/v1/admin/report-orders/:orderNo/handoff                （report_orders.fulfill，立即送到紫微建工作單）
 *   POST /api/v1/report-orders/:orderNo/proofs/:proofId/link         （會員，打樣 PDF 短效網址）
 *   GET  /api/v1/admin/report-orders/overview                        （report_orders.read，訂單總覽）
 *   GET  /api/v1/admin/report-orders/:orderNo/detail                 （report_orders.read，訂單詳細＋時間軸）
 *   POST /api/v1/admin/report-orders/:orderNo/notes                  （report_orders.read，內部備註）
 *   POST /api/v1/report-orders/:orderNo/proof-decision               （會員，確認送印／提出修改）
 *   POST /api/v1/admin/report-print-jobs/:id/proofs                  （report_orders.fulfill，上傳打樣）
 *   POST /api/v1/admin/report-print-jobs/:id/proofs/:proofId/link    （report_orders.fulfill）
 *   POST /api/v1/report-orders/:orderNo/design-draft                 （會員，付款前的設計草稿）
 *   GET  /api/v1/report-orders/:orderNo/design                       （會員，付款後那本實體書的設計）
 *   GET|PUT /api/v1/report-designs/:id                               （會員，讀取／儲存設計）
 *   POST /api/v1/report-designs/:id/assets、DELETE …/assets/:assetId  （會員，上傳／刪除照片）
 *   POST /api/v1/report-designs/:id/confirm                          （會員，確認內容，開始製作打樣）
 *   GET  /api/v1/report-files/:token                                 （私有檔案：報告 PDF／照片，短效憑證）
 *   GET  /api/v1/admin/report-consultations                          （report_orders.fulfill）
 *   POST /api/v1/admin/report-consultations/:id/:action              （report_orders.fulfill）
 *   GET  /api/v1/admin/report-notifications                          （report_orders.read，寄信紀錄＋排程狀態）
 *   GET  /api/v1/admin/report-notifications/:id                      （report_orders.read，含內文）
 *   POST /api/v1/admin/report-notifications/:id/resend               （report_orders.fulfill，手動重寄）
 */
import { getBaseUrl, request } from '@ows/platform-api/client';
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

export interface OrderTodo {
  key: string;
  label: string;
  /** admin＝要你處理；member＝等會員 */
  waiting_on: 'admin' | 'member';
  /** 處理這件事的後台頁面 */
  href: string | null;
}

export interface AdminOrderRow {
  order_no: string;
  currency: string;
  /** 成品語系（BCP 47；官網訂單為 zh-TW） */
  language: string | null;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  status_label: string;
  amount: number;
  created_at: string | null;
  paid_at: string | null;
  buyer_email: string | null;
  kind: 'purchase' | 'addon' | 'service' | null;
  subject_name: string | null;
  call_name: string | null;
  parent_order_no: string | null;
  lines: string[];
  physical_status: string | null;
  consult_status: string | null;
  report_ready: boolean;
  /** 外部平台訂單（代客建單或外部訂單查證）；官網訂單為 null */
  external: { channel: string | null; external_order_id: string | null; proxy: boolean; customer_name: string | null } | null;
  todos: OrderTodo[];
}

export interface TimelineEntry {
  at: string | null;
  kind: 'event' | 'mail';
  type: string;
  text: string;
  /** member／admin／system */
  actor: 'member' | 'admin' | 'system';
  actor_name: string | null;
  recipient?: string;
  status?: 'pending' | 'sent' | 'failed' | 'skipped';
}

export interface AdminOrderDetail extends AdminOrderRow {
  summary: ReportOrderSummary;
  handoff: HandoffView | null;
  documents: { filename: string; bytes: number; is_current: boolean; uploaded_at: string | null }[];
  payments: {
    attempt_no: string; provider: string; status: string; amount: number | null; manual_reference: string | null;
    transferred_on: string | null; paid_at: string | null; review_note: string | null;
  }[];
  print_job_id: number | null;
  related: { relation: string; order_no: string; status_label: string }[];
  external_detail: ExternalOrderDetail | null;
  timeline: TimelineEntry[];
}

// ── 外部平台代客建單（後端 report_orders/proxy.py） ─────────────────────────

export interface ProxyChannel {
  id: number;
  channel: string;
  store_key: string;
  manual_import: boolean;
  valid_until: string;
  /** 已開放人工匯入且未過期：才能代客建單 */
  effective: boolean;
  policy_reference: string;
}

export interface CurrencyOption { code: string; label: string; exponent: number; symbol: string }

export interface ExternalCustomer {
  id: number;
  display_name: string;
  platform_handle: string | null;
  contact_note: string | null;
  channel_id: number | null;
  app_user_id: number;
  /** 客人已用認領碼綁定自己的帳號 */
  claimed: boolean;
  created_at: string | null;
  orders?: AdminOrderRow[];
}

export type SourceKind = 'conversation' | 'link' | 'screenshot' | 'note';

export interface OrderSource {
  id: number;
  kind: SourceKind;
  kind_label: string;
  occurred_on: string | null;
  summary: string | null;
  url: string | null;
  filename: string | null;
  content_type: string | null;
  bytes: number | null;
  has_file: boolean;
  created_at: string | null;
}

export interface ExternalOrderDetail {
  channel: string | null;
  store_key: string | null;
  external_order_id: string | null;
  receipt_status: string | null;
  amount: number | null;
  currency: string | null;
  proxy: boolean;
  customer: ExternalCustomer | null;
  sources: OrderSource[];
  delivered_via_platform: boolean;
}

export interface ProxyConfig {
  channels: ProxyChannel[];
  currencies: CurrencyOption[];
  specs: { key: string; label: string; price_delta: number }[];
  default_spec_key: string | null;
  cover_styles: { key: string; label: string; image?: string }[];
}

/** 出生地：常用城市／全球城市（geonameid）／手動經緯度（只限代客建單） */
export type ProxyPlace =
  | { continent: string; country: string; city: string; geonameid?: number }
  | { manual: true; lat: number; lon: number; tz: string; city: string; country: string };

export interface CreateProxyOrderRequest {
  channel_id: number;
  external_order_id: string;
  external_sku?: string;
  currency: string;
  /** 主單位字串，例如 "899.00"；後端換成最小單位 */
  amount: string;
  language: string;
  customer_id?: number;
  customer?: { display_name: string; platform_handle?: string; contact_note?: string };
  book?: { cover_name?: string; cover_style?: string; dedication?: string };
  order: {
    variant: 'digital' | 'physical';
    subject_name: string;
    gender: '男' | '女';
    relation_label: string;
    birth: { date: string; time: string; time_type: 'clock_time' | 'solar_time' };
    place: ProxyPlace;
    audience: { reader: string; call_name: string; dedication: string };
    shipping?: ShippingInfo & { country?: string };
    physical?: PhysicalSelection;
  };
  sources: { kind: Exclude<SourceKind, 'screenshot'>; occurred_on?: string; summary?: string; url?: string }[];
}

export type ProofDecision = 'approved' | 'changes_requested' | 'auto_approved' | 'admin_approved' | 'superseded';

export interface ProofVersion {
  id: number;
  version: number;
  filename: string;
  bytes: number;
  /** 管理者給會員看的這版說明 */
  admin_note: string | null;
  created_at: string | null;
  /** 會員回覆期限；過了沒回應就自動確認送印 */
  due_at: string | null;
  decision: ProofDecision | null;
  decision_label: string | null;
  comment: string | null;
  decided_at: string | null;
}

export interface ProofsView {
  versions: ProofVersion[];
  /** 等待會員確認的那一版；沒有則為 null */
  pending: ProofVersion | null;
  revisions_left: number;
  free_revisions: number;
  response_days: number;
}

export interface PhysicalView {
  id: number;
  /** 打樣：歷次版本、等待確認的版本、剩餘免費修改次數 */
  proofs: ProofsView;
  /** 報告 PDF 已上傳（可以開始設計） */
  report_ready: boolean;
  /** 設計狀態；還沒開始設計為 null */
  design_status: 'draft' | 'submitted' | 'confirmed' | null;
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
  /** 會員填的方便時段（付款後、約好時間前可填） */
  preferences: ConsultPreferences | null;
  preferences_at: string | null;
  cancelled_at: string | null;
  refund_due: number | null;
  refunded_at: string | null;
}

export type ConsultPeriod = 'morning' | 'afternoon' | 'evening';
export const CONSULT_PERIOD_LABELS: Record<ConsultPeriod, string> = { morning: '上午', afternoon: '下午', evening: '晚上' };

export interface ConsultPreferences {
  /** date 為 YYYY-MM-DD（明天起 60 天內），最多 3 個 */
  slots: { date: string; period: ConsultPeriod }[];
  note: string;
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
  commerce?: CommerceSummary;
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
  /** 報告成品檔（已付款的報告訂單、管理者已上傳時才有） */
  report: ReportDocumentView | null;
  /** 這張訂單的實體書 */
  physical: PhysicalView | null;
  /** 這張訂單的專人解讀 */
  consult: ConsultView | null;
  /** 這份報告事後加購的訂單 */
  addons: AddonChild[];
  /** 已付款的報告訂單才有：現在能加購什麼 */
  addon_offer: { physical: boolean; consult: boolean; available: boolean } | null;
}

export interface ReportDocumentView {
  id: number;
  filename: string;
  bytes: number;
  uploaded_at: string | null;
}

export interface AdminDelivery {
  order_no: string;
  item_no: string;
  name: string;
  variant: string;
  subject_name: string | null;
  call_name: string | null;
  buyer_email: string | null;
  paid_at: string | null;
  document: ReportDocumentView | null;
  chart: DeliveryChart;
  /** 交給紫微建立工作單的狀態（付款後由背景排程送出） */
  handoff: HandoffView | null;
}

export type HandoffStatus = 'not_ready' | 'pending' | 'sent' | 'failed' | 'cancelled';

export interface HandoffView {
  status: HandoffStatus;
  status_label: string;
  attempts: number;
  error: string | null;
  sent_at: string | null;
  /** 紫微工作單狀態（queued／in_progress／needs_info／completed…），送出當下的快照 */
  ziwei_status: string | null;
  next_attempt_at: string | null;
}

/** 製作報告用的命盤資訊：到紫微系統（PolarisUI）找這張盤的依據 */
export interface DeliveryChart {
  chart_id: string | null;
  gender: string | null;
  /** 客人原始填寫 */
  birth_date: string | null;
  birth_time: string | null;
  time_type: 'clock_time' | 'solar_time' | null;
  place: string | null;
  /** 實際排盤用的時間（換算真太陽時／扣夏令時之後）＝ PolarisUI 顯示的 Clock time */
  used_time: string | null;
  dst_minutes: number;
  /** {ZIWEI_WORKBENCH_URL}/progress?chart_id=…；後端沒設網址時為 null */
  workbench_url: string | null;
}

export interface AdminReportOrder extends ReportOrderSummary {
  buyer_email: string | null;
}

export interface CommerceBackfillReview {
  order_no: string;
  decision: 'review_required' | 'blocked' | 'skip_unpaid' | 'already_tracked';
  apply_enabled: boolean;
  reasons: { code: string; message: string }[];
  owner_id?: number;
  amount?: number;
  currency?: string;
  payment_attempt_id?: number;
  review_token?: string;
  valid_for_seconds?: number;
  lines: {
    item_no: string; name: string; original_unit_amount: number; original_quantity: number;
    unit_amount: number; quantity: number; line_total: number; print_copies: number;
    components: { label: string; amount: number }[];
    grants: { kind: string; units: number; status: string; target_kind: string; target_id: number }[];
  }[];
}

export interface ActivationView {
  id: number;
  status: 'issued' | 'expired' | 'redeemed' | 'revoked';
  recipient_id: number;
  expires_at: string;
  redeemed_at: string | null;
}

export interface CommerceSummary {
  external?: { receipt_id: number | null; evidence_status: string; fulfilment_blocked: boolean } | null;
    version: number;
    activation_enabled?: boolean;
    source?: string;
    migration?: string;
    lines?: { item_no: string; unit_amount: number; quantity: number; line_total: number;
      currency: string; print_copies: number; components: { label: string; amount: number }[] }[];
    entitlements: { id: number; item_no: string; kind: string; unit_index: number; holder_id: number;
      operator_id: number; status: string; revoke_reason: string | null;
      activation?: ActivationView | null;
      rights: { print_copies?: number; minutes?: number };
      task: { id: number; status: string; target_kind: string; target_id: number } | null }[];
}

export interface AdminPrintJob extends PhysicalView {
  currency: string;
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
  pages: any;
  /** 客人的設計（設計頁內容、照片憑證、報告 PDF 憑證）；還沒開始設計為 null */
  design: DesignView | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  refund_note: string | null;
  shipping: {
    recipient_name: string; recipient_phone: string; postal_code: string | null; address: string; status: string;
    carrier: string | null; tracking_no: string | null; print_sent_at: string | null; shipped_at: string | null;
  } | null;
}

export type PrintJobAction = 'printing' | 'shipped' | 'delivered' | 'cancel' | 'refund' | 'grant_revision' | 'approve_proof';

export interface AdminConsultation extends ConsultView {
  currency: string;
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

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface AdminNotification {
  id: number;
  order_no: string | null;
  event: string;
  event_label: string;
  recipient: string;
  status: NotificationStatus;
  attempts: number;
  max_attempts: number;
  error: string | null;
  created_at: string | null;
  sent_at: string | null;
  subject: string | null;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  can_resend: boolean;
  body?: string | null;
}

export interface JobRunStatus {
  job: string;
  label: string;
  every_seconds: number;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_status: 'ok' | 'error' | null;
  last_result: Record<string, unknown> | null;
  last_error: string | null;
}

export interface JobsStatus {
  enabled: boolean;
  interval_seconds: number;
  jobs: JobRunStatus[];
}

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
  /** 付款前設計好的草稿（連到這次加購的實體書） */
  design_id?: number;
}

// ── 設計你的書 ───────────────────────────────────────────────────────────

export type AnnotationType = 'text' | 'image' | 'fix';

export interface DesignAnnotation {
  id: string;
  /** 報告 PDF 的頁碼（1 起算） */
  page: number;
  type: AnnotationType;
  text: string;
  asset_ids: number[];
}

export interface DesignSpread {
  index: number;
  /** 插在報告第幾頁之後；null＝還沒選位置 */
  after_page: number | null;
  text: string;
  asset_ids: number[];
}

export interface DesignData {
  cover_name: string;
  cover_style: string;
  cover_asset_id: number | null;
  dedication: string;
  annotations: DesignAnnotation[];
  spreads: DesignSpread[];
}

export interface DesignAsset {
  id: number;
  filename: string;
  bytes: number;
  content_type: string;
  /** 用 privateFileUrl(token) 顯示 */
  token: string;
}

export interface DesignView {
  id: number;
  status: 'draft' | 'submitted' | 'confirmed';
  editable: boolean;
  data: DesignData;
  assets: DesignAsset[];
  /** 已購買的特殊客製與跨頁數；付款前的草稿為 null（由加購頁的選擇決定） */
  purchased: { custom: CustomKey[]; spreads: number } | null;
  /** 確認前還沒完成的項目 */
  problems: string[];
  confirmable: boolean;
  order_no: string | null;
  report_order_no: string;
  /** 報告 PDF 的檔案憑證（整本預覽用） */
  report_token: string | null;
  confirmed_at: string | null;
}

/** 私有檔案（報告 PDF、照片）的網址：短效憑證，不需要登入標頭 */
export const privateFileUrl = (token: string) => `${getBaseUrl()}/report-files/${token}`;

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const reportOrdersApi = {
  reviewBackfill: (orderNo: string) => request<{ success: boolean; review: CommerceBackfillReview }>(
    `/admin/report-orders/${encodeURIComponent(orderNo)}/commerce-review`),
  applyBackfill: (orderNo: string, review_token: string, note: string, confirmed: boolean) =>
    post<{ success: boolean; changed: boolean; order: AdminReportOrder }>(
      `/admin/report-orders/${encodeURIComponent(orderNo)}/commerce-review`, { review_token, note, confirmed }),
  issueActivation: (entitlementId: number, days = 14) =>
    post<{ success: boolean; activation_id: number; code: string; recipient_id: number; expires_at: string }>(
      `/admin/report-entitlements/${entitlementId}/activation`, { days }),
  revokeActivation: (activationId: number, reason: string) =>
    post<{ success: boolean }>(`/admin/report-activations/${activationId}/revoke`, { reason }),
  redeemActivation: (code: string, orderNo: string) =>
    post<{ success: boolean; redeemed: boolean; order: ReportOrderSummary }>('/report-activations/redeem',
      { code, order_no: orderNo }),
  paymentMode: () =>
    request<{ success: boolean; mode: PaymentMode | string; available: boolean; deadline_days: number | null }>(
      '/report-payment-mode'
    ),

  physicalConfig: () => request<{ success: boolean; config: PhysicalConfig }>('/report-physical-config'),

  create: (body: CreateReportOrderRequest) =>
    post<{ success: boolean; created: boolean; order: ReportOrderSummary }>('/report-orders', body),

  list: () => request<{ success: boolean; orders: ReportOrderSummary[] }>('/report-orders'),

  consultPreferences: (orderNo: string, body: ConsultPreferences) =>
    post<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}/consult-preferences`, body),

  get: (orderNo: string) =>
    request<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}`),

  reportTransfer: (orderNo: string, body: TransferReportRequest) =>
    post<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}/transfer`, body),

  createAddon: (orderNo: string, body: CreateAddonRequest) =>
    post<{ success: boolean; created: boolean; order: ReportOrderSummary }>(
      `/report-orders/${encodeURIComponent(orderNo)}/addons`, body
    ),

  /** 報告 PDF 的短效網址（10 分鐘）；加 ?download=1 會下載，否則在瀏覽器開啟 */
  reportPdfLink: (orderNo: string) =>
    post<{ success: boolean; url: string; document: ReportDocumentView }>(
      `/report-orders/${encodeURIComponent(orderNo)}/report-pdf/link`, {}
    ),

  designDraft: (orderNo: string) =>
    post<{ success: boolean; design: DesignView }>(`/report-orders/${encodeURIComponent(orderNo)}/design-draft`, {}),

  orderDesign: (orderNo: string) =>
    request<{ success: boolean; design: DesignView }>(`/report-orders/${encodeURIComponent(orderNo)}/design`),

  getDesign: (id: number) => request<{ success: boolean; design: DesignView }>(`/report-designs/${id}`),

  saveDesign: (id: number, data: DesignData, pageCount?: number) =>
    request<{ success: boolean; design: DesignView }>(`/report-designs/${id}`, {
      method: 'PUT', body: JSON.stringify({ data, page_count: pageCount }),
    }),

  uploadDesignAsset: (id: number, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ success: boolean; asset: DesignAsset }>(`/report-designs/${id}/assets`, { method: 'POST', body });
  },

  deleteDesignAsset: (id: number, assetId: number) =>
    request<{ success: boolean; design: DesignView }>(`/report-designs/${id}/assets/${assetId}`, { method: 'DELETE' }),

  confirmDesign: (id: number) => post<{ success: boolean; design: DesignView }>(`/report-designs/${id}/confirm`, {}),

  proofLink: (orderNo: string, proofId: number) =>
    post<{ success: boolean; url: string }>(`/report-orders/${encodeURIComponent(orderNo)}/proofs/${proofId}/link`, {}),

  proofDecision: (orderNo: string, body: { proof_id: number; decision: 'approve' | 'changes'; comment?: string }) =>
    post<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}/proof-decision`, body),

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

  adminDeliveries: (status = 'pending') =>
    request<{ success: boolean; deliveries: AdminDelivery[]; counts: Record<string, number> }>(
      '/admin/report-deliveries', { params: { status } }
    ),

  adminSendHandoff: (orderNo: string) =>
    post<{ success: boolean; handoff: HandoffView }>(`/admin/report-orders/${encodeURIComponent(orderNo)}/handoff`, {}),

  adminOrdersOverview: (params: { q?: string; status?: string; needs?: 'all' | 'admin' | 'member' }) =>
    request<{ success: boolean; orders: AdminOrderRow[]; counts: { admin: number; member: number } }>(
      '/admin/report-orders/overview', { params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string> }
    ),

  adminOrderDetail: (orderNo: string) =>
    request<{ success: boolean; order: AdminOrderDetail }>(`/admin/report-orders/${encodeURIComponent(orderNo)}/detail`),

  adminOrderNote: (orderNo: string, note: string) =>
    post<{ success: boolean; timeline: TimelineEntry[] }>(`/admin/report-orders/${encodeURIComponent(orderNo)}/notes`, { note }),

  adminUploadProof: (jobId: number, file: File, note: string) => {
    const body = new FormData();
    body.append('file', file);
    body.append('note', note);
    return request<{ success: boolean; job: AdminPrintJob }>(`/admin/report-print-jobs/${jobId}/proofs`, { method: 'POST', body });
  },

  adminProofLink: (jobId: number, proofId: number) =>
    post<{ success: boolean; url: string }>(`/admin/report-print-jobs/${jobId}/proofs/${proofId}/link`, {}),

  adminUploadReportPdf: (orderNo: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ success: boolean; document: ReportDocumentView; first_time: boolean }>(
      `/admin/report-orders/${encodeURIComponent(orderNo)}/report-pdf`, { method: 'POST', body }
    );
  },

  adminReportPdfLink: (orderNo: string) =>
    post<{ success: boolean; url: string }>(`/admin/report-orders/${encodeURIComponent(orderNo)}/report-pdf/link`, {}),

  adminConsultations: (status = 'all') =>
    request<{ success: boolean; consultations: AdminConsultation[]; counts: Record<string, number> }>(
      '/admin/report-consultations', { params: { status } }
    ),

  adminConsultationAction: (id: number, action: ConsultAction, body: Record<string, unknown> = {}) =>
    post<{ success: boolean; consultation: AdminConsultation }>(`/admin/report-consultations/${id}/${action}`, body),

  adminNotifications: (status: NotificationStatus | 'all' = 'failed', q = '') =>
    request<{ success: boolean; notifications: AdminNotification[]; counts: Partial<Record<NotificationStatus, number>>; jobs: JobsStatus }>(
      '/admin/report-notifications', { params: q ? { status, q } : { status } }
    ),

  adminNotification: (id: number) =>
    request<{ success: boolean; notification: AdminNotification }>(`/admin/report-notifications/${id}`),

  // ── 外部平台代客建單 ──
  proxyConfig: () => request<{ success: boolean } & ProxyConfig>('/admin/proxy-orders/config'),

  externalCustomers: (q = '') =>
    request<{ success: boolean; customers: ExternalCustomer[] }>('/admin/external-customers', { params: q ? { q } : {} }),

  externalCustomer: (id: number) =>
    request<{ success: boolean; customer: ExternalCustomer }>(`/admin/external-customers/${id}`),

  createExternalCustomer: (body: { display_name: string; platform_handle?: string; contact_note?: string }) =>
    post<{ success: boolean; customer: ExternalCustomer }>('/admin/external-customers', body),

  updateExternalCustomer: (id: number, body: { display_name: string; platform_handle?: string | null; contact_note?: string | null }) =>
    request<{ success: boolean; customer: ExternalCustomer }>(`/admin/external-customers/${id}`, {
      method: 'PUT', body: JSON.stringify(body),
    }),

  createProxyOrder: (body: CreateProxyOrderRequest) =>
    post<{ success: boolean; created: boolean; order_no: string }>('/admin/proxy-orders', body),

  addOrderSource: (orderNo: string, body: { kind: Exclude<SourceKind, 'screenshot'>; occurred_on?: string; summary?: string; url?: string }) =>
    post<{ success: boolean; sources: OrderSource[] }>(`/admin/report-orders/${encodeURIComponent(orderNo)}/sources`, body),

  uploadOrderSource: (orderNo: string, file: File, summary: string, occurredOn: string) => {
    const body = new FormData();
    body.append('file', file);
    body.append('summary', summary);
    if (occurredOn) body.append('occurred_on', occurredOn);
    return request<{ success: boolean; sources: OrderSource[] }>(
      `/admin/report-orders/${encodeURIComponent(orderNo)}/sources/upload`, { method: 'POST', body });
  },

  orderSourceLink: (orderNo: string, id: number) =>
    post<{ success: boolean; url: string }>(`/admin/report-orders/${encodeURIComponent(orderNo)}/sources/${id}/link`, {}),

  deliveredViaPlatform: (orderNo: string, note?: string) =>
    post<{ success: boolean; order: AdminOrderDetail }>(
      `/admin/report-orders/${encodeURIComponent(orderNo)}/delivered-via-platform`, { note }),

  adminResendNotification: (id: number) =>
    post<{ success: boolean; notification: AdminNotification }>(`/admin/report-notifications/${id}/resend`, {}),
};
