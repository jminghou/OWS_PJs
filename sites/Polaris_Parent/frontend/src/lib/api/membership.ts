/**
 * 會員商業循環 API client（會員端）
 * 對應後端 sites/Polaris_Parent/backend/extensions/membership
 *   GET    /api/v1/membership/products
 *   POST   /api/v1/membership/order-submissions
 *   GET    /api/v1/membership/order-submissions
 *   GET    /api/v1/membership/rewards
 *   GET    /api/v1/membership/saved-articles
 *   POST   /api/v1/membership/saved-articles
 *   DELETE /api/v1/membership/saved-articles/:contentId
 */
import { request } from './client';

export interface ExternalProduct {
  id: number;
  name: string;
  platform: string | null;
  external_url: string | null;
  active: boolean;
}

export interface OrderSubmission {
  id: number;
  platform: string;
  external_order_no: string;
  status: '待審核' | '通過' | '退回';
  note: string | null;
  chart_id: number | null;
  product_name: string;
  coupon_code: string | null;
  created_at: string | null;
  reviewed_at: string | null;
}

export interface MemberReward {
  id: number;
  coupon_code_snapshot: string;
  granted_at: string | null;
  platform: string;
  product_name: string;
}

export interface SavedArticle {
  id: number;
  content_id: number;
  related_chart_id: number | null;
  saved_at: string | null;
  title: string;
  slug: string;
  language: string;
}

export interface CreateOrderSubmissionRequest {
  product_type_id: number;
  platform: string;
  external_order_no: string;
  chart_id?: number | string | null;
  note?: string;
}

export const membershipApi = {
  /** 可下單的外部商品（active）。 */
  products: () =>
    request<{ success: boolean; products: ExternalProduct[] }>('/membership/products'),

  /** 登錄外部訂單號（status=待審核）。 */
  submitOrder: (body: CreateOrderSubmissionRequest) =>
    request<{ success: boolean; id: number; status: string }>('/membership/order-submissions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 退回後修正並重送（沿用原筆改回待審核）。 */
  resubmitOrder: (id: number, body: { external_order_no?: string; note?: string }) =>
    request<{ success: boolean; status: string }>(`/membership/order-submissions/${id}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** 我的訂單提交（含商品名與已發折扣碼）。 */
  myOrderSubmissions: () =>
    request<{ success: boolean; submissions: OrderSubmission[] }>('/membership/order-submissions'),

  /** 我的折扣券。 */
  myRewards: () =>
    request<{ success: boolean; rewards: MemberReward[] }>('/membership/rewards'),

  /** 收藏文章列表。 */
  savedArticles: () =>
    request<{ success: boolean; articles: SavedArticle[] }>('/membership/saved-articles'),

  /** 收藏一篇站內文章（可關聯命盤）。 */
  saveArticle: (contentId: number, relatedChartId?: number | string | null) =>
    request<{ success: boolean; id?: number; already?: boolean }>('/membership/saved-articles', {
      method: 'POST',
      body: JSON.stringify({ content_id: contentId, related_chart_id: relatedChartId ?? null }),
    }),

  /** 取消收藏。 */
  unsaveArticle: (contentId: number) =>
    request<{ success: boolean }>(`/membership/saved-articles/${contentId}`, {
      method: 'DELETE',
    }),
};
