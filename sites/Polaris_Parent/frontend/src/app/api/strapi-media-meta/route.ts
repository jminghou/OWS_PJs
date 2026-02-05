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
    // Strapi 5 media field filter syntax
    const queryParams = new URLSearchParams();
    queryParams.set('filters[file][id][$eq]', fileId);
    // 明確指定要 populate 的關聯欄位
    queryParams.set('populate[0]', 'tags');
    queryParams.set('populate[1]', 'category');
    queryParams.set('populate[2]', 'file');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (STRAPI_TOKEN) {
      headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;
    }

    const url = `${STRAPI_URL}/api/media-metas?${queryParams.toString()}`;

    console.log('[strapi-media-meta] Fetching URL:', url);
    const response = await fetch(url, { headers });
    console.log('[strapi-media-meta] Response status:', response.status);

    // 404 或其他錯誤時，返回空結果（MediaMeta 是可選的）
    if (!response.ok) {
      // 靜默處理錯誤，不阻斷 UI
      if (response.status === 404 || response.status === 403 || response.status === 401) {
        // 只在開發環境顯示警告
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[strapi-media-meta] API 返回 ${response.status}，MediaMeta API 可能未啟用`);
        }
        return NextResponse.json({ data: null });
      }
      // 其他錯誤也靜默返回空結果
      return NextResponse.json({ data: null });
    }

    const data = await response.json();
    console.log('[strapi-media-meta] Raw response data:', JSON.stringify(data, null, 2));
    console.log('[strapi-media-meta] Data count:', data.data?.length || 0);

    // Strapi 5 返回結構: { data: [...], meta: {...} }
    // 返回第一筆結果（如果存在）
    let mediaMeta = null;
    if (data.data && data.data.length > 0) {
      const item = data.data[0];
      console.log('[strapi-media-meta] Found item:', item.id, 'documentId:', item.documentId);
      console.log('[strapi-media-meta] Item tags:', item.tags);
      console.log('[strapi-media-meta] Item category:', item.category);

      // Strapi 5 的欄位直接在 item 上，不需要 .attributes
      mediaMeta = {
        id: item.id,
        documentId: item.documentId,
        chartid: item.chartid,
        place: item.place,
        copyright: item.copyright,
        isPublic: item.isPublic,
        tags: item.tags || [],
        category: item.category || [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    } else {
      console.log('[strapi-media-meta] No MediaMeta found for fileId:', fileId);

      // 備用方法：獲取所有 MediaMeta 並在本地過濾
      console.log('[strapi-media-meta] Trying fallback: fetch all and filter locally...');
      const fallbackUrl = `${STRAPI_URL}/api/media-metas?populate[0]=tags&populate[1]=category&populate[2]=file`;
      const fallbackResponse = await fetch(fallbackUrl, { headers });
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        console.log('[strapi-media-meta] Fallback: Total MediaMetas:', fallbackData.data?.length || 0);

        // 查找匹配的 MediaMeta
        const matchingItem = fallbackData.data?.find((item: any) => {
          const fileRef = item.file;
          console.log('[strapi-media-meta] Checking item:', item.id, 'file:', fileRef?.id || fileRef);
          return fileRef && (fileRef.id === parseInt(fileId) || fileRef === parseInt(fileId));
        });

        if (matchingItem) {
          console.log('[strapi-media-meta] Fallback found match:', matchingItem.id);
          mediaMeta = {
            id: matchingItem.id,
            documentId: matchingItem.documentId,
            chartid: matchingItem.chartid,
            place: matchingItem.place,
            copyright: matchingItem.copyright,
            isPublic: matchingItem.isPublic,
            tags: matchingItem.tags || [],
            category: matchingItem.category || [],
            createdAt: matchingItem.createdAt,
            updatedAt: matchingItem.updatedAt,
          };
        }
      }
    }

    return NextResponse.json({ data: mediaMeta });
  } catch (error) {
    console.error('[strapi-media-meta] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strapi-media-meta
 * 建立或更新 MediaMeta
 * Body: { fileId, id?, documentId?, chartid?, place?, copyright?, isPublic?, tags?, category? }
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
    const { fileId, documentId, ...metaData } = body;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STRAPI_TOKEN}`,
    };

    // Strapi 5 使用 documentId 進行更新
    // 如果提供了 documentId，則更新現有記錄
    if (documentId) {
      const url = `${STRAPI_URL}/api/media-metas/${documentId}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ data: metaData }),
      });

      // 靜默處理失敗（API 可能未啟用）
      if (!response.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[strapi-media-meta] Update failed, API 可能未啟用');
        }
        // 返回成功但不含資料，讓前端繼續運作
        return NextResponse.json({ data: null, warning: 'MediaMeta API unavailable' });
      }

      const data = await response.json();
      return NextResponse.json({ data: data.data });
    }

    // 否則建立新記錄
    if (!fileId) {
      // 沒有 fileId 且沒有 documentId，靜默忽略
      return NextResponse.json({ data: null });
    }

    const url = `${STRAPI_URL}/api/media-metas`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: {
          ...metaData,
          file: fileId,
        },
      }),
    });

    // 靜默處理失敗（API 可能未啟用）
    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[strapi-media-meta] Create failed, API 可能未啟用');
      }
      return NextResponse.json({ data: null, warning: 'MediaMeta API unavailable' });
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    // 靜默處理所有錯誤
    if (process.env.NODE_ENV === 'development') {
      console.error('[strapi-media-meta] Error:', error);
    }
    return NextResponse.json({ data: null });
  }
}
