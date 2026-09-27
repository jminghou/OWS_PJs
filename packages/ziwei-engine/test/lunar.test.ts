/**
 * P1 農曆層驗證：1900–2100 每一天與 sxtwl 全比對。
 * 任何一天不同都要查到底（通常是節氣邊界或閏月），不可放寬。
 *
 * 已查明的差異（見 src/lunar/overrides.json）：
 *   - 2057 年九月 30 天：朔在 9-29 子夜前後，sxtwl 判初一為 9-28，lunar-typescript 為 9-29。
 *     以覆寫表對齊 sxtwl（DB 七萬張盤的真相）。
 *   - 1917-12-07、1927-09-08 的月干支：節氣落在次日 00:00 後一分鐘內，sxtwl 提前一天換月干。
 *     月干支不進排盤（p01_count 無消費者），只放行不覆寫。
 */
import { describe, expect, it } from "vitest";
import {
  calculateLunarDate, getCorrectYearGz, getLichunDate, getLunarNewYearDate,
  getMonthGzByYearGz, lunarToSolar, solarToLunar,
} from "../src/lunar";
import overrides from "../src/lunar/overrides.json";
import { loadChartIndex, loadChart, loadLunarRows } from "./golden";

const rows = loadLunarRows();
const MONTH_GZ_ALLOW = new Set<string>(overrides.monthGzMismatch);

describe("農曆層 vs sxtwl 黃金表", () => {
  it(`載入 ${rows.length} 天`, () => {
    expect(rows.length).toBeGreaterThan(73_000);
  });

  it("solarToLunar 逐日全等（農曆年月日、閏月、月干支、日干支、節氣、星期）", () => {
    const diffs: string[] = [];
    for (const r of rows) {
      const key = `${r.y}-${r.m}-${r.d}`;
      const L = solarToLunar(r.y, r.m, r.d);
      const mgz = MONTH_GZ_ALLOW.has(key) ? r.monthGz : L.monthGz;
      const got = [L.year, L.month, L.day, L.isLeap, mgz, L.dayGz, L.jieqi, L.week].join("|");
      const exp = [r.ly, r.lm, r.ld, r.leap, r.monthGz, r.dayGz, r.jieqi, r.week].join("|");
      if (got !== exp) diffs.push(`${key}: got ${got} expected ${exp}`);
    }
    expect(diffs, `${diffs.length} 天不同：\n` + diffs.slice(0, 60).join("\n")).toEqual([]);
  });

  it("月干支放行清單只有已查明的兩天", () => {
    expect([...MONTH_GZ_ALLOW].sort()).toEqual(["1917-12-7", "1927-9-8"]);
  });

  it("lunarToSolar 往返全等", () => {
    const diffs: string[] = [];
    for (const r of rows) {
      const s = lunarToSolar(r.ly, r.lm, r.ld, r.leap);
      if (s.year !== r.y || s.month !== r.m || s.day !== r.d) {
        diffs.push(`${r.ly}/${r.leap ? "閏" : ""}${r.lm}/${r.ld} → ${s.year}-${s.month}-${s.day}, expected ${r.y}-${r.m}-${r.d}`);
      }
    }
    expect(diffs, `${diffs.length} 天不同：\n` + diffs.slice(0, 60).join("\n")).toEqual([]);
  });

  it("不存在的農曆日期要丟錯", () => {
    const lastDay = (ly: number, lm: number) =>
      Math.max(...rows.filter((r) => r.ly === ly && r.lm === lm && !r.leap).map((r) => r.ld));
    expect(() => lunarToSolar(1980, 10, lastDay(1980, 10) + 1)).toThrow();
    expect(() => lunarToSolar(1980, 10, 1, true)).toThrow(); // 1980 無閏十月
    expect(() => lunarToSolar(2057, 8, 30)).toThrow(); // sxtwl：2057 八月只有 29 天（覆寫區）
    expect(lunarToSolar(2057, 9, 1)).toEqual({ year: 2057, month: 9, day: 28 });
  });

  it("立春與農曆新年（由表反推）", () => {
    for (const y of [1900, 1980, 2001, 2020, 2024, 2100]) {
      const lichun = rows.find((r) => r.y === y && r.jieqi === 3)!;
      expect(getLichunDate(y)).toEqual([lichun.m, lichun.d, 23, 30]);
      const ny = rows.find((r) => r.y === y && r.lm === 1 && r.ld === 1 && !r.leap)!;
      expect(getLunarNewYearDate(y)).toEqual([ny.m, ny.d]);
    }
  });

  it("年干支以農曆新年為界", () => {
    expect(getCorrectYearGz(1980, 2, 15)).toBe("己未"); // 除夕
    expect(getCorrectYearGz(1980, 2, 16)).toBe("庚申"); // 初一
    expect(getCorrectYearGz(1980, 2, 5)).toBe("己未"); // 立春已過但未過年
  });

  it("getMonthGzByYearGz 沿用 Python 公式", () => {
    // 非傳統五虎遁；宮干另由 palace_stems 實作，此函式只求與 Python 一致
    expect(getMonthGzByYearGz("甲子", 1)).toBe("甲寅");
    expect(getMonthGzByYearGz("庚申", 10)).toBe("乙亥");
  });
});

describe("calculateLunarDate vs 黃金盤的曆法數據", () => {
  const cases = loadChartIndex();
  it.skipIf(!cases.length)(`${cases.length} 張盤的年干支／時辰／星期／閏月`, () => {
    const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
    for (const e of cases) {
      const g = loadChart(e.file);
      const cal = g.calendar as Record<string, string>;
      const info = calculateLunarDate([e.year, e.month, e.day, e.hour, e.minute], e.gender);
      expect(info.yearGz, `${e.file} 年干支`).toBe(cal["生年干支"]);
      expect(SHICHEN[info.lunarDate[3]] + "時", `${e.file} 時辰`).toBe(cal["出生時辰"]);
      expect(info.weekDay, `${e.file} 星期`).toBe(cal["星期"]);
      expect(info.isLeapMonth, `${e.file} 閏月`).toBe(cal["閏年"]);
    }
  });
});
