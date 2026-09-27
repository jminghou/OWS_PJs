/**
 * encoded_array → chart_json：convert/{special_decoder, chart_parser, palace_stems, chart_serializer}.py
 * 的對應物。輸出形狀＝@ows/ziwei-chart 的 RawChartJson。
 */
import heavenlyStemCodes from "../data/heavenly_stem_codes.json";
import earthlyBranchCodes from "../data/earthly_branch_codes.json";
import starCodes from "../data/star_codes.json";
import { calculatePalaceGz } from "../natal/palaces";
import { FOUR_TRANSFORMATIONS, mod } from "../natal/tables";

const STEM_CODE: Record<string, string> = heavenlyStemCodes;
const BRANCH_CODE: Record<string, string> = earthlyBranchCodes;
const STAR_CODE: Record<string, string> = starCodes;
const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const STEM_NAME = invert(STEM_CODE);
const BRANCH_NAME = invert(BRANCH_CODE);
const STAR_NAME = invert(STAR_CODE);
/** 化祿星（中文）→ 年干（中文） */
const FO_STAR_TO_STEM: Record<string, string> = Object.fromEntries(
  Object.entries(FOUR_TRANSFORMATIONS).map(([stem, t]) => [t["祿"], stem]),
);

const SIHUA_CODES = new Set(["FO", "PW", "HO", "BI"]);
export const PALACE_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"];

export interface StarPlacement { star_code: string; palace_code: string; branch_code: string }
export interface StarTransform { star_code: string; palace_code: string; sihua_code: string }

export interface ChartState {
  gender: string; body_palace: string; life_master: string; body_master: string;
  year_stem: string; year_branch: string;
  placements: StarPlacement[]; transforms: StarTransform[];
  brightness: Record<string, string>;
}

// ── SpecialCodeDecoder ──
type Special =
  | { type: "gender"; value: "male" | "female" }
  | { type: "body_palace_location"; palace: string }
  | { type: "body_palace_star_only"; star: string }
  | { type: "body_palace_star"; star: string; branch: string }
  | { type: "life_master"; star: string }
  | { type: "body_master"; star: string }
  | { type: "brightness"; star: string; value: number }
  | { type: "year_gz"; stem: string; branch: string };

export function decodeSpecial(code: string): Special {
  if (!code) throw new Error("編碼不能為空");
  const c = code[0];
  if (c === "Q") {
    if (code.length === 2) return { type: "body_palace_location", palace: code[1] };
    if (code.length === 4) return { type: "body_palace_star_only", star: code.slice(1, 4) };
    if (code.length === 6) return { type: "body_palace_star", star: code.slice(1, 4), branch: code.slice(4, 6) };
    throw new Error(`身宮編碼格式錯誤 (應為 2, 4 或 6 碼): ${code}`);
  }
  if (c === "L" || c === "M") {
    if (code.length !== 4) throw new Error(`${c === "L" ? "命主" : "身主"}編碼格式錯誤 (應為 4 碼): ${code}`);
    return { type: c === "L" ? "life_master" : "body_master", star: code.slice(1, 4) };
  }
  if (c === "I") {
    if (code.length !== 6) throw new Error(`亮度編碼格式錯誤 (應為 6 碼): ${code}`);
    const sign = code[4];
    if (sign !== "P" && sign !== "N") throw new Error(`亮度符號錯誤 (應為 P 或 N): ${sign}`);
    if (!/^\d$/.test(code[5])) throw new Error(`亮度數值錯誤 (應為數字): ${code[5]}`);
    const v = +code[5];
    return { type: "brightness", star: code.slice(1, 4), value: sign === "P" ? v : -v };
  }
  if (c === "G") {
    if (code.length !== 2) throw new Error(`性別編碼格式錯誤 (應為 2 碼): ${code}`);
    if (code[1] === "F") return { type: "gender", value: "female" };
    if (code[1] === "M") return { type: "gender", value: "male" };
    throw new Error(`性別代碼錯誤 (應為 F 或 M): ${code[1]}`);
  }
  if (c === "Y") {
    if (code.length !== 5) throw new Error(`生年干支編碼格式錯誤 (應為 5 碼): ${code}`);
    const stem = code.slice(1, 3);
    const branch = code.slice(3, 5);
    if (!/^\d{2}$/.test(stem) || !/^\d{2}$/.test(branch)) throw new Error(`生年干支編碼應為數字代碼: ${code}`);
    if (+stem < 1 || +stem > 10) throw new Error(`天干代碼超出範圍 (應為 01-10): ${stem}`);
    if (+branch < 1 || +branch > 12) throw new Error(`地支代碼超出範圍 (應為 01-12): ${branch}`);
    return { type: "year_gz", stem, branch };
  }
  throw new Error(`未知的特殊編碼: ${code}`);
}

