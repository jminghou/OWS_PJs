/**
 * Social Auth API client（對應 packages/social_auth/api.py，掛在 /api/v1/social-auth）
 *
 * 登入成功時後端已設好 JWT cookies，呼叫端再以 auth store 的 checkAuth() 同步登入狀態。
 * LINE 是整頁轉址：按鈕直接連到 lineStartUrl()，處理完後端轉回站台的 /login/social?status=…。
 */
import { getBaseUrl, request, RequestError } from '@ows/platform-api/client';

export type SocialProviderKey = 'google' | 'line';

export interface SocialProviders {
  google?: { client_id: string };
  line?: Record<string, never>;
}

export interface SocialUser {
  id: number;
  username: string;
  email: string;
  [key: string]: unknown;
}

export interface SocialSignInResult {
  success: boolean;
  is_new: boolean;
  user: SocialUser;
}

export interface SocialIdentity {
  provider: string;
  email: string | null;
  display_name: string | null;
  picture_url: string | null;
  created_at: string | null;
  last_login_at: string | null;
}

export interface MyIdentities {
  success: boolean;
  identities: SocialIdentity[];
  password_set: boolean;
  /** 本站目前開放的 provider */
  providers: SocialProviderKey[];
}

/** 社群帳號已驗證、但還要證明一個信箱的「待完成票」。 */
export interface SocialTicket {
  success: boolean;
  provider: SocialProviderKey;
  /** needs_link：信箱已是會員，寄碼到該信箱連結；email_missing：社群帳號沒給信箱，請對方填 */
  reason: 'needs_link' | 'email_missing';
  email: string | null;
  name: string | null;
  picture: string | null;
  can_verify: boolean;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(`/social-auth/${path}`, { method: 'POST', body: JSON.stringify(body) });

export const socialAuthApi = {
  providers: () => request<{ success: boolean; providers: SocialProviders }>('/social-auth/providers'),

  google: (credential: string) => post<SocialSignInResult>('google', { credential }),

  /** LINE 登入（mode=login）或已登入時加連（mode=link）的起點；用整頁導向，不要 fetch。 */
  lineStartUrl: (opts: { next?: string | null; mode?: 'login' | 'link' } = {}) => {
    const sp = new URLSearchParams();
    if (opts.next) sp.set('next', opts.next);
    if (opts.mode === 'link') sp.set('mode', 'link');
    const qs = sp.toString();
    return `${getBaseUrl()}/social-auth/line/start${qs ? `?${qs}` : ''}`;
  },

  ticket: () => request<SocialTicket>('/social-auth/ticket'),
  ticketEmailCode: (email?: string) =>
    post<{ success: boolean; email: string; message: string }>('ticket/email-code', { email }),
  ticketComplete: (email: string | undefined, code: string) =>
    post<SocialSignInResult>('ticket/complete', { email, code }),

  myIdentities: () => request<MyIdentities>('/social-auth/me/identities'),
  linkGoogle: (credential: string) => post<MyIdentities>('me/link/google', { credential }),
  unlink: (provider: SocialProviderKey) =>
    request<MyIdentities>(`/social-auth/me/identities/${provider}`, { method: 'DELETE' }),
};

/** 需要再證明一個信箱（後端 409 needs_link／email_missing，已設好待完成票）。 */
export const isNeedsLink = (err: unknown): boolean => err instanceof RequestError && err.status === 409;
