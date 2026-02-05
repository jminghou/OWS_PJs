import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_UPLOAD_TOKEN;

/**
 * GET /api/strapi-tags
 * 取得所有標籤
 * 如果 API 不可用或無權限，返回空陣列而非錯誤
 */
export async function GET(request: NextRequest) {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (STRAPI_TOKEN) {
      headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;
    }

    const url = `${STRAPI_URL}/api/tags`;
    console.log('[strapi-tags] Fetching URL:', url);
    const response = await fetch(url, { headers });
    console.log('[strapi-tags] Response status:', response.status);

    // 如果無權限或 API 不存在，靜默返回空陣列
    if (!response.ok) {
      if (response.status === 404 || response.status === 403 || response.status === 401) {
        console.warn(`[strapi-tags] API 返回 ${response.status}，可能需要在 Strapi API Token 設定中開放 Tag 的 find 權限`);
        return NextResponse.json({ data: [] });
      }
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch tags' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[strapi-tags] Raw response data:', JSON.stringify(data, null, 2));
    return NextResponse.json({ data: data.data || [] });
  } catch (error) {
    console.error('Error fetching tags:', error);
    // 網路錯誤時也返回空陣列，避免阻斷 UI
    return NextResponse.json({ data: [] });
  }
}

/**
 * POST /api/strapi-tags
 * 建立新標籤
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  if (!STRAPI_TOKEN) {
    return NextResponse.json(
      { error: 'API token not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STRAPI_TOKEN}`,
    };

    const response = await fetch(`${STRAPI_URL}/api/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: { name: body.name } }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error?.message || 'Failed to create tag' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
