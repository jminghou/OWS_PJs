'use client';
/**
 * 社群登入按鈕組：依後端 /providers 決定顯示哪幾顆；一個都沒有時整塊不顯示（含分隔線）。
 *
 *   <SocialSignInButtons
 *     next="/report/checkout"
 *     onSuccess={async (r) => { await checkAuth(); router.push('/account'); }}
 *     onError={(err) => isNeedsLink(err) ? router.push('/login/social?status=pending') : setError(err.message)}
 *     dividerLabel="或用 Email"
 *   />
 *
 * Google 是彈窗、成功就呼叫 onSuccess；LINE 是整頁轉址，結果由站台的 /login/social 頁處理。
 * 在 LINE／IG／FB 等 App 內建瀏覽器裡，Google 會拒絕登入 → Google 那格改顯示「請用瀏覽器開啟」，LINE 照常可用。
 */
import { useEffect, useState } from 'react';
import { socialAuthApi, type SocialProviders, type SocialSignInResult } from './api';
import { GoogleSignInButton } from './GoogleSignInButton';
import { LineSignInButton } from './LineSignInButton';
import { detectInAppBrowser, type InAppBrowser } from './inAppBrowser';
import { InAppBrowserNotice } from './InAppBrowserNotice';

export interface SocialSignInButtonsProps {
  onSuccess: (result: SocialSignInResult) => void | Promise<void>;
  onError: (err: unknown) => void;
  onPending?: (pending: boolean) => void;
  /** LINE 登入完要回到的站內路徑（Google 由 onSuccess 自行導頁） */
  next?: string | null;
  /** 按鈕下方分隔線的文字；不給就不畫分隔線。 */
  dividerLabel?: string;
  className?: string;
}

export function SocialSignInButtons({ onSuccess, onError, onPending, next, dividerLabel, className = '' }: SocialSignInButtonsProps) {
  const [providers, setProviders] = useState<SocialProviders | null>(null);
  const [inApp, setInApp] = useState<InAppBrowser | null>(null);

  useEffect(() => {
    setInApp(detectInAppBrowser());
    let cancelled = false;
    socialAuthApi.providers()
      .then((r) => !cancelled && setProviders(r.providers || {}))
      .catch(() => !cancelled && setProviders({})); // 模組沒開（404）或網路錯誤 → 不顯示
    return () => {
      cancelled = true;
    };
  }, []);

  const google = providers?.google?.client_id;
  const line = !!providers?.line;
  if (!google && !line) return null;

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-3">
        {line && <LineSignInButton next={next} />}
        {google && (inApp ? (
          <InAppBrowserNotice app={inApp} />
        ) : (
          <GoogleSignInButton clientId={google} onSuccess={onSuccess} onError={onError} onPending={onPending} />
        ))}
      </div>
      {dividerLabel && (
        <div className="my-5 flex items-center gap-3 text-[13px] text-gray-500" role="separator">
          <span className="h-px flex-1 bg-gray-200" />
          {dividerLabel}
          <span className="h-px flex-1 bg-gray-200" />
        </div>
      )}
    </div>
  );
}
