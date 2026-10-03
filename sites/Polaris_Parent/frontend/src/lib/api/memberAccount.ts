/**
 * 會員 v2 帳號 API client（Email 驗證碼註冊、重設密碼、登入後驗證）
 * 對應後端 sites/Polaris_Parent/backend/extensions/member_account
 *   POST /api/v1/member/email-code
 *   POST /api/v1/member/register
 *   POST /api/v1/member/password-reset
 *   POST /api/v1/member/verify-email
 *   GET  /api/v1/member/verification
 *
 * 登入沿用平台的 authApi.login（POST /api/v1/auth/login）。
 * register / password-reset 成功時後端已設好 JWT cookies，呼叫端再以
 * useAuthStore().checkAuth() 同步登入狀態。
 */
import { request } from '@ows/platform-api/client';

export type EmailCodePurpose = 'register' | 'reset' | 'verify';

export interface MessageResponse {
  success: boolean;
  message?: string;
  already_verified?: boolean;
}

export interface VerificationStatus {
  success: boolean;
  email: string;
  email_verified: boolean;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(`/member/${path}`, { method: 'POST', body: JSON.stringify(body) });

export const memberAccountApi = {
  /** 寄驗證碼；purpose=verify 需登入，email 由後端取自本人。 */
  sendEmailCode: (purpose: EmailCodePurpose, email?: string) =>
    post<MessageResponse>('email-code', { purpose, email }),

  register: (email: string, code: string, password: string) =>
    post<{ success: boolean }>('register', { email, code, password }),

  resetPassword: (email: string, code: string, password: string) =>
    post<{ success: boolean }>('password-reset', { email, code, password }),

  verifyEmail: (code: string) => post<VerificationStatus>('verify-email', { code }),

  getVerification: () => request<VerificationStatus>('/member/verification'),
};
