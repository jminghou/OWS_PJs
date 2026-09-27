/**
 * 安星層：stars/*.py 與 function/stars_main.py 的對應物。
 * 輸出的分類順序、星曜順序、亮度字串格式，全部與 Python 逐字一致
 * （encoded_array 的順序取決於此）。
 */
import type { PalaceInfo } from "./palaces";
import {
  BIRTH12_STARS_TABLE, BRANCHES, BRANCH_PALACE_TABLE, BRIGHTNESS_TABLE, FIRE_STAR_TABLE,
  FOUR_TRANSFORMATIONS, GENERAL_STARS_TABLE, HOUR_STARS_TABLE, MAJOR_STARS_TABLE,
  MAJOR_STAR_NAMES, MOON_STARS_TABLE, RING_STAR_TABLE, TEN_VOID_TABLE, YEAR_G_STARS_TABLE,
  YEAR_Z_STARS_TABLE, ZIWEI_TABLE, mod,
} from "./tables";

type StarMap = Record<string, string>;
/** 分類 → {星名: 地支}（插入序即 Python OrderedDict 序） */
export type StarsInfo = Record<string, StarMap>;
/** 星名 → 亮度字串（"3" / "-1"；0 不列） */
export type StarsBrightness = Record<string, string>;
/** 四化類型 → {星曜: 星名} */
export type FourTransInfo = Record<string, { 星曜: string }>;

export function getZiweiPosition(bureau: string, lunarDay: number): string {
  const row = ZIWEI_TABLE[bureau];
  if (!row || lunarDay < 1 || lunarDay > 30) return "未知";
  return row[lunarDay - 1];
}

export function getMajorStars(ziwei: string): StarMap {
  const row = MAJOR_STARS_TABLE[ziwei] ?? Array(13).fill("未知");
  const out: StarMap = {};
  MAJOR_STAR_NAMES.forEach((n, i) => { out[n] = row[i]; });
  return out;
}

export function getMoonStars(lunarMonth: number): StarMap {
  const out: StarMap = {};
  for (const [star, pos] of Object.entries(MOON_STARS_TABLE)) out[star] = pos[lunarMonth - 1];
  return out;
}

export function getHourStars(hourBranch: string): StarMap {
  const idx = BRANCHES.indexOf(hourBranch);
  const out: StarMap = {};
  for (const [star, pos] of Object.entries(HOUR_STARS_TABLE)) out[star] = pos[idx];
  return out;
}

export const getYearGStars = (stem: string): StarMap => ({ ...(YEAR_G_STARS_TABLE[stem] ?? {}) });
export const getYearZStars = (branch: string): StarMap => ({ ...(YEAR_Z_STARS_TABLE[branch] ?? {}) });

export function getFireRingStars(yearBranch: string, hourBranch: string): StarMap {
  const idx = BRANCHES.indexOf(hourBranch);
  for (const key of Object.keys(FIRE_STAR_TABLE)) {
    if (key.includes(yearBranch)) return { 火星: FIRE_STAR_TABLE[key][idx], 鈴星: RING_STAR_TABLE[key][idx] };
  }
  return { 火星: "未知", 鈴星: "未知" };
}

export function getGeneralStars(yearBranch: string): StarMap {
  for (const key of Object.keys(GENERAL_STARS_TABLE)) {
    if (key.includes(yearBranch)) return { ...GENERAL_STARS_TABLE[key] };
  }
  return {};
}

export const getBirth12Stars = (branch: string): StarMap => ({ ...(BIRTH12_STARS_TABLE[branch] ?? {}) });

/** stars/days.py：三台八座恩光天貴（依日數從輔弼昌曲起數） */
function countPalacePosition(start: string, count: number, clockwise: boolean): string {
  const s = BRANCHES.indexOf(start);
  const t = clockwise ? mod(s + count - 1, 12) : mod(s - count + 1, 12);
  return BRANCHES[t];
}

export function getDaysStars(lunarMonth: number, lunarDay: number, hourBranch: string): StarMap {
  const moon = getMoonStars(lunarMonth);
  const hour = getHourStars(hourBranch);
  const santai = countPalacePosition(moon["左輔"], lunarDay, true);
  const bazuo = countPalacePosition(moon["右弼"], lunarDay, false);
  const enguang = countPalacePosition(countPalacePosition(hour["文昌"], lunarDay, true), 2, false);
  const tiangui = countPalacePosition(countPalacePosition(hour["文曲"], lunarDay, true), 2, false);
  return { 三台: santai, 八座: bazuo, 恩光: enguang, 天貴: tiangui };
}

/** stars/branch.py：天才（年支對宮名→該宮地支）、天壽（身宮順數至年支） */
export function getBranchStars(yearBranch: string, palaceInfo: PalaceInfo): StarMap {
  const palaceName = BRANCH_PALACE_TABLE[yearBranch];
  // Python 讀 "十二宮" 字串找宮名；「僕役」不在十二宮名（交友）內 → None
  const tiancai = palaceInfo.twelve[palaceName] ?? "";
  const s = BRANCHES.indexOf(palaceInfo.身宮);
  const t = BRANCHES.indexOf(yearBranch);
  const idx = mod(s + mod(t - s, 12), 12);
  return { 天才: tiancai, 天壽: BRANCHES[idx] };
}

