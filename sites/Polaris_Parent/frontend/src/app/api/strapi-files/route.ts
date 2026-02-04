import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_UPLOAD_TOKEN;

/**
 * GET /api/strapi-files - 代理取得 Strapi 媒體檔案列表（帶認證，避免瀏覽器直接呼叫 Strapi 造成 403）
 */
export async function GET(request: NextRequest) {
  try {
    if (!STRAPI_TOKEN) {
      console.error('[strapi-files] STRAPI_UPLOAD_TOKEN 未設定，請在 frontend 目錄的 .env.local 或根目錄 .env 中設定');
      return NextResponse.json(
        { error: 'STRAPI_UPLOAD_TOKEN is not set. Add it to .env.local (when running from frontend) or root .env (when using Docker).' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const strapiUrl = `${STRAPI_URL}/api/upload/files${queryString ? `?${queryString}` : ''}`;

    // 先帶 API Token 請求
    let strapiResponse = await fetch(strapiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
    });

    // Strapi 已知問題：Upload 外掛有時即使用 API Token + Public 權限仍回 401。
    // 若收到 401，改為不帶 Token 再試一次（以 Public 角色存取，需已勾選 Upload find/findOne）。
    if (strapiResponse.status === 401) {
      strapiResponse = await fetch(strapiUrl, { method: 'GET' });
    }

    if (!strapiResponse.ok) {
      const error = await strapiResponse.json().catch(() => ({}));
      const message = error.error?.message || strapiResponse.statusText;
      if (strapiResponse.status === 401) {
        console.error('[strapi-files] Strapi 仍回 401。請確認：(1) Strapi 有重啟過 (2) 編輯的是 Public 角色 (3) Media Library 的 find、findOne 已勾選並儲存。');
      }
      return NextResponse.json(
        { error: message },
        { status: strapiResponse.status }
      );
    }

    const result = await strapiResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Strapi files proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
