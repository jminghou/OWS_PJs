/**
 * 流盤資料層：flow/decade_palace.py、decade_star.py、decade_trans.py、
 * small_limit_palace.py、small_limit_star.py、year_palace.py、year_star.py 的對應物。
 *
 * 輸出沿用 Python 的中文鍵與「逗號串」格式（歲數 "3,15,27,…"），因為 encoder_flow
 * 就是吃這些字串；一路逐字對齊，黃金檔才能直接比對。
 */
import { BRANCHES, STEMS } from "../lunar";
import type { NatalChart } from "../natal/chart";
import { calculateTwelvePalaces } from "../natal/palaces";
import { getMoonStars, getYearGStars, getYearZStars } from "../natal/stars";
import { FOUR_TRANSFORMATIONS, PALACE_NAMES, mod } from "../natal/tables";

export interface DecadePalace {
  大限順序: string; 大限名稱: string; 大限歲數: string; 大限西元區間: string; 宮位: string;
  年干: string; 地支: string; 大限星曜: Record<string, string>;
}
export type DecadeData = Record<string, DecadePalace>;
export type DecadeSihua = Record<string, { 大限順序: string; 年干: string; 星曜: string }>;

export interface AgeLayerPalace {
  歲數: string; 宮位: string;
  /** 小限用 小限農曆年／小限西元年、流年用 流年農曆年／流年西元年（鍵名沿用 Python） */
  [k: string]: string | Array<Record<string, string>>;
}
export type SmallLimitData = Record<string, AgeLayerPalace>;
export type YearFlowData = Record<string, AgeLayerPalace>;

/** 地支 → 月（天馬轉大馬／小馬／年馬用） */
const BRANCH_TO_MONTH: Record<string, number> = {
  寅: 1, 卯: 2, 辰: 3, 巳: 4, 午: 5, 未: 6, 申: 7, 酉: 8, 戌: 9, 亥: 10, 子: 11, 丑: 12,
};
const STEM_STAR_LIST = ["擎羊", "陀羅", "天鉞", "天魁", "祿存"];
const BRANCH_STAR_LIST = ["天喜", "紅鸞"];

function horseByBranch(branch: string): string {
  const m = BRANCH_TO_MONTH[branch];
  return m ? (getMoonStars(m)["天馬"] ?? "") : "";
}

// ── 大限 ──

const FORWARD_ORDER = ["命宮", "父母", "福德", "田宅", "官祿", "交友", "遷移", "疾厄", "財帛", "子女", "夫妻", "兄弟"];
const BACKWARD_ORDER = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "交友", "官祿", "田宅", "福德", "父母"];

/** decade_palace.get_ten_palace_info ＋ decade_star.get_ten_star_info 合併。 */
export function buildDecadeData(chart: NatalChart): DecadeData {
  const yinYang = chart.命盤數據.陰陽;
  const bureau = chart.命盤數據.五行局;
  const m = bureau.match(/([二三四五六])/);
  const bureauNumber = m ? ({ 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 } as Record<string, number>)[m[1]] : 2;
  const birthYear = chart._solar[0];
  const twelve = chart._palaceInfo.twelve;
  const palaceGz = chart._palaceInfo.palaceGz;

  // 陽男／陰女順行（第二大限進父母）；陰男逆行；陽女落 Python 預設分支＝逆行同序
  const order = (yinYang === "陽男" || yinYang === "陰女") ? FORWARD_ORDER : BACKWARD_ORDER;
  const orderMap: Record<string, number> = {};
  order.forEach((n, i) => { orderMap[n] = i + 1; });

  const out: DecadeData = {};
  for (const name of PALACE_NAMES) {
    const k = orderMap[name];
    const a = bureauNumber + (k - 1) * 10;
    const b = a + 9;
    const branch = twelve[name];
    const gz = palaceGz[branch] ?? "";
    const limitName = gz ? `${gz}限` : `${branch}限`;
    const stem = limitName[0];
    // 大限星曜（decade_star）：干系依大限年干（＝宮干）、支系依大限宮位地支、大馬依地支月
    const stemStars = getYearGStars(stem);
    const branchStars = getYearZStars(branch);
    const stars: Record<string, string> = {};
    for (const s of STEM_STAR_LIST) if (s in stemStars) stars[`大${s === "擎羊" ? "羊" : s === "陀羅" ? "陀" : s === "天鉞" ? "鉞" : s === "天魁" ? "魁" : "祿"}`] = stemStars[s];
    for (const s of BRANCH_STAR_LIST) if (s in branchStars) stars[s === "天喜" ? "大喜" : "大鸞"] = branchStars[s];
    const horse = horseByBranch(branch);
    if (horse) stars["大馬"] = horse;
    out[name] = {
      大限順序: String(k),
      大限名稱: limitName,
      大限歲數: `${a}-${b}`,
      大限西元區間: `${birthYear + a - 1}-${birthYear + b - 1}`,
      宮位: branch,
      年干: stem,
      地支: branch,
      大限星曜: stars,
    };
  }
  return out;
}

