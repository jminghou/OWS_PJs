import { orderApi } from './api';
import { OrderItem, ApiError } from '@/types';

export interface CheckoutOptions {
  currency?: string;
  language?: string;
  payment_method?: string;
}

export const handleCheckout = async (
  items: OrderItem[],
  amount: number,
  options?: CheckoutOptions
) => {
  try {
    const response = await orderApi.create({
      items,
      amount,
      currency: options?.currency || 'TWD',
      language: options?.language || 'zh-TW',
      payment_method: options?.payment_method,
    });

    if (response.payment_url) {
      // 轉導至付款頁面 (開發模式下為模擬頁面，正式模式為金流商頁面)
      window.location.href = response.payment_url;
    } else {
      console.error('No payment URL received');
      alert('無法取得付款連結');
    }
  } catch (error) {
    console.error('Checkout failed', error);

    // 檢查是否為認證錯誤
    const apiError = error as ApiError;
    if (apiError.status === 401) {
      alert('請先登入後再進行購買');
      window.location.href = '/admin/login';
    } else {
      alert(apiError.message || '建立訂單失敗，請稍後再試');
    }

    throw error; // 重新拋出錯誤，讓呼叫者知道失敗了
  }
};

