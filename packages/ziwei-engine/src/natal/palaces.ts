/**
 * 宮位層：palace/ming_shen.py、subject.py、gz.py、bureau.py、body.py 與
 * function/palace_helper.py 的對應物。
 */
import {
  BRANCHES, BUREAUS, BUREAU_BRANCH_GROUPS, BUREAU_STEM_GROUPS, MASTERS_TABLE,
  PALACE_GZ_BRANCHES, PALACE_GZ_TABLE, PALACE_NAMES, PALACE_RING, mod,
} from "./tables";

/** 從寅宮起順數月，再依時辰順／逆數（命宮逆、身宮順）。 */
export function calculatePalace(lunarMonth: number, hourBranch: string, reverse = false): string {
  const base = mod(lunarMonth - 1, 12);
  const hourIndex = BRANCHES.indexOf(hourBranch);
  const steps = reverse ? -hourIndex : hourIndex;
  return PALACE_RING[mod(base + steps, 12)];
}

export const calculateMingPalace = (m: number, h: string) => calculatePalace(m, h, true);
export const calculateShenPalace = (m: number, h: string) => calculatePalace(m, h, false);

/** 十二宮：命宮起逆行（寅卯辰…環上索引遞減）。回傳插入序＝宮名序。 */
export function calculateTwelvePalaces(mingPalace: string): Record<string, string> {
  const mingIdx = PALACE_RING.indexOf(mingPalace);
  const out: Record<string, string> = {};
  PALACE_NAMES.forEach((name, i) => {
    out[name] = PALACE_RING[mod(mingIdx - i, 12)];
  });
  return out;
}

/** 五虎遁：年干 → 十二地支的宮干支（唯一實作，對應 palace/gz.py）。 */
export function calculatePalaceGz(yearGz: string): Record<string, string> {
  const row = PALACE_GZ_TABLE[yearGz[0]];
  const out: Record<string, string> = {};
  for (let i = 0; i < PALACE_GZ_BRANCHES.length; i++) {
    const b = PALACE_GZ_BRANCHES[i];
    out[b] = row[i] + b;
  }
  return out;
}

export function calculateBureau(mingPalaceGz: string): string {
  const [stem, branch] = [mingPalaceGz[0], mingPalaceGz[1]];
  const sg = BUREAU_STEM_GROUPS.find(([k]) => k.includes(stem));
  const bg = BUREAU_BRANCH_GROUPS.find(([k]) => k.includes(branch));
  if (!sg || !bg) return "未知";
  return BUREAUS[sg[1]][bg[1]];
}

export function calculateMingShenMasters(mingPalace: string, yearBranch: string): [string, string] {
  return [MASTERS_TABLE[mingPalace][0], MASTERS_TABLE[yearBranch][1]];
}

/** Python palace_info：保留原本的字串欄位（流盤層讀 "十二宮" 字串），另附結構化欄位。 */
export interface PalaceInfo {
  命宮: string;
  身宮: string;
  /** "命宮：未, 兄弟：午, …" */
  十二宮: string;
  /** "命宮：辛未, 兄弟：庚午, …"（第八宮名用「奴僕」，沿用 gz.py format_palace_gz） */
  宮位干支: string;
  命宮干支: string;
  五行局: string;
  命主: string;
  身主: string;
  /** 結構化：宮名 → 地支 */
  twelve: Record<string, string>;
  /** 結構化：地支 → 干支 */
  palaceGz: Record<string, string>;
}

/** 宮位資料：{宮名: {宮位: 地支, 干支: 干支}}，對應 organize_palace_info。 */
export type PalaceData = Record<string, { 宮位: string; 干支: string }>;

const GZ_FORMAT_NAMES = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "奴僕", "官祿", "田宅", "福德", "父母"];

export function getPalaceInfo(lunarMonth: number, hourBranch: string, yearGz: string): PalaceInfo {
  const ming = calculateMingPalace(lunarMonth, hourBranch);
  const shen = calculateShenPalace(lunarMonth, hourBranch);
  const twelve = calculateTwelvePalaces(ming);
  const palaceGz = calculatePalaceGz(yearGz);
  const mingGz = palaceGz[ming];
  const bureau = calculateBureau(mingGz);
  const [mingMaster, shenMaster] = calculateMingShenMasters(ming, yearGz[1]);
  const branches = Object.values(twelve);
  return {
    命宮: ming,
    身宮: shen,
    十二宮: PALACE_NAMES.map((n) => `${n}：${twelve[n]}`).join(", "),
    宮位干支: GZ_FORMAT_NAMES.map((n, i) => `${n}：${palaceGz[branches[i]]}`).join(", "),
    命宮干支: mingGz,
    五行局: bureau,
    命主: mingMaster,
    身主: shenMaster,
    twelve,
    palaceGz,
  };
}

export function organizePalaceInfo(info: PalaceInfo): PalaceData {
  const out: PalaceData = {};
  for (const name of PALACE_NAMES) {
    const branch = info.twelve[name];
    out[name] = { 宮位: branch, 干支: info.palaceGz[branch] };
  }
  return out;
}