export function getTenVoidStar(yearGz: string): string {
  const positions = TEN_VOID_TABLE[yearGz] ?? ["", ""];
  const isYang = "甲丙戊庚壬".includes(yearGz[0]);
  if (!(positions[0] && positions[1])) return "";
  if (isYang) return "子寅辰午申戌".includes(positions[0]) ? positions[0] : positions[1];
  return "丑卯巳未酉亥".includes(positions[0]) ? positions[0] : positions[1];
}

export function calculateStarBrightness(star: string, palace: string): string {
  const row = BRIGHTNESS_TABLE[star];
  if (!row || !(palace in row)) return "";
  const b = row[palace];
  return b !== 0 ? String(b) : "";
}

export function getStarsBrightness(stars: StarsInfo): StarsBrightness {
  const out: StarsBrightness = {};
  for (const map of Object.values(stars)) {
    for (const [star, palace] of Object.entries(map)) {
      const b = calculateStarBrightness(star, palace);
      if (b) out[star] = b;
    }
  }
  return out;
}

export function applyFourTransformationsSimplified(yearStem: string): FourTransInfo {
  const out: FourTransInfo = {};
  for (const [type, star] of Object.entries(FOUR_TRANSFORMATIONS[yearStem] ?? {})) out[type] = { 星曜: star };
  return out;
}

/** function/stars_main.py get_stars_info：回傳 [分類星曜, 亮度, 四化]。 */
export function getStarsInfo(
  bureau: string, lunarDay: number, lunarMonth: number, hourBranch: string,
  yearStem: string, yearBranch: string, palaceInfo: PalaceInfo,
): [StarsInfo, StarsBrightness, FourTransInfo] {
  const ziwei = getZiweiPosition(bureau, lunarDay);
  const major = getMajorStars(ziwei);
  const moon = getMoonStars(lunarMonth);
  const hour = getHourStars(hourBranch);
  const yearG = getYearGStars(yearStem);
  const yearZ = getYearZStars(yearBranch);
  const fireRing = getFireRingStars(yearBranch, hourBranch);
  const general = getGeneralStars(yearBranch);
  const birth12 = getBirth12Stars(yearBranch);
  const days = getDaysStars(lunarMonth, lunarDay, hourBranch);
  const branch = getBranchStars(yearBranch, palaceInfo);
  const tenVoid = { 旬空: getTenVoidStar(yearStem + yearBranch) };
  Object.assign(yearZ, branch);

  const g = (m: StarMap, k: string) => m[k] ?? "";
  const cls: StarsInfo = {
    主星: { ...major, 紫微: ziwei },
    輔星: {
      左輔: g(moon, "左輔"), 右弼: g(moon, "右弼"), 天馬: g(moon, "天馬"),
      文昌: g(hour, "文昌"), 文曲: g(hour, "文曲"),
      天鉞: g(yearG, "天鉞"), 天魁: g(yearG, "天魁"), 祿存: g(yearG, "祿存"),
    },
    煞星空劫: {
      火星: g(fireRing, "火星"), 鈴星: g(fireRing, "鈴星"),
      擎羊: g(yearG, "擎羊"), 陀羅: g(yearG, "陀羅"),
      地空: g(hour, "地空"), 地劫: g(hour, "地劫"),
    },
    人際星: { 天姚: g(moon, "天姚"), 天喜: g(yearZ, "天喜"), 紅鸞: g(yearZ, "紅鸞") },
    貴人星: { 台輔: g(hour, "台輔"), 天官: g(yearG, "天官"), 天貴: g(days, "天貴"), 天德: g(yearZ, "天德") },
    是非星: { 咸池: g(yearZ, "咸池"), 蜚廉: g(yearZ, "蜚廉") },
    靈性星: { 天巫: g(moon, "天巫"), 華蓋: g(yearZ, "華蓋"), 天虛: g(yearZ, "天虛"), 天哭: g(yearZ, "天哭"), 寡宿: g(yearZ, "寡宿") },
    才華星: { 龍池: g(yearZ, "龍池"), 鳳閣: g(yearZ, "鳳閣"), 天才: g(yearZ, "天才") },
    吉星: {
      封誥: g(hour, "封誥"), 天福: g(yearG, "天福"), 解神: g(yearZ, "解神"), 天壽: g(yearZ, "天壽"),
      三台: g(days, "三台"), 八座: g(days, "八座"), 恩光: g(days, "恩光"),
    },
    兇星: {
      陰煞: g(moon, "陰煞"), 天刑: g(moon, "天刑"), 孤辰: g(yearZ, "孤辰"), 破碎: g(yearZ, "破碎"),
      大耗: g(yearZ, "大耗"), 劫殺: g(yearZ, "劫殺"), 天月: g(moon, "天月"),
      截空: g(yearG, "截空"), 旬空: tenVoid["旬空"],
    },
    將星: general,
    歲星: birth12,
  };

  // 清理空值；空分類整組刪除
  for (const cat of Object.keys(cls)) {
    const kept: StarMap = {};
    for (const [k, v] of Object.entries(cls[cat])) if (v) kept[k] = v;
    if (Object.keys(kept).length) cls[cat] = kept; else delete cls[cat];
  }

  const fourTrans = applyFourTransformationsSimplified(yearStem);
  const brightness = getStarsBrightness(cls);
  return [cls, brightness, fourTrans];
}
