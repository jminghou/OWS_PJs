/**
 * 紫微斗數排盤 API client
 * 對應後端 sites/Polaris_Parent/backend/extensions/astrology
 *   POST /api/v1/astrology/calculate
 *   GET  /api/v1/astrology/geo-options
 */
import { API_URL, request } from './client';

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
  rating?: string; // 資料評級（Rodden rating：AA/A/B/C/DD/X/XX）
}

/** 會員中心排盤儲存（需登入；email 由後端取自本人）。 */
export interface SaveMyChartRequest {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  gender: string; // 男 / 女
  name?: string;
  place?: string;
  relation?: string; // self/father/mother/...（預設 self）
  rating?: string; // 資料評級（Rodden rating）
}

export interface SaveAndRegisterResponse {
  success: boolean;
  chart_id: string;
  member_id: string;
  is_new_member: boolean;
  email: string;
  error?: string;
}

/** 結構化生辰（供重繪：以此打 /calculate）。 */
export interface ChartBirth {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface MyChart {
  chart_id: string;
  name?: string | null;
  gender?: string | null;
  birth?: ChartBirth | null;
  clock_time?: string | null;
  solar_time?: string | null;
  place?: string | null;
}

export interface MyPerson {
  user_id: string;
  display_name?: string | null;
  relation_label?: string | null;
  charts: MyChart[];
}

export interface MyFavorite extends MyChart {
  note?: string | null;
  created_at?: string | null;
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

  // ── 會員端（需登入；帶 cookie）──
  /** 我的命盤（擁有的人 + 其命盤）。 */
  myCharts: () =>
    request<{ success: boolean; people: MyPerson[] }>('/astrology/my/charts'),

  /** 會員中心排盤儲存：把一張命盤歸檔到自己帳號。 */
  saveMyChart: (req: SaveMyChartRequest) =>
    request<{ success: boolean; chart_id: string }>('/astrology/my/charts', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** 我的收藏。 */
  myFavorites: () =>
    request<{ success: boolean; favorites: MyFavorite[] }>('/astrology/my/favorites'),

  /** 收藏一張公開命盤。 */
  addFavorite: (chartId: string, note = '') =>
    request<{ success: boolean }>('/astrology/my/favorites', {
      method: 'POST',
      body: JSON.stringify({ chart_id: chartId, note }),
    }),

  /** 取消收藏。 */
  removeFavorite: (chartId: string) =>
    request<{ success: boolean }>(`/astrology/my/favorites/${chartId}`, {
      method: 'DELETE',
    }),

  /** 編輯自己命盤的名稱 / 關係標籤。 */
  updateChart: (chartId: string, patch: { name?: string; relation_label?: string }) =>
    request<{ success: boolean }>(`/astrology/my/charts/${chartId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  /** 刪除自己的命盤。 */
  deleteChart: (chartId: string) =>
    request<{ success: boolean }>(`/astrology/my/charts/${chartId}`, {
      method: 'DELETE',
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