/** decade_trans.get_ten_4trans_data */
export function buildDecadeSihua(decade: DecadeData): DecadeSihua {
  const acc: Record<string, { o: string[]; s: string[]; st: string[] }> = {
    祿: { o: [], s: [], st: [] }, 權: { o: [], s: [], st: [] }, 科: { o: [], s: [], st: [] }, 忌: { o: [], s: [], st: [] },
  };
  const sorted = Object.values(decade).sort((x, y) => +x.大限順序 - +y.大限順序);
  for (const p of sorted) {
    if (!p.年干) continue;
    for (const [type, star] of Object.entries(FOUR_TRANSFORMATIONS[p.年干] ?? {})) {
      if (!(type in acc)) continue;
      acc[type].o.push(p.大限順序); acc[type].s.push(p.年干); acc[type].st.push(star);
    }
  }
  const out: DecadeSihua = {};
  for (const [type, v] of Object.entries(acc)) out[type] = { 大限順序: v.o.join(","), 年干: v.s.join(","), 星曜: v.st.join(",") };
  return out;
}

// ── 小限 ──

const ONE_LIMIT_TABLE: Record<string, string[]> = {
  "寅午戌,男": ["辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯"],
  "寅午戌,女": ["辰", "卯", "寅", "丑", "子", "亥", "戌", "酉", "申", "未", "午", "巳"],
  "申子辰,男": ["戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉"],
  "申子辰,女": ["戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥"],
  "巳酉丑,男": ["未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午"],
  "巳酉丑,女": ["未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌", "酉", "申"],
  "亥卯未,男": ["丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子"],
  "亥卯未,女": ["丑", "子", "亥", "戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅"],
};

function yearBranchGroup(b: string): string {
  for (const g of ["寅午戌", "申子辰", "巳酉丑", "亥卯未"]) if (g.includes(b)) return g;
  return "寅午戌";
}

const MAX_AGE = 120;

function gzOfAge(birthStem: string, birthBranch: string, age: number): string {
  const si = STEMS.indexOf(birthStem);
  const bi = BRANCHES.indexOf(birthBranch);
  return STEMS[mod(si + age - 1, 10)] + BRANCHES[mod(bi + age - 1, 12)];
}

/** small_limit_palace.get_one_palace_data ＋ small_limit_star（新格式）合併。 */
export function buildSmallLimitData(chart: NatalChart): SmallLimitData {
  const gender = chart.基本資料.性別 || "男";
  const { yearStem, yearBranch } = chart._lunar;
  const birthYear = chart._solar[0];
  const positions = ONE_LIMIT_TABLE[`${yearBranchGroup(yearBranch)},${gender}`];
  if (!positions) return {};
  const twelve = calculateTwelvePalaces(chart._palaceInfo.命宮);

  const out: SmallLimitData = {};
  for (const name of PALACE_NAMES) {
    const branch = twelve[name];
    const ages: string[] = []; const years: string[] = []; const lunarYears: string[] = [];
    for (let age = 1; age <= MAX_AGE; age++) {
      if (positions[(age - 1) % 12] === branch) {
        ages.push(String(age));
        years.push(String(birthYear + age - 1));
        lunarYears.push(gzOfAge(yearStem, yearBranch, age));
      }
    }
    if (!ages.length) continue;
    const palaceStem = (chart.宮位資料[name]?.干支 ?? "")[0] ?? "";
    if (!palaceStem || !branch) continue; // small_limit_star：無宮干則整宮跳過
    const n = Math.min(ages.length, 10);
    const stemStars = getYearGStars(palaceStem);
    const branchStars = getYearZStars(branch);
    const horse = horseByBranch(branch);
    const rep = (v: string) => Array(n).fill(v).join(",");
    const star: Record<string, string> = {};
    const stemRename: Record<string, string> = { 擎羊: "小羊", 陀羅: "小陀", 天鉞: "小鉞", 天魁: "小魁", 祿存: "小祿" };
    const branchRename: Record<string, string> = { 天喜: "小喜", 紅鸞: "小鸞", 天馬: "小馬" };
    for (const [o, nn] of Object.entries(stemRename)) if (o in stemStars) star[nn] = rep(stemStars[o]);
    for (const [o, nn] of Object.entries(branchRename)) if (o in branchStars) star[nn] = rep(branchStars[o]);
    if (horse) star["小馬"] = rep(horse);
    out[name] = {
      歲數: ages.slice(0, 10).join(","),
      小限農曆年: lunarYears.slice(0, 10).join(","),
      小限西元年: years.slice(0, 10).join(","),
      宮位: branch,
      小限星曜: Object.keys(star).length ? [star] : [],
    };
  }
  return out;
}

