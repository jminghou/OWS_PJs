import type { ApiError } from '@/types';

const getBaseUrl = () => {
  // 如果有環境變數就用環境變數，否則預設連向本地 5000
  if (typeof window === 'undefined') {
    return process.env.NEXT_SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api/v1';
};

export const API_URL = getBaseUrl();

/**
 * 自定義請求錯誤類別，繼承自 Error 以便正確顯示錯誤訊息
 */
export class RequestError extends Error implements ApiError {
  status?: number;
  errors?: Record<string, string | string[]>;

  constructor(message: string, status?: number, errors?: Record<string, string | string[]>) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.errors = errors;
  }
}

/**
 * 從瀏覽器 cookie 中讀取 CSRF token
 * Flask-JWT-Extended 會將 CSRF token 設為非 httpOnly cookie
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Token refresh 狀態管理（避免多個請求同時觸發 refresh）
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function getCsrfRefreshToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_refresh_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const csrfRefresh = getCsrfRefreshToken();
      if (csrfRefresh) {
        headers['X-CSRF-TOKEN'] = csrfRefresh;
      }
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export type FetchOptions = RequestInit & {
  params?: Record<string, any>;
  _retried?: boolean; // 內部使用：標記是否已重試
};

export async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, _retried, ...init } = options;

  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // 對非 GET 請求附加 CSRF token（Flask-JWT-Extended CSRF 保護）
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-TOKEN', csrfToken);
    }
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      // 401 且尚未重試 → 嘗試 refresh token 後重試
      if (response.status === 401 && !_retried && !endpoint.includes('/auth/refresh')) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return request<T>(endpoint, { ...options, _retried: true });
        }
      }

      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }

      throw new RequestError(
        errorData.message || 'An error occurred',
        response.status,
        errorData.errors
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  } catch (error: any) {
    if (error instanceof RequestError) throw error;

    throw new RequestError(error.message || 'Network error');
  }
}
