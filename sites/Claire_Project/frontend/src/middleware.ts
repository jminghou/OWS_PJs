import { NextRequest, NextResponse } from 'next/server';

// 支援的語言列表
const locales = ['zh-TW', 'zh-CN', 'en', 'ja'];
const defaultLocale = 'zh-TW';

export default function middleware(request: NextRequest) {
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
    // 重定向到帶語言前綴的路徑
    return NextResponse.redirect(
      new URL(`/${cookieLocale}${pathname}`, request.url)
    );
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
