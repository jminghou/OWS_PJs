import { NextRequest, NextResponse } from 'next/server';
import { FLAG_COOKIE, PASS_COOKIE } from '@/lib/i18n/localePreview';

// 離開語言預覽：拿掉這台瀏覽器的通行證，回到一般訪客看到的網站
export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/', req.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.cookies.delete(PASS_COOKIE);
  response.cookies.delete(FLAG_COOKIE);
  return response;
}
