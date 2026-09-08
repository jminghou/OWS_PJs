import type {
  OrderListResponse,
  OrderCreateData,
  OrderCreateResponse,
  PaymentMethod,
  PaymentMethodListResponse,
} from './types';
import { request, type FetchOptions } from './client';

export const orderApi = {
  create: async (data: OrderCreateData): Promise<OrderCreateResponse> => {
    return request<OrderCreateResponse>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getList: async (params?: {
    page?: number;
    per_page?: number;
  }): Promise<OrderListResponse> => {
    return request<OrderListResponse>('/orders', { params });
  },

  mockPaymentWebhook: async (orderNo: string, status: 'success' | 'failed'): Promise<{ message: string }> => {
    return request<{ message: string }>('/webhooks/mock-payment', {
      method: 'POST',
      body: JSON.stringify({
        order_no: orderNo,
        status,
      }),
    });
  },
};

export const paymentMethodApi = {
  getList: async (params?: {
    currency?: string;
    language?: string;
  }, options: FetchOptions = {}): Promise<PaymentMethodListResponse> => {
    return request<PaymentMethodListResponse>('/payment-methods', {
      params,
      ...options
    });
  },

  adminCreate: async (data: {
    code: string;
    name: Record<string, string>;
    description?: Record<string, string>;
    supported_currencies: string[];
    is_active?: boolean;
    config?: Record<string, any>;
    sort_order?: number;
  }): Promise<{ message: string; payment_method: PaymentMethod }> => {
    return request<{ message: string; payment_method: PaymentMethod }>('/admin/payment-methods', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// 已移除（P2 契約比對）：core 的 ecommerce 只提供
//   GET  /payment-methods          （列表）
//   GET  /admin/payment-methods    （列表）
//   POST /admin/payment-methods    （新增）
// 沒有單筆讀取／更新／刪除。原本的 paymentMethodApi.getById / adminUpdate /
// adminDelete 會直接 404，且兩個站台都沒有呼叫，故刪除。
