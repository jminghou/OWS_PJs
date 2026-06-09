/**
 * 會員商業循環 API client（管理端）
 * 對應後端 sites/Polaris_Parent/backend/extensions/membership 的 /admin/* 路由
 *   GET  /api/v1/admin/order-submissions?status=
 *   POST /api/v1/admin/order-submissions/:id/approve
 *   POST /api/v1/admin/order-submissions/:id/reject
 *   GET/POST/PATCH/DELETE /api/v1/admin/product-types
 *   GET/POST/PATCH        /api/v1/admin/coupon-configs
 */
import { request } from './client';
import type { ExternalProduct } from './membership';

export interface AdminOrderSubmission {
  id: number;
  member_id: number;
  member_email: string | null;
  chart_id: number | null;
  platform: string;
  external_order_no: string;
  status: '待審核' | '通過' | '退回';
  note: string | null;
  product_name: string;
  coupon_code: string | null;
  created_at: string | null;
  reviewed_at: string | null;
}

export interface CouponConfig {
  id: number;
  code: string;
  platform: string | null;
  discount_desc: string | null;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
}

export const adminCommerceApi = {
  // ── 訂單審核 ──
  orderSubmissions: (status = '待審核') =>
    request<{ success: boolean; submissions: AdminOrderSubmission[] }>(
      '/admin/order-submissions',
      { params: { status } }
    ),

  approveOrder: (id: number) =>
    request<{ success: boolean; coupon_code?: string; already_granted?: boolean }>(
      `/admin/order-submissions/${id}/approve`,
      { method: 'POST' }
    ),

  rejectOrder: (id: number, note: string) =>
    request<{ success: boolean }>(`/admin/order-submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  // ── 外部商品維護 ──
  productTypes: () =>
    request<{ success: boolean; products: ExternalProduct[] }>('/admin/product-types'),

  createProductType: (body: Partial<ExternalProduct>) =>
    request<{ success: boolean; product: ExternalProduct }>('/admin/product-types', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateProductType: (id: number, body: Partial<ExternalProduct>) =>
    request<{ success: boolean; product: ExternalProduct }>(`/admin/product-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteProductType: (id: number) =>
    request<{ success: boolean; deactivated?: boolean; message?: string }>(
      `/admin/product-types/${id}`,
      { method: 'DELETE' }
    ),

  // ── 折扣碼設定 ──
  couponConfigs: () =>
    request<{ success: boolean; coupons: CouponConfig[] }>('/admin/coupon-configs'),

  createCouponConfig: (body: Partial<CouponConfig>) =>
    request<{ success: boolean; coupon: CouponConfig }>('/admin/coupon-configs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCouponConfig: (id: number, body: Partial<CouponConfig>) =>
    request<{ success: boolean; coupon: CouponConfig }>(`/admin/coupon-configs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
