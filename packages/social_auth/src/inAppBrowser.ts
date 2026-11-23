/**
 * App 內建瀏覽器偵測。
 *
 * Google 會拒絕在 App 內建瀏覽器（WebView）裡登入（錯誤 403 disallowed_useragent），
 * 而很多訪客是從 LINE、Instagram、Facebook 點連結進來的。偵測到時改顯示「請用瀏覽器開啟」，
 * 不要讓使用者按了 Google 按鈕才看到錯誤頁。LINE 登入（之後的階段）在這些環境照常可用。
 */
export type InAppBrowser = 'line' | 'instagram' | 'facebook' | 'wechat' | 'threads' | 'other';

export function detectInAppBrowser(ua: string | undefined = typeof navigator !== 'undefined' ? navigator.userAgent : undefined): InAppBrowser | null {
  if (!ua) return null;
  if (/\bLine\//i.test(ua)) return 'line';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/Barcelona/i.test(ua)) return 'threads'; // Threads App 的 UA 代號
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'facebook';
  if (/MicroMessenger/i.test(ua)) return 'wechat';
  // Android WebView 會帶 "; wv)"；一般 Chrome 不會
  if (/Android/i.test(ua) && /; wv\)/i.test(ua)) return 'other';
  return null;
}

export const IN_APP_BROWSER_LABEL: Record<InAppBrowser, string> = {
  line: 'LINE',
  instagram: 'Instagram',
  facebook: 'Facebook',
  wechat: '微信',
  threads: 'Threads',
  other: 'App',
};

export function isIOS(ua: string | undefined = typeof navigator !== 'undefined' ? navigator.userAgent : undefined) {
  return !!ua && /iPhone|iPad|iPod/i.test(ua);
}
