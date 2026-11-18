'use client';
/**
 * LINE 登入按鈕：整頁導向到後端 /line/start，LINE 處理完會轉回站台的 /login/social。
 * 在 LINE 的 App 內瀏覽器裡也能用（不像 Google）。
 */
import { socialAuthApi } from './api';

export interface LineSignInButtonProps {
  /** 登入後要回到的站內路徑 */
  next?: string | null;
  /** link＝已登入會員在會員中心加連 */
  mode?: 'login' | 'link';
  label?: string;
  className?: string;
}

export function LineSignInButton({ next, mode = 'login', label, className = '' }: LineSignInButtonProps) {
  return (
    <a
      href={socialAuthApi.lineStartUrl({ next, mode })}
      className={
        'flex h-[40px] w-full max-w-[400px] items-center justify-center gap-2 rounded-full bg-[#06C755] px-4 ' +
        'text-[14px] font-medium text-white transition-colors hover:bg-[#05b34c] active:bg-[#049a41] ' +
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#06C755]/30 ' + className
      }
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5 1.1-.5 5.9-3.5 8-6C21.4 14.2 22 12.7 22 11c0-4.4-4.5-8-10-8Z" />
      </svg>
      {label ?? (mode === 'link' ? '連結 LINE 帳號' : '使用 LINE 繼續')}
    </a>
  );
}
