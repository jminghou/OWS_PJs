/**
 * 命盤資料模型 —— 鏡射 p_e_artist charts/natal/data.py。
 * 將 API 回傳的正規化 chart_json 解析為型別明確的結構。
 */

import {
  FOURTEEN_MAIN_STAR_CODES,
  MAJOR_STAR_CODES,
  SUB_STAR_CODES,
  PALACE_CODES_12,
  palaceCodeToIndex,
} from "./constants";

export interface StarInfo {
  /** 星曜編碼，例 "POL"。 */
  code: string;
  /** 所在地支兩位碼，例 "08"。 */
  branch: string;
  /** 亮度碼 P3/P2/P1/P0/N1/N2/N3 或 null。 */
  brightness: string | null;
  /** 本命四化碼 FO/PW/HO/BI 或 null。 */
  sihua: string | null;
  /** 流盤四化碼（大限/流年/小限），疊加模式時與本命四化雙標；預設 null。 */
  flowSihua?: string | null;
  /** 分類：main=十四主星、sub=有圖副星、minor=純文字小星。 */
  kind: "main" | "sub" | "minor";
}

export interface PalaceInfo {
  /** 宮位碼 "1"~"9"/"A"/"B"/"C"。 */
  code: string;
  /** 該宮所落地支兩位碼。 */
  branch: string;
  /** 宮位天干兩位碼 "01"~"10"（五虎遁）；舊 chart_json 無此資訊時 null。 */
  stem: string | null;
  stars: StarInfo[];
  majors: StarInfo[];
  subs: StarInfo[];
  minors: StarInfo[];
}

export interface SihuaEntry {
  sihuaCode: string;
  starCode: string;
  palaceCode: string;
}

export interface ChartData {
  genderCode: string;
  bodyPalace: string;
  lifeMaster: string;
  bodyMaster: string;
  /** 生年干支代碼；舊 chart_json 或反推不到時為 null。 */
  yearGz: { stem: string | null; branch: string | null };
  /** 以宮位碼為鍵。 */
  palaces: Record<string, PalaceInfo>;
  sihuaSummary: SihuaEntry[];
  chartId: string;
}

/** API 回傳的原始 chart_json 形狀（部分欄位）。 */
export interface RawChartJson {
  gender_code?: string;
  body_palace?: string;
  life_master?: string;
  body_master?: string;
  chart_id?: string;
  meta?: { chart_id?: string };
  chart?: RawChartJson;
  placements?: Record<string, { stars?: Record<string, RawStar> }>;
  /** 宮位層（chart_json v2.3+）：每宮顯式地支 + 天干（五虎遁）。 */
  palaces?: Record<string, { branch?: string | null; stem?: string | null }>;
  /** 生年干支代碼（chart_json v2.3+）。 */
  year_gz?: { stem?: string | null; branch?: string | null };
  sihua_summary?: Record<string, { star: string; palace: string }>;
}
interface RawStar {
  branch?: string | null;
  brightness?: string | null;
  sihua?: string | null;
}

function classify(code: string): StarInfo["kind"] {
  if (FOURTEEN_MAIN_STAR_CODES.has(code)) return "main";
  if (SUB_STAR_CODES.has(code)) return "sub";
  if (!MAJOR_STAR_CODES.has(code)) return "minor";
  return "sub";
}

/**
 * 由已知宮位的 (code, branch) 推回所有 12 宮的地支。
 * 規律：宮位索引 idx(1..12) → branch = ((b1 - (idx-1) - 1) mod 12) + 1，
 * 其中 b1 為命宮(palace "1") 的地支。經真實命盤驗證（命宮未/08，逐宮 -1）。
 */
function deriveBranchByIndex(b1: number, idx: number): string {
  const n = (((b1 - (idx - 1) - 1) % 12) + 12) % 12;
  return String(n + 1).padStart(2, "0");
}

/** 解析 chart_json（接受完整輸出含 meta/chart，或僅 chart 區塊）。 */
export function parseChart(raw: RawChartJson): ChartData {
  const meta = raw.meta ?? {};
  const chartId = String(meta.chart_id ?? raw.chart_id ?? "").trim();
  const chart: RawChartJson = raw.chart ?? raw;

  const placements = chart.placements ?? {};
  // 宮位層（v2.3+）：顯式地支＋宮干，優先於星曜推斷
  const palaceMeta = chart.palaces ?? {};

  // 先從星曜推每宮地支（舊 chart_json fallback）
  const inferred: Record<string, string | null> = {};
  for (const pc of PALACE_CODES_12) {
    const explicit = palaceMeta[pc]?.branch;
    if (explicit) {
      inferred[pc] = explicit;
      continue;
    }
    const stars = placements[pc]?.stars ?? {};
    let branch: string | null = null;
    for (const s of Object.values(stars)) {
      if (s.branch) { branch = s.branch; break; }
    }
    inferred[pc] = branch;
  }

  // 找一個已知宮位算出命宮地支 b1，補齊空宮
  let b1: number | null = null;
  for (const pc of PALACE_CODES_12) {
    const br = inferred[pc];
    if (br) {
      const idx = palaceCodeToIndex(pc);
      const known = parseInt(br, 10);
      b1 = (((known - 1 + (idx - 1)) % 12) + 12) % 12 + 1;
      break;
    }
  }

  const palaces: Record<string, PalaceInfo> = {};
  for (const pc of PALACE_CODES_12) {
    const rawStars = placements[pc]?.stars ?? {};
    const branch =
      inferred[pc] ??
      (b1 != null ? deriveBranchByIndex(b1, palaceCodeToIndex(pc)) : "01");

    const stars: StarInfo[] = Object.entries(rawStars).map(([code, s]) => ({
      code,
      branch: s.branch ?? branch,
      brightness: s.brightness ?? null,
      sihua: s.sihua ?? null,
      kind: classify(code),
    }));

    palaces[pc] = {
      code: pc,
      branch,
      stem: palaceMeta[pc]?.stem ?? null,
      stars,
      majors: stars.filter((s) => s.kind === "main"),
      subs: stars.filter((s) => s.kind === "sub"),
      minors: stars.filter((s) => s.kind === "minor"),
    };
  }

  const sihuaSummary: SihuaEntry[] = Object.entries(chart.sihua_summary ?? {}).map(
    ([sihuaCode, e]) => ({ sihuaCode, starCode: e.star, palaceCode: e.palace }),
  );

  return {
    genderCode: chart.gender_code ?? "",
    bodyPalace: chart.body_palace ?? "",
    lifeMaster: chart.life_master ?? "",
    bodyMaster: chart.body_master ?? "",
    yearGz: {
      stem: chart.year_gz?.stem ?? null,
      branch: chart.year_gz?.branch ?? null,
    },
    palaces,
    sihuaSummary,
    chartId,
  };
}
