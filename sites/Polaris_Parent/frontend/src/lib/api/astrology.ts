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
  /** 附正規化命盤 JSON（供互動命盤引擎 @ows/ziwei-chart）。 */
  include_chart_json?: boolean;
  theme?: string;
}

export interface ZiweiCalcResponse {
  success: boolean;
  chart_id: string;
  time_type: TimeType;
  solar_time: string | null;
  data: Record<string, any>;
  svg: string | null;
  /** p_e_artist 正規化形狀（placements/stars/sihua_summary），互動命盤用。 */
  chart_json: Record<string, any> | null;
  /** 流盤層（目前含大限 decades）；需 include_flow + include_chart_json。 */
  flow: Record<string, any> | null;
  error?: string;
}

/** 洲 → 國家 → 城市[] */
export type GeoHierarchy = Record<string, Record<string, string[]>>;

/** 一鍵建檔 + 註冊（第三期 §12） */
export interface SaveAndRegisterRequest {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  gender: string; // 男 / 女
  name?: string;
  place?: string;
  email: string;
  relation?: string; // 命主相對會員：self/father/...（預設 self）
}

export interface SaveAndRegisterResponse {
  success: boolean;
  chart_id: string;
  member_id: string;
  is_new_member: boolean;
  email: string;
  error?: string;
}

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

  /** 一鍵建檔 + 註冊：存命盤、建免密碼會員、寄設定密碼信。 */
  saveAndRegister: (req: SaveAndRegisterRequest) =>
    postJson<SaveAndRegisterResponse>('/astrology/save-and-register', req),

  /** 以設定密碼信的 token 設定會員密碼。 */
  setPassword: (token: string, password: string) =>
    postJson<{ success: boolean; message?: string }>('/astrology/set-password', {
      token,
      password,
    }),

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