// ── ChartParser ──
export function parseEncodedArray(encoded: string[]): ChartState {
  const chart: ChartState = {
    gender: "", body_palace: "", life_master: "", body_master: "", year_stem: "", year_branch: "",
    placements: [], transforms: [], brightness: {},
  };
  for (const raw of encoded) {
    const code = raw.trim();
    if (!code) continue;
    const prefix = code[0].toUpperCase();
    if ("GQLMIY".includes(prefix)) {
      const r = decodeSpecial(code);
      switch (r.type) {
        case "gender": chart.gender = r.value; break;
        case "body_palace_location": chart.body_palace = r.palace; break;
        case "life_master": chart.life_master = r.star; break;
        case "body_master": chart.body_master = r.star; break;
        case "brightness": chart.brightness[r.star] = r.value >= 0 ? `P${r.value}` : `N${Math.abs(r.value)}`; break;
        case "year_gz": chart.year_stem = r.stem; chart.year_branch = r.branch; break;
        default: break; // body_palace_star(_only)：無 palace 欄位，不動狀態
      }
      continue;
    }
    if (code.length === 4 || code.length === 6) {
      const palace_code = code[0];
      const star_code = code.slice(1, 4);
      const suffix = code.length === 6 ? code.slice(4, 6) : "00";
      if (SIHUA_CODES.has(suffix.toUpperCase())) {
        chart.transforms.push({ star_code, palace_code, sihua_code: suffix.toUpperCase() });
      } else {
        chart.placements.push({ star_code, palace_code, branch_code: suffix === "00" ? "" : suffix });
      }
    }
  }
  if (!chart.year_stem) {
    const derived = deriveYearStemCodeFromTransforms(chart.transforms);
    if (derived) chart.year_stem = derived;
  }
  return chart;
}

/** 舊編碼（無 Y token）由化祿星反推年干代碼。 */
export function deriveYearStemCodeFromTransforms(transforms: StarTransform[]): string | null {
  for (const t of transforms) {
    if (t.sihua_code !== "FO") continue;
    const name = STAR_NAME[t.star_code];
    const stem = name ? FO_STAR_TO_STEM[name] : undefined;
    if (stem) return STEM_CODE[stem] ?? null;
  }
  return null;
}

// ── palace_stems ──
export function buildPalaceBranchMap(placements: StarPlacement[]): Record<string, string> {
  let anchor: [number, number] | null = null;
  for (const p of placements) {
    if (PALACE_ORDER.includes(p.palace_code) && /^\d+$/.test(p.branch_code)) {
      const n = +p.branch_code;
      if (n >= 1 && n <= 12) { anchor = [PALACE_ORDER.indexOf(p.palace_code), n]; break; }
    }
  }
  if (!anchor) return {};
  const [ai, ab] = anchor;
  const out: Record<string, string> = {};
  PALACE_ORDER.forEach((pc, i) => {
    out[pc] = String(mod(ab - 1 - (i - ai), 12) + 1).padStart(2, "0");
  });
  return out;
}

export function computePalaceStems(yearStemCode: string, palaceBranchMap: Record<string, string>): Record<string, string | null> {
  const stemName = yearStemCode ? STEM_NAME[yearStemCode] : undefined;
  const out: Record<string, string | null> = {};
  if (!stemName) {
    for (const pc of Object.keys(palaceBranchMap)) out[pc] = null;
    return out;
  }
  const gz = calculatePalaceGz(`${stemName}寅`);
  for (const [pc, bc] of Object.entries(palaceBranchMap)) {
    const bn = BRANCH_NAME[bc];
    const g = bn ? gz[bn] : undefined;
    out[pc] = g ? (STEM_CODE[g[0]] ?? null) : null;
  }
  return out;
}

// ── serialize_chart ──
export interface ChartJson {
  gender: string; gender_code: "GM" | "GF"; body_palace: string; life_master: string; body_master: string;
  year_gz: { stem: string | null; branch: string | null };
  placements: Record<string, { stars: Record<string, { branch: string | null; brightness: string | null; sihua: string | null }> }>;
  palaces: Record<string, { branch: string; stem: string | null }>;
  sihua_summary: Record<string, { star: string; palace: string }>;
  chart_id?: string;
}

export function serializeChart(chart: ChartState): ChartJson {
  const transformMap = new Map<string, string>();
  for (const t of chart.transforms) transformMap.set(`${t.star_code}|${t.palace_code}`, t.sihua_code);

  const placements: ChartJson["placements"] = {};
  for (const p of chart.placements) {
    const pc = p.palace_code;
    if (!placements[pc]) placements[pc] = { stars: {} };
    placements[pc].stars[p.star_code] = {
      branch: p.branch_code || null,
      brightness: chart.brightness[p.star_code] || null,
      sihua: transformMap.get(`${p.star_code}|${pc}`) ?? null,
    };
  }
  const sihua_summary: ChartJson["sihua_summary"] = {};
  for (const t of chart.transforms) sihua_summary[t.sihua_code] = { star: t.star_code, palace: t.palace_code };

  const branchMap = buildPalaceBranchMap(chart.placements);
  const stemMap = Object.keys(branchMap).length ? computePalaceStems(chart.year_stem, branchMap) : {};
  const palaces: ChartJson["palaces"] = {};
  for (const [pc, bc] of Object.entries(branchMap)) palaces[pc] = { branch: bc, stem: stemMap[pc] ?? null };

  return {
    gender: chart.gender,
    gender_code: chart.gender === "male" ? "GM" : "GF",
    body_palace: chart.body_palace,
    life_master: chart.life_master,
    body_master: chart.body_master,
    year_gz: { stem: chart.year_stem || null, branch: chart.year_branch || null },
    placements,
    palaces,
    sihua_summary,
  };
}

/** engine.chart_to_artist_dict 的對應物：encoded_array → chart_json（附 chart_id）。 */
export function encodedArrayToChartJson(encoded: string[], chartId = ""): ChartJson {
  const data = serializeChart(parseEncodedArray(encoded));
  data.chart_id = chartId;
  return data;
}
