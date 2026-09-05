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
  /** 附星曜能量卡（每顆星的 E 與可回溯分解，供瀑布圖）。 */
  include_star_energy?: boolean;
  /** 要哪些星：省略＝全部；["major"]＝只十四主星；["aux"]＝只輔星。 */
  star_energy_kinds?: StarKind[];
  /** 附十二宮讀數（供熱力圖／弦圖／桑基等結構圖表）。 */
  include_readings?: boolean;
  theme?: string;
}

/** 維度類別：major＝十四主星；pair/solo/void 皆歸輔星。 */
export type StarKind = 'major' | 'pair' | 'solo' | 'void' | 'aux';

/** 空劫狀態：未命中／被砍／因帶四化而豁免。 */
export type VoidState = 'none' | 'hit' | 'exempt';

/** 瀑布圖的一段。role=total 是起訖柱（基準／E），step 是變化量。 */
export interface StarEnergyStep {
  key: 'base' | 'brightness' | 'influence' | 'void' | 'total';
  label: string;
  from: number;
  to: number;
  delta: number;
  note: string | null;
  role: 'total' | 'step';
}

/** 反事實：拿掉某個作用後 E 會是多少（後端算好，前端不重算）。 */
export interface StarEnergyCounterfactual {
  e: number;
  gain: number;
  pct: number | null;
  text: string | null;
  /** 僅 without_sihua 有：豁免前的試算衰減因子。 */
  would_be_void_k?: number;
}

/**
 * 單顆星的能量卡。E ＝ 亮度倍率 × (1 + 影響加成 M) × 空劫衰減。
 *
 * 四化**不乘進 E**：它在這條鏈上唯一的作用是讓帶四化的星豁免空劫，
 * 所以效果顯示在 void 那一步（`void_state: 'exempt'`）＋
 * `counterfactual.without_sihua`，不是多加一步。
 */
export interface StarEnergyCard {
  code: string;
  name: string;
  /** 主星＝天格屬性（排序力…）；輔星＝組名（煞星／空劫…）。 */
  attr: string;
  kind: Exclude<StarKind, 'aux'>;
  group: 'major' | 'aux';
  palace: string;
  /** 宮位代碼（1…C）——與互動命盤 onPalaceClick 的參數同一套編碼。 */
  palace_code: string;
  branch: string;
  brightness: string | null;
  brightness_k: number;
  /** 同宮輔星的影響加成 Σ M（僅主星有值）。 */
  m: number;
  void_state: VoidState;
  void_k: number;
  void_detail: {
    void_star: string;
    void_palace: string;
    relation: string;
    factor: number;
  } | null;
  sihua: { hua: string; layer: string; channel_value: number } | null;
  e: number;
  /** 是否受過任何作用。豁免星算 true（它本來會被砍，有反事實可講）。 */
  adjusted: boolean;
  /** adjusted=false 時的說明文案，由後端提供以維持前後端一致。 */
  degenerate_note: string | null;
  steps: StarEnergyStep[];
  counterfactual: {
    without_void?: StarEnergyCounterfactual;
    without_sihua?: StarEnergyCounterfactual;
  } | null;
}

export interface StarEnergyPayload {
  meta: {
    engine_version: string;
    vector_version: string;
    formula: string;
    sihua_note: string;
    degenerate_note: string;
    star_count: number;
  };
  /** 已依 E 由高到低排序。 */
  stars: StarEnergyCard[];
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
  /** 星曜能量卡；需 include_star_energy。載入失敗回 null，不擋其餘資料。 */
  star_energy: StarEnergyPayload | null;
  /** 十二宮讀數；需 include_readings。與 star_energy 共用同一次引擎運算。 */
  readings: PalaceReadingsPayload | null;
  error?: string;
}

/** 取樣關係：主宮 w=1.0 ／ 對宮 0.8 ／ 三方 0.5。 */
export type RelationCode = 'main' | 'opposite' | 'trine';

/**
 * 一筆取樣：某顆星從 `from_code` 宮流進本宮。
 *
 * ⚠️ `flow` 與 `contribution` 不是同一個量：
 *   flow ＝ E×w（原始流量，未乘類權）
 *   contribution ＝ flow × 類權（主星 1.0；輔星 0 ⇒ 恆為 0）
 * 熱力圖與弦圖看 **flow**；進 S總 的是 **contribution**。
 */
export interface ReadingContributor {
  star: string;
  star_code: string;
  attr: string;
  kind: Exclude<StarKind, 'aux'>;
  group: 'major' | 'aux';
  from_palace: string;
  from_code: string;
  relation: string;
  relation_code: RelationCode;
  w: number;
  kind_weight: number;
  e: number;
  flow: number;
  contribution: number;
  /** {化名: 通道值}，例如 {"忌": 2.46}。 */
  channels: Record<string, number>;
}

/** 四化場源：場強＝E × g × w場（獨立空間表，不走取樣窗）。 */
export interface ReadingFieldSource {
  star: string;
  star_code: string;
  hua: string;
  layer: string;
  from_palace: string;
  from_code: string;
  relation: string;
  w: number;
  g: number;
  e: number;
  strength: number;
}

export interface PalaceReading {
  /** 宮位代碼（1…C），與互動命盤 onPalaceClick 同一套。 */
  code: string;
  name: string;
  branch: string;
  /** S總 ＝ s_power ＋ s_hua。 */
  s_total: number;
  s_power: number;
  s_hua: number;
  /** 輔星原始流量小計。**不入 S總**，與上面三個量綱不同，不可同軸比較。 */
  s_aux_flow: number;
  /** {化名: 通道值}，四化欄。 */
  channels: Record<string, number>;
  /** 欠＝S化的對宮忌分量（衍生註解）。 */
  owed: number;
  /** {輔星組名: 流入本宮的流量}——熱力圖的一列。 */
  aux_flow: Record<string, number>;
  contributors: ReadingContributor[];
  field_sources: ReadingFieldSource[];
}

export interface PalaceReadingsPayload {
  meta: {
    engine_version: string;
    vector_version: string;
    /** 輔星組顯示序（由引擎維度註冊表推導，非硬編）。 */
    aux_groups: string[];
    notes: Record<string, string>;
  };
  palaces: PalaceReading[];
  /**
   * 各輔星組的欄合計。⚠️ 取樣窗使同一顆星被多宮取樣，
   * 這個數字**只能做組間相對比較，不是全盤總量**。
   */
  aux_totals: Record<string, number>;
  body_anchor: { code: string; name: string } | null;
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
  /** 是否為完整版（已補大限/流年/小限流運編碼）。 */
  has_fortune?: boolean;
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

  /** 會員中心排盤儲存：把一張命盤歸檔到自己帳號。
   *  同會員同人同時辰重複儲存 → 回傳既有盤（is_existing=true），不重建。 */
  saveMyChart: (req: SaveMyChartRequest) =>
    request<{
      success: boolean;
      chart_id: string;
      is_existing?: boolean;
      has_fortune?: boolean;
    }>('/astrology/my/charts', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  /** 升級命盤為完整版（補大限/流年/小限流運編碼；需付費會員資格）。 */
  upgradeChart: (chartId: string) =>
    request<{ success: boolean; fortune_rows?: number; error?: string }>(
      `/astrology/my/charts/${chartId}/fortune`,
      { method: 'PUT' },
    ),

  /** 降級命盤為本命版（刪流運編碼；可再升級，無資料損失）。 */
  downgradeChart: (chartId: string) =>
    request<{ success: boolean; deleted_rows?: number; error?: string }>(
      `/astrology/my/charts/${chartId}/fortune`,
      { method: 'DELETE' },
    ),

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
