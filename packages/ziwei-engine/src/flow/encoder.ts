/**
 * 流盤編碼：core/encoder_flow.py 的對應物（大限 12 筆、小限 120 筆、流年 120 筆）。
 * 每筆 encoded_array 的順序與 Python 逐碼一致：
 *   重佈後的本命 6 碼 → 亮度 I 碼 → 該層流曜 → 巢狀大限流曜（流年／小限）→ T 四化 token
 */
import { BRANCH_CODE_MAP, STAR_CODE_MAP } from "../natal/encoder";
import { FOUR_TRANSFORMATIONS } from "../natal/tables";
import type { DecadeData, DecadePalace, FlowRaw } from "./data";

const PALACE_NAME_TO_CODE: Record<string, string> = {
  命宮: "1", 兄弟: "2", 夫妻: "3", 子女: "4", 財帛: "5", 疾厄: "6",
  遷移: "7", 交友: "8", 官祿: "9", 田宅: "A", 福德: "B", 父母: "C",
};
const PALACE_CODE_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"];
const EARTHLY_BRANCH_ORDER = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

export const SMALL_LIMIT_STAR_CODES: Record<string, string> = {
  小羊: "sGL", 小陀: "sST", 小魁: "sCP", 小鉞: "sCA", 小祿: "sDI", 小馬: "sHH", 小鸞: "sRP", 小喜: "sHJ",
};
export const YEAR_FLOW_STAR_CODES: Record<string, string> = {
  年羊: "yGL", 年陀: "yST", 年魁: "yCP", 年鉞: "yCA", 年祿: "yDI", 年馬: "yHH", 年鸞: "yRP", 年喜: "yHJ",
};
const SIHUA_NAME_TO_CODE: Record<string, string> = { 祿: "FO", 權: "PW", 科: "HO", 忌: "BI" };
const FORTUNE_LAYER_MARKERS: Record<string, string> = { decade: "D", year: "Y", small: "S" };

export interface DecadeEncoding {
  decade_order: string; age_range: string; year_range: string; decade_name: string;
  palace_position: string; encoded_array: string[];
}
export interface AgeEncoding {
  age: string; lunar_year: string; western_year: string; palace_position: string; encoded_array: string[];
}

function stemFromGanzhi(gz: string): string {
  if (!gz) return "";
  let s = String(gz).trim();
  if (s.includes("(") && s.includes(")")) s = s.slice(s.indexOf("(") + 1, s.indexOf(")"));
  return s ? s[0] : "";
}

function findStarPalace(encoded: string[], starCode: string): string | null {
  for (const c of encoded) {
    if (c.length >= 4 && PALACE_CODE_ORDER.includes(c[0]) && c.slice(1, 4) === starCode) return c[0];
  }
  return null;
}

function decadeInfoForAge(decade: DecadeData, age: number): DecadePalace | null {
  const spans: Array<[number, number, number, DecadePalace]> = [];
  for (const info of Object.values(decade)) {
    const parts = String(info.大限歲數 ?? "").split("-");
    const order = parseInt(info.大限順序 ?? "0", 10);
    const start = parseInt(parts[0], 10);
    const end = parts.length > 1 ? parseInt(parts[1], 10) : start;
    if (Number.isNaN(order) || Number.isNaN(start) || Number.isNaN(end)) continue;
    spans.push([order, start, end, info]);
  }
  if (!spans.length) return null;
  spans.sort((a, b) => a[0] - b[0]);
  for (const [, s, e, info] of spans) if (s <= age && age <= e) return info;
  if (age < spans[0][1]) return spans[0][3];
  return spans[spans.length - 1][3];
}

export function generateFortuneSihuaEncodings(encoded: string[], yearStem: string, layer: string): string[] {
  const marker = FORTUNE_LAYER_MARKERS[layer];
  const stem = stemFromGanzhi(yearStem);
  if (!marker || !stem) return [];
  const out: string[] = [];
  for (const [hua, star] of Object.entries(FOUR_TRANSFORMATIONS[stem] ?? {})) {
    const sh = SIHUA_NAME_TO_CODE[hua];
    const sc = STAR_CODE_MAP[star];
    if (!sh || !sc) continue;
    const p = findStarPalace(encoded, sc);
    if (p === null) continue;
    out.push(`T${p}${sc}${sh}${marker}`);
  }
  return out;
}

/** extract_natal_encoding：只留 6／8 碼、去 Q／I 前綴與前四特殊碼 */
export function extractNatalEncoding(natal: string[]): string[] {
  const drop = new Set(["Q5", "LMAR", "MBLE", "GM"]);
  return natal.filter((c) => !drop.has(c) && !c.startsWith("Q") && !c.startsWith("I") && (c.length === 6 || c.length === 8));
}
export const extractBrightnessEncoding = (natal: string[]) => natal.filter((c) => c.startsWith("I"));

export function buildDecadePalaceMapping(decade: DecadeData, targetOrder: number): Record<string, string> {
  const sorted = Object.entries(decade).sort((a, b) => +a[1].大限順序 - +b[1].大限順序);
  const map: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    const name = sorted[(targetOrder - 1 + i) % 12][0];
    map[PALACE_NAME_TO_CODE[name]] = PALACE_CODE_ORDER[i];
  }
  return map;
}

export function calculatePalaceInDecade(starBranch: string, startBranch: string): string {
  const s = EARTHLY_BRANCH_ORDER.indexOf(startBranch);
  const t = EARTHLY_BRANCH_ORDER.indexOf(starBranch);
  if (s < 0 || t < 0) throw new Error(`地支不在順序表中: ${starBranch}/${startBranch}`);
  return PALACE_CODE_ORDER[(((t - s) % 12) + 12) % 12];
}

