import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_UPLOAD_TOKEN;

/**
 * GET /api/strapi-media-meta
 * 根據 file ID 取得 MediaMeta
 * Query params: fileId
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  try {
    // 查詢關聯到此 file 的 MediaMeta
    const queryParams = new URLSearchParams();
    queryParams.set('filters[file][id][$eq]', fileId);
    queryParams.set('populate', 'file,tags,category');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (STRAPI_TOKEN) {
      headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;
    }

    const response = await fetch(
      `${STRAPI_URL}/api/media-metas?${queryParams.toString()}`,
      { headers }
    );

    // 404 或其他錯誤時，返回空結果（MediaMeta 是可選的）
    if (!response.ok) {
      // 404 表示沒有找到或 API 未開放，返回空結果而非錯誤
      if (response.status === 404) {
        return NextResponse.json({ data: null });
      }
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch media meta' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // 返回第一筆結果（如果存在）
    const mediaMeta = data.data?.[0] || null;

    return NextResponse.json({ data: mediaMeta });
  } catch (error) {
    console.error('Error fetching media meta:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strapi-media-meta
 * 建立或更新 MediaMeta
 * Body: { fileId, chartid?, place?, copyright?, isPublic?, tags?, category? }
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
    const { fileId, id, ...metaData } = body;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STRAPI_TOKEN}`,
    };

    // 如果提供了 id，則更新現有記錄
    if (id) {
      const response = await fetch(`${STRAPI_URL}/api/media-metas/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ data: metaData }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return NextResponse.json(
          { error: error.error?.message || 'Failed to update media meta' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json({ data: data.data });
    }

    // 否則建立新記錄
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    const response = await fetch(`${STRAPI_URL}/api/media-metas`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          ...metaData,
          file: fileId,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error?.message || 'Failed to create media meta' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error('Error saving media meta:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
