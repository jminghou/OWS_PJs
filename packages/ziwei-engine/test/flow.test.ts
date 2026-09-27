/**
 * P3 流盤驗證：312 張黃金盤
 *   大限編碼 12 筆全等（含 encoded_array 逐碼）
 *   小限／流年編碼：取樣年齡逐筆全等 ＋ 全量 120 筆 sha256 全等（前 5 張為全量比對）
 *   flow.decades 全等、years／smallLimits 取樣全等 ＋ 全量 sha256 全等
 */
import { describe, expect, it } from "vitest";
import { calculateChart, sha256Of } from "../src";
import { loadChart, loadChartIndex } from "./golden";

const index = loadChartIndex();

function byAge<T extends { age: unknown }>(list: T[], ages: unknown[]): T[] {
  const want = new Set(ages.map(String));
  return list.filter((e) => want.has(String(e.age)));
}

describe(`流盤 vs ${index.length} 張黃金盤`, () => {
  it.skipIf(!index.length)("大限／小限／流年編碼與 FlowData 全等", () => {
    const failures: string[] = [];
    for (const e of index) {
      const g = loadChart(e.file);
      const r = calculateChart({
        year: e.year, month: e.month, day: e.day, hour: e.hour, minute: e.minute,
        gender: e.gender as "男" | "女", name: e.name, timeType: "clock_time",
      });
      const label = `${e.file} ${e.year}-${e.month}-${e.day} ${e.hour}:${e.minute} ${e.gender} ${e.note}`;
      const check = (what: string, got: unknown, exp: unknown) => {
        try {
          expect(got).toEqual(exp);
        } catch (err) {
          failures.push(`${label}\n  [${what}] ${(err as Error).message.split("\n").slice(0, 14).join("\n  ")}`);
        }
      };
      const enc = r.encoding;
      const ge = g.encoding;
      check("decade_chart_encoding", enc.decade_chart_encoding, ge.decade);
      check("small_limit_count", enc.small_limit_encoding!.length, ge.small_limit_count);
      check("year_flow_count", enc.year_flow_encoding!.length, ge.year_flow_count);
      const sAges = ge.small_limit_sample.map((x: any) => x.age);
      const yAges = ge.year_flow_sample.map((x: any) => x.age);
      check("small_limit_sample", byAge(enc.small_limit_encoding!, sAges), ge.small_limit_sample);
      check("year_flow_sample", byAge(enc.year_flow_encoding!, yAges), ge.year_flow_sample);
      check("small_limit_sha256", sha256Of(enc.small_limit_encoding), ge.small_limit_sha256);
      check("year_flow_sha256", sha256Of(enc.year_flow_encoding), ge.year_flow_sha256);

      const f = r.flow!;
      const gf = g.flow;
      check("flow.decades", f.decades, gf.decades);
      check("flow.years_sample", byAge(f.years, gf.years_sample.map((x: any) => x.age)), gf.years_sample);
      check("flow.smallLimits_sample", byAge(f.smallLimits, gf.smallLimits_sample.map((x: any) => x.age)), gf.smallLimits_sample);
      check("flow.years_sha256", sha256Of(f.years), gf.years_sha256);
      check("flow.smallLimits_sha256", sha256Of(f.smallLimits), gf.smallLimits_sha256);
      if (failures.length >= 4) break;
    }
    expect(failures, failures.join("\n\n")).toEqual([]);
  });
});
