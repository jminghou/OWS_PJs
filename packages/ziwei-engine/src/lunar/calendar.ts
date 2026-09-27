/**
 * 農曆層：對 lunar-typescript 的最薄包裝，介面刻意對齊 Python 端的 sxtwl。
 *
 * 只有這一個檔案知道底層是 lunar-typescript；上層（sxtwl_utils 對應物、排盤）
 * 只看 SolarDay / LunarDay 這兩個型別。日後換農曆庫只動這裡。
 *
 * 與 sxtwl 的對應：
 *   sxtwl.fromSolar(y,m,d)            → solarToLunar(y,m,d)
 *   sxtwl.fromLunar(ly,lm,ld,leap)     → lunarToSolar(ly,lm,ld,leap)
 *   getLunarYear/Month/Day, isLunarLeap → year/month/day/isLeap
 *   getMonthGZ / getDayGZ              → monthGz / dayGz（干支兩字）
 *   getJieQi()（255＝無）               → jieqi（-1＝無；0＝冬至 … 3＝立春 … 23＝大雪）
 *   getWeek()                          → week（0＝日）
 *
 * 節氣索引沿用 sxtwl 的順序（冬至起算），黃金檔 lunar.csv 直接用同一套數字。
 */
import { Lunar, Solar } from "lunar-typescript";
import overridesJson from "./overrides.json";

/**
 * sxtwl 與 lunar-typescript 不一致的日子（目前只有 2057 年九月：朔在 9-29 子夜前後，
 * 兩套曆算對「初一是哪天」判定不同）。DB 七萬張盤都以 sxtwl 為準，引擎用覆寫表對齊，
 * 表由 scripts/gen-lunar-overrides.mjs 從黃金表產生。
 */
const OVERRIDES = overridesJson.overrides as unknown as Record<string, [number, number, number, number]>;
const REVERSE_OVERRIDES = new Map<string, SolarDate>(
  Object.entries(OVERRIDES).map(([solar, [ly, lm, ld, leap]]) => {
    const [y, m, d] = solar.split("-").map(Number);
    return [`${ly}-${lm}-${ld}-${leap}`, { year: y, month: m, day: d }];
  }),
);

export const STEMS = "甲乙丙丁戊己庚辛壬癸";
export const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";

/** 節氣順序（sxtwl 索引 0..23）。lunar-typescript 的 getJieQi() 回簡體名，故用簡體對表。 */
export const JIEQI_ORDER = [
  "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种",
  "夏至", "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪",
] as const;

export const JIEQI_LICHUN = 3;

const JIEQI_INDEX: Record<string, number> = Object.fromEntries(
  JIEQI_ORDER.map((n, i) => [n, i]),
);

export interface LunarDay {
  /** 農曆年（未過農曆新年即為前一年，與 sxtwl getLunarYear 同義） */
  year: number;
  /** 農曆月 1..12（閏月以 isLeap 標示，month 仍為正數） */
  month: number;
  day: number;
  isLeap: boolean;
  /** 月干支（依節氣分月，與 sxtwl getMonthGZ 同義） */
  monthGz: string;
  dayGz: string;
  /** 當日節氣索引（sxtwl 順序），無則 -1 */
  jieqi: number;
  /** 星期 0..6（0＝日） */
  week: number;
}

export interface SolarDate {
  year: number;
  month: number;
  day: number;
}

export function solarToLunar(year: number, month: number, day: number): LunarDay {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const m = lunar.getMonth();
  const jq = lunar.getJieQi();
  const ov = OVERRIDES[`${year}-${month}-${day}`];
  return {
    year: ov ? ov[0] : lunar.getYear(),
    month: ov ? ov[1] : Math.abs(m),
    day: ov ? ov[2] : lunar.getDay(),
    isLeap: ov ? ov[3] === 1 : m < 0,
    monthGz: lunar.getMonthInGanZhi(),
    dayGz: lunar.getDayInGanZhi(),
    jieqi: jq ? (JIEQI_INDEX[jq] ?? -1) : -1,
    week: solar.getWeek(),
  };
}

/**
 * 農曆 → 西曆。農曆日不存在（該月僅 29 天卻給 30、或指定閏月不存在）時丟 Error，
 * 對應 Python 的 ValueError。
 */
export function lunarToSolar(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  isLeap = false,
): SolarDate {
  const rev = REVERSE_OVERRIDES.get(`${lunarYear}-${lunarMonth}-${lunarDay}-${isLeap ? 1 : 0}`);
  if (rev) return rev;
  const m = isLeap ? -lunarMonth : lunarMonth;
  let lunar: Lunar;
  try {
    lunar = Lunar.fromYmd(lunarYear, m, lunarDay);
  } catch (e) {
    throw new Error(
      `無效的農曆日期 ${lunarYear}年${isLeap ? "閏" : ""}${lunarMonth}月${lunarDay}日：${(e as Error).message}`,
    );
  }
  // lunar-typescript 對不存在的日子可能不丟錯而是「溢位」到下個月；且覆寫表可能把該西曆日
  // 判給另一個農曆日（如 2057-9-28）。一律用 solarToLunar（含覆寫）往返驗證。
  const s = lunar.getSolar();
  const back = solarToLunar(s.getYear(), s.getMonth(), s.getDay());
  if (back.year !== lunarYear || back.month !== lunarMonth || back.day !== lunarDay || back.isLeap !== isLeap) {
    throw new Error(`無效的農曆日期 ${lunarYear}年${isLeap ? "閏" : ""}${lunarMonth}月${lunarDay}日`);
  }
  return { year: s.getYear(), month: s.getMonth(), day: s.getDay() };
}
