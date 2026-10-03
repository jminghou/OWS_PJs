/**
 * 客製報告訂單 API client（會員 v2）
 * 對應後端 sites/Polaris_Parent/backend/extensions/report_orders
 *   GET  /api/v1/report-payment-mode                                 （公開）
 *   POST /api/v1/report-orders                                       （會員）
 *   GET  /api/v1/report-orders                                       （會員）
 *   GET  /api/v1/report-orders/:orderNo                              （會員）
 *   POST /api/v1/report-orders/:orderNo/transfer                     （會員，人工收款回報）
 *   GET  /api/v1/admin/report-orders                                 （report_orders.read）
 *   POST /api/v1/admin/report-orders/:orderNo/confirm-payment        （report_orders.confirm_payment）
 *   POST /api/v1/admin/report-orders/:orderNo/reject-transfer        （report_orders.confirm_payment）
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

export interface CreateReportOrderRequest extends Omit<ReportDraft, 'submission_key'> {
  submission_key: string;
  policy_consented: boolean;
  policy_version: string;
  shipping?: ShippingInfo;
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
  item: { item_no: string; name: string; variant: string; subject_name: string; call_name: string } | null;
  production: { handoff_status: string; ziwei_status: string | null; member_note: string | null } | null;
  shipment: { status: string; carrier: string | null; tracking_no: string | null } | null;
}

export interface AdminReportOrder extends ReportOrderSummary {
  buyer_email: string | null;
}

export interface TransferReportRequest {
  last5: string;
  transferred_on: string;
  amount: number;
  note?: string;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const reportOrdersApi = {
  paymentMode: () =>
    request<{ success: boolean; mode: PaymentMode | string; available: boolean; deadline_days: number | null }>(
      '/report-payment-mode'
    ),

  create: (body: CreateReportOrderRequest) =>
    post<{ success: boolean; created: boolean; order: ReportOrderSummary }>('/report-orders', body),

  list: () => request<{ success: boolean; orders: ReportOrderSummary[] }>('/report-orders'),

  get: (orderNo: string) =>
    request<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}`),

  reportTransfer: (orderNo: string, body: TransferReportRequest) =>
    post<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}/transfer`, body),

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
};
