'use client';
/**
 * Cloudflare Turnstile（「我不是機器人」驗證）。
 *
 * 會寄信給任意 Email 的公開表單（註冊／忘記密碼的驗證碼、訂閱電子報）送出前要先拿到 token，
 * 放進 X-Turnstile-Token header；後端 core/backend_engine/security.py 向 Cloudflare 驗證。
 * 沒設 NEXT_PUBLIC_TURNSTILE_SITE_KEY 時整個功能關閉（enabled=false、不載入腳本、ready 恆為 true），
 * 本機開發與尚未申請的站台照常運作；後端沒設 TURNSTILE_SECRET_KEY 時也會略過驗證。
 *
 *   const ts = useTurnstile();
 *   <div ref={ts.ref} />                 // 驗證框（Managed 模式多半自動通過、不用點）
 *   await api.call(..., { headers: turnstileHeaders(ts.token) });
 *   ts.reset();                          // token 只能用一次，每次送出後都要重拿
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const TURNSTILE_HEADER = 'X-Turnstile-Token';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Turnstile script failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
}

export const turnstileHeaders = (token: string): Record<string, string> =>
  token ? { [TURNSTILE_HEADER]: token } : {};

export function useTurnstile(siteKey: string = turnstileSiteKey()) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          language: 'auto',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        });
      })
      .catch(() => setToken(''));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  const reset = useCallback(() => {
    setToken('');
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, []);

  const enabled = Boolean(siteKey);
  return { ref, token, reset, enabled, ready: !enabled || Boolean(token) };
}
