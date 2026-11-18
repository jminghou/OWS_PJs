'use client';
/**
 * App 內建瀏覽器提示：Google 不允許在這裡登入，請改用 Safari／Chrome 開啟。
 *
 * LINE 有官方參數：網址加上 openExternalBrowser=1 就會用手機預設瀏覽器開啟，所以給一顆按鈕。
 * 其他 App 沒有這種參數，只能請對方從右上角選單「用瀏覽器開啟」，另附複製連結作為備案。
 */
import { useState } from 'react';
import { IN_APP_BROWSER_LABEL, isIOS, type InAppBrowser } from './inAppBrowser';

function externalUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set('openExternalBrowser', '1');
  return url.toString();
}

export function InAppBrowserNotice({ app }: { app: InAppBrowser }) {
  const [copied, setCopied] = useState(false);
  const browser = isIOS() ? 'Safari' : 'Chrome';
  const name = IN_APP_BROWSER_LABEL[app];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      /* 有些 WebView 不給剪貼簿權限，就只靠文字說明 */
    }
  };

  const btn =
    'inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-sm ' +
    'font-medium text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
      <p className="font-medium">在 {name} 裡無法使用 Google 登入</p>
      <p className="mt-1">
        {app === 'line'
          ? `請按下方按鈕改用 ${browser} 開啟這一頁，就能用 Google 帳號繼續。`
          : `請點右上角的「⋯」，選「用瀏覽器開啟」（${browser}），就能用 Google 帳號繼續。`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {app === 'line' && (
          <a href={typeof window !== 'undefined' ? externalUrl() : '#'} className={btn}>
            用 {browser} 開啟
          </a>
        )}
        <button type="button" onClick={copy} className={btn}>
          {copied ? '已複製連結' : '複製這一頁的連結'}
        </button>
      </div>
    </div>
  );
}
