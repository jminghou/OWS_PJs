import { NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_UPLOAD_TOKEN;

/**
 * GET /api/strapi-media-meta/all
 * 取得所有 MediaMeta（包含 file 和 category 關聯）
 * 用於建立檔案與分類的對應關係
 */
export async function GET() {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (STRAPI_TOKEN) {
      headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;
    }

    // 取得所有 MediaMeta，populate file 和 category
    const url = `${STRAPI_URL}/api/media-metas?populate[0]=file&populate[1]=category&pagination[pageSize]=1000`;

    const response = await fetch(url, { headers });

    // 如果 API 不可用，靜默返回空陣列
    if (!response.ok) {
      if (response.status === 404 || response.status === 403 || response.status === 401) {
        console.warn(`[strapi-media-meta/all] API 返回 ${response.status}，MediaMeta API 可能未啟用`);
        return NextResponse.json({ data: [] });
      }
      return NextResponse.json({ data: [] });
    }

    const data = await response.json();

    // 轉換資料格式
    const mediaMetas = (data.data || []).map((item: any) => ({
      id: item.id,
      documentId: item.documentId,
      file: item.file ? { id: item.file.id } : null,
      category: item.category || [],
      chartid: item.chartid,
      place: item.place,
      copyright: item.copyright,
      isPublic: item.isPublic,
    }));

    return NextResponse.json({ data: mediaMetas });
  } catch (error) {
    console.error('[strapi-media-meta/all] Error:', error);
    return NextResponse.json({ data: [] });
  }
}
