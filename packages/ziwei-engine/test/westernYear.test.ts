/**
 * 流年／小限西元年與大限西元區間一律從「出生所在的農曆年」起算
 * （對應 P_Union tests/test_flow_western_year.py；2026-10-23 修正生於正月初一前者晚一年）。
 */
import { describe, expect, it } from "vitest";
import { calculateChart } from "../src";

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const gzOfYear = (y: number) => STEMS[(((y - 4) % 10) + 10) % 10] + BRANCHES[(((y - 4) % 12) + 12) % 12];

function flowOf(year: number, month: number, day: number) {
  const r = calculateChart(
    { year, month, day, hour: 8, minute: 0, gender: "男", timeType: "clock_time" },
    { includeFlow: true },
  );
  return r.flow!;
}

describe("流盤西元年", () => {
  it("2018-01-01 生（丁酉年）：虛歲 1＝2017，2026＝丙午＝虛歲 10", () => {
    const f = flowOf(2018, 1, 1);
    const byAge = new Map(f.years.map((e) => [e.age, e]));
    expect(byAge.get(1)).toMatchObject({ year: 2017, name: "丁酉" });
    expect(byAge.get(10)).toMatchObject({ year: 2026, name: "丙午" });
  });

  for (const [y, m, d, note] of [
    [2018, 1, 1, "年前"],
    [2018, 2, 16, "正月初一當天"],
    [2018, 3, 1, "年後"],
  ] as const) {
    it(`${note}：每筆流年／小限的西元年干支＝該筆農曆年干支，大限起年＝同歲流年`, () => {
      const f = flowOf(y, m, d);
      for (const e of [...f.years, ...f.smallLimits]) expect(gzOfYear(e.year!)).toBe(e.name);
      const yearOfAge = new Map(f.years.map((e) => [e.age, e.year]));
      for (const dec of f.decades) {
        const a0 = Number(dec.ageRange.split("-")[0]);
        expect(Number(dec.yearRange.split("-")[0])).toBe(yearOfAge.get(a0));
      }
    });
  }
});
