import { API_URL, request } from '@ows/platform-api/client';
import type { Subscriber, SubscriberListResponse, SubscriberStatus } from './types';

export interface SubscribeInput {
  email: string;
  locale: string;
  /** 表單出現的位置（home-hero / home-footer …），供後台分辨來源 */
  source: string;
  /** honeypot：真人不會填，送出時原樣帶給後端 */
  website?: string;
}

const EXPORT_PATH = '/newsletter/admin/subscribers/export';

export const newsletterApi = {
  subscribe: (input: SubscribeInput) =>
    request<{ message: string }>('/newsletter/subscribe', { method: 'POST', body: JSON.stringify(input) }),

  confirm: (token: string) =>
    request<{ message: string; status: SubscriberStatus }>('/newsletter/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  unsubscribe: (token: string) =>
    request<{ message: string; status: SubscriberStatus }>('/newsletter/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  listSubscribers: (params: { status?: SubscriberStatus; q?: string; page?: number; per_page?: number } = {}) =>
    request<SubscriberListResponse>('/newsletter/admin/subscribers', { params, cache: 'no-store' }),

  deleteSubscriber: (id: Subscriber['id']) =>
    request<{ message: string }>(`/newsletter/admin/subscribers/${id}`, { method: 'DELETE' }),

  /** 下載 CSV。用 fetch 取 blob 而不是直接開連結，權限不足或登入過期時才能顯示錯誤。 */
  downloadCsv: async (status?: SubscriberStatus | 'all'): Promise<void> => {
    const url = `${API_URL}${EXPORT_PATH}${status ? `?status=${encodeURIComponent(status)}` : ''}`;
    let response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (response.status === 401) {
      // access token 過期：借 request() 既有的 refresh 流程換一次 token 再重試
      await newsletterApi.listSubscribers({ per_page: 1 });
      response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    }
    if (!response.ok) {
      throw new Error(response.status === 403 ? '沒有匯出訂閱者的權限' : `匯出失敗（${response.status}）`);
    }
    const filename = /filename=([^;]+)/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'subscribers.csv';
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  },
};
