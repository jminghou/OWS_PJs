/**
 * 客製報告訂單 API client（會員 v2）
 * 對應後端 sites/Polaris_Parent/backend/extensions/report_orders（皆需登入）
 *   POST /api/v1/report-orders
 *   GET  /api/v1/report-orders
 *   GET  /api/v1/report-orders/:orderNo
 */
import { request } from '@ows/platform-api/client';
import type { ReportDraft } from '@/lib/report/draft';

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

export interface ReportOrderSummary {
  order_no: string;
  status: string;
  amount: number;
  currency: string;
  payment_mode: string;
  created_at: string | null;
  item: { item_no: string; name: string; variant: string; subject_name: string; call_name: string } | null;
  production: { handoff_status: string; ziwei_status: string | null; member_note: string | null } | null;
  shipment: { status: string; carrier: string | null; tracking_no: string | null } | null;
}

export const reportOrdersApi = {
  create: (body: CreateReportOrderRequest) =>
    request<{ success: boolean; created: boolean; order: ReportOrderSummary }>('/report-orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  list: () => request<{ success: boolean; orders: ReportOrderSummary[] }>('/report-orders'),

  get: (orderNo: string) =>
    request<{ success: boolean; order: ReportOrderSummary }>(`/report-orders/${encodeURIComponent(orderNo)}`),
};
