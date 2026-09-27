/**
 * 曆法工具：Python p01_count/core/sxtwl_utils.py 的逐函式對應物。
 *
 * 規則來源與註解一律沿用 Python 版；函式名改 camelCase，其餘一對一。
 * 年干支以「農曆新年」為界（不是立春），這是 Python 版明訂的義理，不可改。
 */
import { BRANCHES, JIEQI_LICHUN, STEMS, lunarToSolar, solarToLunar } from "./calendar";

export * from "./calendar";

export type Gender = "男" | "女";

/** 指定西曆年的立春（月, 日, 時, 分）。時分固定 23:30，沿用 Python 的保守設定。 */
export function getLichunDate(year: number): [number, number, number, number] {
  for (let day = 1; day <= 10; day++) {
    try {
      if (solarToLunar(year, 2, day).jieqi === JIEQI_LICHUN) return [2, day, 23, 30];
    } catch {
      /* 同 Python：略過 */
    }
  }
  return [2, 4, 23, 30];
}

/** 指定西曆年的農曆正月初一對應西曆（月, 日）。 */
export function getLunarNewYearDate(year: number): [number, number] {
  for (const month of [1, 2]) {
    for (let day = 1; day <= 31; day++) {
      try {
        const L = solarToLunar(year, month, day);
        if (L.month === 1 && L.day === 1 && !L.isLeap) return [month, day];
      } catch {
        /* 無效日期（如 2/30）略過 */
      }
    }
  }
  return [2, 1];
}

export function isAfterLichun(year: number, month: number, day: number, hour: number, minute: number): boolean {
  const [lm, ld, lh, lmi] = getLichunDate(year);
  const cur = month * 10000 + day * 100 + hour + minute / 100;
  const lichun = lm * 10000 + ld * 100 + lh + lmi / 100;
  return cur >= lichun;
}

export function isAfterLunarNewYear(year: number, month: number, day: number): boolean {
  const [nm, nd] = getLunarNewYearDate(year);
  return month * 100 + day >= nm * 100 + nd;
}

/** 年干支：以農曆新年為界（公元 4 年為甲子）。 */
export function getCorrectYearGz(year: number, month: number, day: number): string {
  const target = isAfterLunarNewYear(year, month, day) ? year : year - 1;
  const off = target - 4;
  return STEMS[mod(off, 10)] + BRANCHES[mod(off, 12)];
}

export function determineYinYangGender(yearStem: string, gender: Gender | string): string {
  if ("甲丙戊庚壬".includes(yearStem)) return gender === "男" ? "陽男" : "陽女";
  if ("乙丁己辛癸".includes(yearStem)) return gender === "男" ? "陰男" : "陰女";
  return "未知";
}

export { lunarToSolar };

export interface LunarDateInfo {
  /** (農曆年, 農曆月, 農曆日, 時辰索引 0..11) */
  lunarDate: [number, number, number, number];
  yearGz: string;
  monthGz: string;
  dayGz: string;
  /** "是" | "否"（沿用 Python 字串值，供排盤層逐字比對） */
  isLeapMonth: "是" | "否";
  lunarMonthName: string;
  weekDay: string;
  constellation: string;
  yinYangGender: string;
}

const LUNAR_MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const WEEK_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const CONSTELLATION_DATES: Array<[number, number]> = [
  [1, 20], [2, 19], [3, 21], [4, 20], [5, 21], [6, 22],
  [7, 23], [8, 23], [9, 23], [10, 24], [11, 23], [12, 22],
];
const CONSTELLATION_NAMES = [
  "摩羯座", "水瓶座", "雙魚座", "白羊座", "金牛座", "雙子座",
  "巨蟹座", "獅子座", "處女座", "天秤座", "天蠍座", "射手座", "摩羯座",
];

/** 對應 Python calculate_lunar_date(solar_date, gender)。 */
export function calculateLunarDate(
  solar: [number, number, number, number] | [number, number, number, number, number],
  gender: Gender | string,
): LunarDateInfo {
  const [year, month, day, hour] = solar;
  const L = solarToLunar(year, month, day);
  const lunarHour = Math.floor((hour + 1) / 2) % 12;
  const yearGz = getCorrectYearGz(year, month, day);
  const cIdx = CONSTELLATION_DATES.filter(([m, d]) => m < month || (m === month && d <= day)).length % 12;
  return {
    lunarDate: [L.year, L.month, L.day, lunarHour],
    yearGz,
    monthGz: L.monthGz,
    dayGz: L.dayGz,
    isLeapMonth: L.isLeap ? "是" : "否",
    lunarMonthName: `${L.isLeap ? "閏" : ""}${LUNAR_MONTH_NAMES[L.month - 1]}月`,
    weekDay: WEEK_NAMES[L.week],
    constellation: CONSTELLATION_NAMES[cIdx],
    yinYangGender: determineYinYangGender(yearGz[0], gender),
  };
}

/** 五虎遁月：由年干與農曆月推月干支。 */
export function getMonthGzByYearGz(yearGz: string, lunarMonth: number): string {
  const ys = STEMS.indexOf(yearGz[0]);
  const stem = STEMS[mod(ys * 2 + lunarMonth - 1, 10)];
  const branch = BRANCHES[mod(lunarMonth + 1, 12)];
  return stem + branch;
}

/** 當日節氣索引，無則 null（對應 Python get_solar_term）。 */
export function getSolarTerm(year: number, month: number, day: number): number | null {
  const jq = solarToLunar(year, month, day).jieqi;
  return jq < 0 ? null : jq;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}
