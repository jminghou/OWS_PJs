import { NextRequest, NextResponse } from 'next/server';
import { request } from '@/lib/api';
import { FLAG_COOKIE, PASS_COOKIE } from '@/lib/i18n/localePreview';

// 戴上語言預覽通行證：後台按「開啟語言預覽」或對方點邀請連結時進到這裡。
// 先向後端驗證 token，有效才寫進 httpOnly cookie（網頁上的程式讀不到），middleware 之後每次憑它放行。

const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/api') ? v : '/');

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  let expiresAt = 0;
  try {
    const res = await request<{ ok: boolean; expires_at: number }>(
      `/locale-preview/verify?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    expiresAt = res.ok ? res.expires_at : 0;
  } catch {
    expiresAt = 0;
  }

  const response = NextResponse.redirect(new URL(expiresAt ? next : '/', req.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!expiresAt) return response;

  const expires = new Date(expiresAt * 1000);
  const secure = req.nextUrl.protocol === 'https:';
  response.cookies.set(PASS_COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', expires });
  response.cookies.set(FLAG_COOKIE, '1', { httpOnly: false, secure, sameSite: 'lax', path: '/', expires });
  return response;
}
