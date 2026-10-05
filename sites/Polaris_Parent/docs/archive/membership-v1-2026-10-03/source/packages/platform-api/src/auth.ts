import type { User, LoginCredentials } from './types';
import { request } from './client';

export interface LoginResponse {
  user: User;
}

/**
 * 會員註冊。
 *
 * email / password 是平台契約；其餘欄位原樣送給後端，由站台登記的 signup hook
 * 處理（見 core/backend_engine/services/member_auth.py 的 `on_member_signup`）。
 *
 * 這裡刻意**不**列出領域欄位 —— 註冊時要不要順便歸戶一張命盤，是 Polaris 的事，
 * 不是平台 API client 該知道的。Polaris 在 lib/api/auth.ts 用站台型別收窄它。
 */
export interface RegisterPayload {
  email: string;
  password: string;
  [domainField: string]: unknown;
}

export interface RegisterResponse {
  success: boolean;
  user: User;
  /**
   * 註冊成功、但站台的 signup hook 有步驟失敗時的提示。
   * 例如 Polaris：「註冊已完成，但命盤儲存失敗」。
   */
  warning?: string | null;
  /** signup hook 併入的額外欄位（Polaris 會帶 chart_id）。 */
  [extra: string]: unknown;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /** 會員註冊（email + 密碼），成功即建立登入狀態（JWT cookies）。 */
  register: async (payload: RegisterPayload): Promise<RegisterResponse> => {
    return request<RegisterResponse>('/auth/member/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** 以設定密碼信的 token 設定密碼。 */
  setPassword: async (
    token: string,
    password: string,
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    return request<{ success: boolean; message?: string; error?: string }>(
      '/auth/member/set-password',
      {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      },
    );
  },

  /** 重寄設定密碼信（兼忘記密碼）。 */
  resendSetPassword: async (email: string): Promise<{ success: boolean; message?: string }> => {
    return request<{ success: boolean; message?: string }>(
      '/auth/member/resend-set-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    );
  },

  getProfile: async (): Promise<User> => {
    return request<User>('/auth/profile');
  },

  logout: async (): Promise<void> => {
    await request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  refresh: async (): Promise<LoginResponse> => {
    return request<LoginResponse>('/auth/refresh', {
      method: 'POST',
    });
  },
};