// ── 流年 ──

/** year_palace.get_year_palace_data ＋ year_star.calculate_year_star_position 合併。 */
export function buildYearFlowData(chart: NatalChart): YearFlowData {
  const { yearStem, yearBranch } = chart._lunar;
  const birthYear = chart._solar[0];
  const bi = BRANCHES.indexOf(yearBranch);
  const byBranch: Record<string, { ages: string[]; gz: string[]; years: string[] }> = {};
  for (const b of BRANCHES) byBranch[b] = { ages: [], gz: [], years: [] };
  for (let age = 1; age <= MAX_AGE; age++) {
    const b = BRANCHES[mod(bi + age - 1, 12)];
    byBranch[b].ages.push(String(age));
    byBranch[b].gz.push(gzOfAge(yearStem, yearBranch, age));
    byBranch[b].years.push(String(birthYear + age - 1));
  }
  const stemRename: Record<string, string> = { 擎羊: "年羊", 陀羅: "年陀", 天鉞: "年鉞", 天魁: "年魁", 祿存: "年祿" };
  const branchRename: Record<string, string> = { 天喜: "年喜", 紅鸞: "年鸞", 天馬: "年馬" };

  const out: YearFlowData = {};
  for (const name of PALACE_NAMES) {
    const branch = chart.宮位資料[name]?.宮位;
    if (!branch || !(branch in byBranch)) continue;
    const d = byBranch[branch];
    const ages = d.ages.slice(0, 10), gzs = d.gz.slice(0, 10), years = d.years.slice(0, 10);
    const lists: Record<string, string[]> = {};
    for (const nn of Object.values(stemRename)) lists[nn] = [];
    for (const nn of Object.values(branchRename)) lists[nn] = [];
    for (const gz of gzs.slice(0, 10)) {
      const stemStars = getYearGStars(gz[0]);
      const branchStars = getYearZStars(gz[1]);
      for (const [o, nn] of Object.entries(stemRename)) if (o in stemStars) lists[nn].push(stemStars[o]);
      for (const [o, nn] of Object.entries(branchRename)) if (o in branchStars) lists[nn].push(branchStars[o]);
      const horse = horseByBranch(gz[1]);
      if (horse) lists["年馬"].push(horse);
    }
    const star: Record<string, string> = {};
    for (const [k, v] of Object.entries(lists)) if (v.length) star[k] = v.join(",");
    out[name] = {
      歲數: ages.join(","),
      流年農曆年: gzs.join(","),
      流年西元年: years.join(","),
      宮位: branch,
      流年星曜: Object.keys(star).length ? [star] : [],
    };
  }
  return out;
}

export interface FlowRaw {
  大限資料: DecadeData;
  大限四化: DecadeSihua;
  小限資料: SmallLimitData;
  流年資料: YearFlowData;
}

export function buildFlowRaw(chart: NatalChart): FlowRaw {
  const 大限資料 = buildDecadeData(chart);
  return {
    大限資料,
    大限四化: buildDecadeSihua(大限資料),
    小限資料: buildSmallLimitData(chart),
    流年資料: buildYearFlowData(chart),
  };
}
