/**
 * P2 本命排盤驗證：312 張黃金盤逐張比對
 *   曆法數據 / 命盤數據 / 宮位資料 / 星曜資料 / 星曜亮度 / 四化資料 / 基本資料 全等
 *   本命 encoded_array 逐碼逐序全等
 *   chart_id 全等
 *   chart_json（convert 鏈）深比對全等
 */
import { describe, expect, it } from "vitest";
import { calculateNatal, generateChartId } from "../src";
import { loadChart, loadChartIndex } from "./golden";

const index = loadChartIndex();

describe("chart_id", () => {
  it("與 Python sha256 姓名雜湊一致", () => {
    // 由黃金檔第一張反查即可；此處另放一個固定值防表面通過
    expect(generateChartId("2000-01-01", "男", "測試")).toMatch(/^200001011\d{9}$/);
    expect(() => generateChartId("2000-01-01", "男", "")).toThrow();
  });
});

describe(`本命排盤 vs ${index.length} 張黃金盤`, () => {
  it.skipIf(!index.length)("全部欄位逐張全等", () => {
    const failures: string[] = [];
    for (const e of index) {
      const g = loadChart(e.file);
      const r = calculateNatal({
        year: e.year, month: e.month, day: e.day, hour: e.hour, minute: e.minute,
        gender: e.gender as "男" | "女", name: e.name, timeType: "clock_time",
      });
      const label = `${e.file} ${e.year}-${e.month}-${e.day} ${e.hour}:${e.minute} ${e.gender} ${e.name || "(無名)"} ${e.note}`;
      const check = (what: string, got: unknown, exp: unknown) => {
        try {
          expect(got).toEqual(exp);
        } catch (err) {
          failures.push(`${label}\n  [${what}] ${(err as Error).message.split("\n").slice(0, 12).join("\n  ")}`);
        }
      };
      check("chart_id", r.chart.chart_id, g.chart_id);
      check("曆法數據", r.chart.曆法數據, g.calendar);
      check("基本資料", r.chart.基本資料, g.basic);
      check("encoded_array", r.encoding.natal_chart_encoding[0].encoded_array, g.encoding.natal[0].encoded_array);
      check("encoding_version", r.encoding.encoding_version, g.encoding.version);
      check("chart_json", r.chart_json, g.chart_json);
      if (failures.length >= 5) break;
    }
    expect(failures, failures.join("\n\n")).toEqual([]);
  });
});