export function convertToDecadeEncoding(natal: string[], mapping: Record<string, string>): string[] {
  const out: string[] = [];
  for (const c of natal) {
    const p = mapping[c[0]];
    if (p === undefined) continue;
    out.push(p + c.slice(1));
  }
  return out;
}

export function generateDecadeStarEncodings(startBranch: string, stars: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [name, branch] of Object.entries(stars)) {
    const sc = STAR_CODE_MAP[name];
    if (!sc) continue;
    const bc = BRANCH_CODE_MAP[branch];
    if (!bc) continue;
    out.push(`${calculatePalaceInDecade(branch, startBranch)}${sc}${bc}`);
  }
  return out;
}

function generateLayerStarEncodings(
  startBranch: string, stars: Record<string, string>, cycleIndex: number, codes: Record<string, string>,
): string[] {
  const out: string[] = [];
  for (const [name, csv] of Object.entries(stars)) {
    const branches = csv.split(",");
    if (cycleIndex >= branches.length) continue;
    const branch = branches[cycleIndex];
    const sc = codes[name];
    if (!sc) continue;
    const bc = BRANCH_CODE_MAP[branch];
    if (!bc) continue;
    out.push(`${calculatePalaceInDecade(branch, startBranch)}${sc}${bc}`);
  }
  return out;
}

export function calculateDecadeChartEncoding(natalArray: string[], flow: FlowRaw): DecadeEncoding[] {
  const natal = extractNatalEncoding(natalArray);
  const bright = extractBrightnessEncoding(natalArray);
  const decade = flow.大限資料;
  const out: DecadeEncoding[] = [];
  for (let order = 1; order <= 12; order++) {
    const found = Object.entries(decade).find(([, info]) => parseInt(info.大限順序, 10) === order);
    if (!found) continue;
    const [, info] = found;
    const arr = order === 1 ? [...natal] : convertToDecadeEncoding(natal, buildDecadePalaceMapping(decade, order));
    arr.push(...bright);
    if (info.大限星曜) arr.push(...generateDecadeStarEncodings(info.宮位, info.大限星曜));
    arr.push(...generateFortuneSihuaEncodings(arr, info.年干 ?? "", "decade"));
    out.push({
      decade_order: String(order), age_range: info.大限歲數, year_range: info.大限西元區間,
      decade_name: info.大限名稱, palace_position: info.宮位, encoded_array: arr,
    });
  }
  return out;
}

interface AgeInfo {
  palaceName: string; palacePosition: string; lunarYear: string; westernYear: string;
  cycleIndex: number; stars: Record<string, string>;
}

function ageIndex(
  data: Record<string, any>, lunarKey: string, westernKey: string, starsKey: string,
): Map<number, AgeInfo> {
  const m = new Map<number, AgeInfo>();
  for (const [name, info] of Object.entries(data)) {
    const ages = String(info.歲數).split(",");
    const lunar = String(info[lunarKey]).split(",");
    const western = String(info[westernKey]).split(",");
    ages.forEach((a, i) => {
      m.set(parseInt(a, 10), {
        palaceName: name, palacePosition: info.宮位, lunarYear: lunar[i], westernYear: western[i],
        cycleIndex: i, stars: (info[starsKey] && info[starsKey][0]) || {},
      });
    });
  }
  return m;
}

function calculateAgeLayer(
  natalArray: string[], flow: FlowRaw, kind: "small" | "year",
): AgeEncoding[] {
  const natal = extractNatalEncoding(natalArray);
  const bright = extractBrightnessEncoding(natalArray);
  const decade = flow.大限資料;
  const isSmall = kind === "small";
  const idx = isSmall
    ? ageIndex(flow.小限資料, "小限農曆年", "小限西元年", "小限星曜")
    : ageIndex(flow.流年資料, "流年農曆年", "流年西元年", "流年星曜");
  const codes = isSmall ? SMALL_LIMIT_STAR_CODES : YEAR_FLOW_STAR_CODES;
  // 小限四化：小限命宮所在地支的宮干（由大限資料反查 宮位→年干）
  const branchToStem: Record<string, string> = {};
  for (const info of Object.values(decade)) if (info.年干) branchToStem[info.宮位] = info.年干;

  const out: AgeEncoding[] = [];
  for (let age = 1; age <= 120; age++) {
    const a = idx.get(age);
    if (!a) continue;
    const dec = decade[a.palaceName];
    if (!dec) continue;
    const order = parseInt(dec.大限順序, 10);
    const arr = convertToDecadeEncoding(natal, buildDecadePalaceMapping(decade, order));
    arr.push(...bright);
    if (Object.keys(a.stars).length) arr.push(...generateLayerStarEncodings(a.palacePosition, a.stars, a.cycleIndex, codes));
    const nested = decadeInfoForAge(decade, age);
    if (nested && nested.大限星曜 && Object.keys(nested.大限星曜).length) {
      arr.push(...generateDecadeStarEncodings(a.palacePosition, nested.大限星曜));
    }
    arr.push(...generateFortuneSihuaEncodings(arr, nested?.年干 ?? "", "decade"));
    if (isSmall) arr.push(...generateFortuneSihuaEncodings(arr, branchToStem[a.palacePosition] ?? "", "small"));
    else arr.push(...generateFortuneSihuaEncodings(arr, a.lunarYear ?? "", "year"));
    out.push({
      age: String(age), lunar_year: a.lunarYear, western_year: a.westernYear,
      palace_position: a.palacePosition, encoded_array: arr,
    });
  }
  return out;
}

export const calculateSmallLimitEncoding = (natalArray: string[], flow: FlowRaw) => calculateAgeLayer(natalArray, flow, "small");
export const calculateYearFlowEncoding = (natalArray: string[], flow: FlowRaw) => calculateAgeLayer(natalArray, flow, "year");
