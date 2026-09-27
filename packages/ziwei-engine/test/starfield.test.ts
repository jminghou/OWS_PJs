/**
 * P3b 星場驗證：312 張黃金盤的 star_energy 與 readings 深比對全等
 * （每個數字都經 Python round 對齊；差一個 bit 就會抓到）。
 */
import { describe, expect, it } from "vitest";
import { buildV3Views, calculateNatal } from "../src";
import { pyDisp, pyFixed, pyRound } from "../src/util/pyround";
import { firstDiff } from "./diff";
import { loadChart, loadChartIndex } from "./golden";

describe("pyround 對齊 Python", () => {
  it("round-half-even 與 :.2f", () => {
    expect(pyRound(0.125, 2)).toBe(0.12);   // Python round(0.125, 2) == 0.12
    expect(pyRound(0.375, 2)).toBe(0.38);
    expect(pyRound(2.675, 2)).toBe(2.67);   // 二進位 2.675 略小於 2.675
    expect(pyRound(1.495, 4)).toBe(1.495);
    expect(pyFixed(1.2, 2)).toBe("1.20");
    expect(pyDisp(1.2)).toBe("1.2");
    expect(pyDisp(0)).toBe("0");
    expect(pyDisp(0.5599999999999999)).toBe("0.56");
    expect(pyRound(-0.15, 4)).toBe(-0.15);
  });
});

const index = loadChartIndex();

describe(`星場 vs ${index.length} 張黃金盤`, () => {
  it.skipIf(!index.length)("star_energy 與 readings 全等", () => {
    const failures: string[] = [];
    for (const e of index) {
      const g = loadChart(e.file);
      const r = calculateNatal({
        year: e.year, month: e.month, day: e.day, hour: e.hour, minute: e.minute,
        gender: e.gender as "男" | "女", name: e.name, timeType: "clock_time",
      });
      const views = buildV3Views(r.encoding.natal_chart_encoding[0].encoded_array);
      const label = `${e.file} ${e.year}-${e.month}-${e.day} ${e.hour}:${e.minute} ${e.gender} ${e.note}`;
      const check = (what: string, got: unknown, exp: unknown) => {
        const diffs = firstDiff(got, exp);
        if (diffs.length) failures.push(`${label}\n  [${what}]\n  ` + diffs.join("\n  "));
      };
      check("star_energy", views.star_energy, g.star_energy);
      check("readings", views.readings, g.readings);
      if (failures.length >= 3) break;
    }
    expect(failures, failures.join("\n\n")).toEqual([]);
  });
});
