import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function backendOrigin(): string {
  const raw = (
    process.env.NEXT_SERVER_BACKEND_URL
    || process.env.NEXT_PUBLIC_BACKEND_URL
    || ''
  ).trim().replace(/\/$/, '');
  if (!raw) {
    throw new Error('NEXT_SERVER_BACKEND_URL / NEXT_PUBLIC_BACKEND_URL is not set');
  }
  return raw;
}

function csrfFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)csrf_access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function stripCookieDomain(setCookie: string): string {
  return setCookie.replace(/;\s*Domain=[^;]*/gi, '');
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = `${backendOrigin()}/api/v1/${path.join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  const csrf = request.headers.get('x-csrf-token') || csrfFromCookie(cookie);
  if (csrf) headers.set('x-csrf-token', csrf);

  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, {
    method,
    headers,
    body,
    redirect: 'manual',
    cache: 'no-store',
  });

  const out = new Headers();
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) out.set('content-type', upstreamType);

  const setCookies = typeof upstream.headers.getSetCookie === 'function'
    ? upstream.headers.getSetCookie()
    : [];
  for (const item of setCookies) {
    out.append('set-cookie', stripCookieDomain(item));
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
