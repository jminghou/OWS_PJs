import { NextRequest, NextResponse } from 'next/server';

// 支援的語言列表
const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];
const defaultLocale = 'zh-TW';

const I18N_CACHE_TTL_MS = 60_000;
const I18N_ERROR_TTL_MS = 10_000;
let enabledLanguagesCache: { languages: string[]; expires: number } | null = null;

// 後台實際啟用的語言（多語言關閉、未設定 API 或查詢失敗時為空陣列）。
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
        languages = data.enabled && Array.isArray(data.languages) ? data.languages : [];
        ttl = I18N_CACHE_TTL_MS;
      }
    } catch {
      // 查不到就不導向，退回預設語言
    }
  }

  enabledLanguagesCache = { languages, expires: Date.now() + ttl };
  return languages;
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 排除不需要處理的路徑
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 檢查路徑是否以語言代碼開頭
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    // 從路徑中提取語言代碼，存入 cookie 供後續使用
    const locale = pathname.split('/')[1];
    const response = NextResponse.next();
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
    return response;
  }

  // 檢查 cookie 中是否有語言偏好
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && locales.includes(cookieLocale) && cookieLocale !== defaultLocale) {
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
  ],
};
