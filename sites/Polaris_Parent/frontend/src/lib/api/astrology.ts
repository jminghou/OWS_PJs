/**
 * 紫微斗數排盤 API client
 * 對應後端 sites/Polaris_Parent/backend/extensions/astrology
 *   POST /api/v1/astrology/calculate
 *   GET  /api/v1/astrology/geo-options
 */
import { API_URL } from './client';

export type TimeType = 'clock_time' | 'solar_time';

export interface ZiweiPlace {
  city: string;
  country: string;
}

export interface ZiweiCalcRequest {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  gender: string; // 男 / 女（後端也接受 M/F）
  name?: string;
  time_type?: TimeType;
  place?: ZiweiPlace; // time_type=solar_time 時必填
  include_flow?: boolean;
  render?: boolean;
  theme?: string;
}

export interface ZiweiCalcResponse {
  success: boolean;
  chart_id: string;
  time_type: TimeType;
  solar_time: string | null;
  data: Record<string, any>;
  svg: string | null;
  error?: string;
}

/** 洲 → 國家 → 城市[] */
export type GeoHierarchy = Record<string, Record<string, string[]>>;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || `請求失敗 (${res.status})`);
  }
  return json as T;
}

export const astrologyApi = {
  /** 排盤：回傳命盤 JSON 與十二宮方圖 SVG。 */
  calculate: (req: ZiweiCalcRequest) =>
    postJson<ZiweiCalcResponse>('/astrology/calculate', req),

  /** 取得地點級聯選項（真太陽時用）。 */
  geoOptions: async (): Promise<GeoHierarchy> => {
    const res = await fetch(`${API_URL}/astrology/geo-options`);
    let json: any = {};
    try {
      json = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok || json?.success === false) {
      throw new Error(json?.error || '無法載入地點選項');
    }
    return json.hierarchy as GeoHierarchy;
  },
};
