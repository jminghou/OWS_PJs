import type { User, LoginCredentials } from '@/types';
import { request } from './client';

export interface LoginResponse {
  user: User;
}

/** 註冊時可附上剛排的命盤（註冊成功後自動歸戶）。 */
export interface RegisterChartPayload {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  gender: string; // 男 / 女
  name?: string;
  place?: string;
  relation?: string; // 預設 self
}

export interface RegisterPayload {
  email: string;
  password: string;
  chart?: RegisterChartPayload;
}

export interface RegisterResponse {
  success: boolean;
  user: User;
  chart_id?: string | null;
  /** 註冊成功但命盤儲存失敗（命盤服務不可用等）時的警告訊息。 */
  chart_warning?: string | null;
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
    return request<RegisterResponse>('/astrology/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** 重寄設定密碼信（兼忘記密碼）。 */
  resendSetPassword: async (email: string): Promise<{ success: boolean; message?: string }> => {
    return request<{ success: boolean; message?: string }>('/astrology/resend-set-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
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
