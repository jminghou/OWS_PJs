import type {
  Product,
  ProductAdmin,
  ProductListResponse,
  ProductAdminListResponse,
  CreateProductData,
  ProductPrice,
  ProductPriceListResponse,
  CreateProductPriceData,
  ProductTranslationListResponse,
} from '@/types';
import { request, type FetchOptions } from './client';

export const productApi = {
  getList: async (params?: {
    page?: number;
    per_page?: number;
    category_id?: number;
    is_featured?: boolean;
    search?: string;
    language?: string;
    currency?: string;
  }, options: FetchOptions = {}): Promise<ProductListResponse> => {
    return request<ProductListResponse>('/products', {
      params,
      ...options
    });
  },

  getById: async (
    productId: string | number,
    language?: string,
    currency?: string,
    options: FetchOptions = {}
  ): Promise<Product> => {
    const params: any = {};
    if (language) params.language = language;
    if (currency) params.currency = currency;
    return request<Product>(`/products/${productId}`, {
      params,
      ...options
    });
  },

  adminGetList: async (params?: {
    page?: number;
    per_page?: number;
    is_active?: string;
    search?: string;
  }): Promise<ProductAdminListResponse> => {
    return request<ProductAdminListResponse>('/admin/products', { params });
  },

  adminGetById: async (id: number): Promise<ProductAdmin> => {
    return request<ProductAdmin>(`/admin/products/${id}`);
  },

  adminCreate: async (data: CreateProductData): Promise<{ message: string; id: number }> => {
    return request<{ message: string; id: number }>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  adminUpdate: async (id: number, data: Partial<CreateProductData>): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  adminDelete: async (id: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/products/${id}`, {
      method: 'DELETE',
    });
  },

  adminToggleStatus: async (id: number): Promise<{ message: string; is_active: boolean }> => {
    return request<{ message: string; is_active: boolean }>(`/admin/products/${id}/toggle-status`, {
      method: 'POST',
    });
  },

  adminGetPrices: async (productId: number): Promise<ProductPriceListResponse> => {
    return request<ProductPriceListResponse>(`/admin/products/${productId}/prices`);
  },

  adminCreatePrice: async (
    productId: number,
    data: CreateProductPriceData
  ): Promise<{ message: string; price: ProductPrice }> => {
    return request<{ message: string; price: ProductPrice }>(`/admin/products/${productId}/prices`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  adminUpdatePrice: async (
    productId: number,
    priceId: number,
    data: Partial<CreateProductPriceData>
  ): Promise<{ message: string; price: ProductPrice }> => {
    return request<{ message: string; price: ProductPrice }>(`/admin/products/${productId}/prices/${priceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  adminDeletePrice: async (productId: number, priceId: number): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/products/${productId}/prices/${priceId}`, {
      method: 'DELETE',
    });
  },

  adminGetTranslations: async (productId: number): Promise<ProductTranslationListResponse> => {
    return request<ProductTranslationListResponse>(`/admin/products/${productId}/translations`);
  },

  adminCreateTranslation: async (
    productId: number,
    data: { language: string }
  ): Promise<{ message: string; product: Product }> => {
    return request<{ message: string; product: Product }>(`/admin/products/${productId}/translations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  adminUpdateSortOrder: async (
    sortOrders: Array<{ id: number; sort_order: number }>
  ): Promise<{ message: string }> => {
    return request<{ message: string }>('/admin/products/sort-order', {
      method: 'PUT',
      body: JSON.stringify({ sort_orders: sortOrders }),
    });
  },
};
