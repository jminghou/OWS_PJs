'use client';
/**
 * Google 官方登入按鈕（Google Identity Services）。
 *
 * 用官方的 renderButton 而不是自己畫：符合 Google 品牌規範，也由 Google 處理 FedCM／彈窗。
 * 按下後 Google 回傳 ID token（credential），這裡 POST 給後端驗證，成功即已登入（cookie 已設）。
 */
import { useEffect, useRef, useState } from 'react';
import { socialAuthApi, type SocialSignInResult } from './api';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GsiApi {
  initialize(options: Record<string, unknown>): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GsiApi } };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Google script failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export interface GoogleSignInButtonProps {
  clientId: string;
  /** 後端驗證成功（已登入）。用自訂 submit 時收到的是 submit 的回傳值。 */
  onSuccess: (result: SocialSignInResult) => void | Promise<void>;
  /** 把 Google 憑證送去哪裡；預設登入／註冊。會員中心加連時傳 socialAuthApi.linkGoogle。 */
  submit?: (credential: string) => Promise<any>;
  /** 後端拒絕或網路錯誤；err 為 RequestError，可用 isNeedsLink(err) 判斷。 */
  onError: (err: unknown) => void;
  /** 開始向後端驗證時呼叫，可用來顯示處理中。 */
  onPending?: (pending: boolean) => void;
  /** 按鈕文字：continue_with「使用 Google 帳戶繼續」／signin_with／signup_with */
  text?: 'continue_with' | 'signin_with' | 'signup_with';
  locale?: string;
}

export function GoogleSignInButton({
  clientId, onSuccess, onError, onPending, submit, text = 'continue_with', locale = 'zh-TW',
}: GoogleSignInButtonProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  // callback 只在 initialize 時綁一次；用 ref 拿到最新的處理函式
  const handlers = useRef({ onSuccess, onError, onPending, submit });
  handlers.current = { onSuccess, onError, onPending, submit };

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        const gsi = window.google?.accounts?.id;
        if (cancelled || !ref.current || !gsi) return;
        gsi.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: async ({ credential }: { credential?: string }) => {
            const h = handlers.current;
            if (!credential) return;
            h.onPending?.(true);
            try {
              const result = await (h.submit ?? socialAuthApi.google)(credential);
              await h.onSuccess(result);
            } catch (err) {
              h.onError(err);
            } finally {
              h.onPending?.(false);
            }
          },
        });
        // 官方按鈕寬度上限 400px；依容器寬度填滿
        const width = Math.min(400, Math.max(200, Math.floor(ref.current.getBoundingClientRect().width)));
        gsi.renderButton(ref.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
          text, locale, width, logo_alignment: 'center',
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, text, locale]);

  if (failed) {
    return <p className="text-center text-sm text-gray-500">Google 登入暫時無法載入，請重新整理或改用 Email。</p>;
  }
  // 預留高度，避免腳本載入後版面跳動
  return <div ref={ref} className="flex min-h-[44px] w-full justify-center" />;
}
