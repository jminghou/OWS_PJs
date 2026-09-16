import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * On-demand ISR revalidation endpoint
 *
 * 後台儲存設定成功後，由後端（Flask）以 secret 呼叫此端點，
 * 立即清除指定頁面的 ISR 快取，不必等 revalidate 週期到期。
 *
 * POST /api/revalidate
 * Header: X-Revalidate-Secret: <REVALIDATE_SECRET>
 * Body (optional): { "paths": ["/", "/[locale]"] }
 */

const DEFAULT_PATHS = ['/', '/[locale]'];

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // 未設定 secret 時整個端點停用，避免變成無保護的快取清除入口
    return NextResponse.json(
      { message: 'Revalidation is not configured (REVALIDATE_SECRET missing)' },
      { status: 503 }
    );
  }

  const provided = request.headers.get('x-revalidate-secret');
  if (provided !== secret) {
    return NextResponse.json({ message: 'Invalid revalidation secret' }, { status: 401 });
  }

  let paths = DEFAULT_PATHS;
  try {
    const body = await request.json();
    if (Array.isArray(body?.paths) && body.paths.length > 0) {
      paths = body.paths.filter((p: unknown): p is string => typeof p === 'string');
    }
  } catch {
    // 沒有 body 或非 JSON：使用預設路徑
  }

  for (const path of paths) {
    // 含動態區段（如 /[locale]）需指定 'page' 才能整組失效
    if (path.includes('[')) {
      revalidatePath(path, 'page');
    } else {
      revalidatePath(path);
    }
  }

  return NextResponse.json({
    revalidated: true,
    paths,
    now: new Date().toISOString(),
  });
}
