import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales } from '@/i18n/config';
import { PASS_COOKIE } from '@/lib/i18n/localePreview';

const I18N_CACHE_TTL_MS = 60_000;
const I18N_ERROR_TTL_MS = 10_000;
let enabledLanguagesCache: { languages: string[]; expires: number } | null = null;

// 訪客看得到的語言（public_languages；多語言關閉、未設定 API 或查詢失敗時為空陣列）。
// 其餘語言是「編輯中」：只放行持語言預覽通行證的人，見 localeGate()。
// cookie 導向必須以此為準：多語言關閉時前台沒有切換器，若仍依 cookie 導向，
// 使用者會被鎖在該語言回不了預設語言（localhost 各站共用 cookie 時特別容易踩到）。
async function getEnabledLanguages(request: NextRequest): Promise<string[]> {
  if (enabledLanguagesCache && enabledLanguagesCache.expires > Date.now()) {
    return enabledLanguagesCache.languages;
  }

  let languages: string[] = [];
  let ttl = I18N_ERROR_TTL_MS;
  const apiBase = process.env.NEXT_SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL;

  if (apiBase) {
    try {
      // apiBase 可能是相對值（/api/v1），以當前請求為基準解析
      const response = await fetch(new URL(`${apiBase}/settings/i18n`, request.url), {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data.public_languages) ? data.public_languages : data.languages;
        languages = data.enabled && Array.isArray(list) ? list : [];
        ttl = I18N_CACHE_TTL_MS;
      }
    } catch {
      // 查不到就不導向，退回預設語言
    }
  }

  enabledLanguagesCache = { languages, expires: Date.now() + ttl };
  return languages;
}

// /api/v1/* 由 next.config 的 rewrite 轉給後端，途中經過 Cloudflare 與 Railway，使用者 IP 在這一層之後就丟了
// （後端只看得到 Vercel 的出口 IP，所有訪客同一個）。這裡把 Vercel 收到的使用者 IP 放進 x-ows-client-ip，
// 連同與後端相同的 EDGE_PROXY_SECRET 一起送；後端密鑰比對正確才採信（core/backend_engine/security.py）。
// 兩個 header 一律由這裡覆寫，訪客自己送來的同名 header 不會傳到後端。
const PASS_CACHE_TTL_MS = 60_000;
const passCache = new Map<string, { languages: string[] | null; expiresAt: number; checkedUntil: number }>();

// 語言預覽通行證：httpOnly cookie 裡的簽章 token，向後端驗證（結果快取 60 秒，避免每頁都打後端）。
// 驗證失敗、逾時一律當作沒有通行證（寧可擋掉自己人，也不要放行訪客）。
async function hasPass(request: NextRequest, locale: string): Promise<boolean> {
  const token = request.cookies.get(PASS_COOKIE)?.value;
  if (!token) return false;
  const now = Date.now();
  let entry = passCache.get(token);
  if (!entry || entry.checkedUntil <= now) {
    entry = { languages: null, expiresAt: 0, checkedUntil: now + PASS_CACHE_TTL_MS };
    const apiBase = process.env.NEXT_SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (apiBase) {
      try {
        const url = new URL(`${apiBase}/locale-preview/verify`, request.url);
        url.searchParams.set('token', token);
        const res = await fetch(url, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          entry = { languages: Array.isArray(data.languages) ? data.languages : null,
                    expiresAt: Number(data.expires_at) * 1000, checkedUntil: now + PASS_CACHE_TTL_MS };
        }
      } catch {
        // 視為無效
      }
    }
    if (passCache.size > 500) passCache.clear();
    passCache.set(token, entry);
  }
  return entry.expiresAt > now && (entry.languages === null || entry.languages.includes(locale));
}

// 編輯中的語言：沒有通行證的人（含搜尋引擎）302 導回同一頁的繁中版；有通行證的人放行但標 noindex。
// 302 而非 301：語言之後會公開，不能讓瀏覽器或搜尋引擎永久記住這個導向。
async function localeGate(request: NextRequest, locale: string): Promise<NextResponse | null> {
  if (locale === defaultLocale) return null;
  if ((await getEnabledLanguages(request)).includes(locale)) return null;
  if (await hasPass(request, locale)) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }
  const url = request.nextUrl.clone();
  url.pathname = request.nextUrl.pathname.slice(locale.length + 1) || '/';
  return NextResponse.redirect(url, 302);
}

function forwardApiRequest(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete('x-ows-edge-secret');
  headers.delete('x-ows-client-ip');
  const secret = process.env.EDGE_PROXY_SECRET;
  // Vercel 會以實際連線來源覆寫 x-real-ip／x-forwarded-for，訪客無法偽造
  const visitorIp = (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || '')
    .split(',')[0].trim();
  if (secret) {
    headers.set('x-ows-edge-secret', secret);
    if (visitorIp) headers.set('x-ows-client-ip', visitorIp);
  }
  return NextResponse.next({ request: { headers } });
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/v1/')) return forwardApiRequest(request);

  // 排除不需要處理的路徑
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/preview') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 檢查路徑是否以語言代碼開頭
  const pathnameHasLocale = (locales as readonly string[]).some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    const locale = pathname.split('/')[1];
    // 文章預覽（/{locale}/preview/{token}）憑簽章連結即可看，不需要語言通行證，也不記語言偏好
    if (pathname.startsWith(`/${locale}/preview/`)) return NextResponse.next();
    const gated = await localeGate(request, locale);
    if (gated) return gated;
    // 從路徑中提取語言代碼，存入 cookie 供後續使用
    const response = NextResponse.next();
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
    return response;
  }

  // 檢查 cookie 中是否有語言偏好
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale) && cookieLocale !== defaultLocale) {
    const enabledLanguages = await getEnabledLanguages(request);
    if (enabledLanguages.includes(cookieLocale)) {
      // 重定向到帶語言前綴的路徑
      return NextResponse.redirect(
        new URL(`/${cookieLocale}${pathname}`, request.url)
      );
    }
  }

  // 預設語言不需要前綴，直接通過
  return NextResponse.next();
}

export const config = {
  matcher: [
    // 匹配所有路徑，排除靜態資源
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // 轉給後端的 API：只為了帶上代理密鑰
    '/api/v1/:path*',
  ],
};
