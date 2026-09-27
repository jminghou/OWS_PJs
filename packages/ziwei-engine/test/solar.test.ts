/**
 * P4 真太陽時與離線地點：與 Python 引擎（GeographicDataManager ＋ SolarTimeCalculator）
 * 的快照逐筆比對（scripts/gen_ziwei_geo.py 產生 test/golden/solar.json）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateChart } from "../src";
import { allCities, calculateTimezone, geographicHierarchy, getGeoInfo, toAstroFormat } from "../src/geo";
import { buildClockTimeStr, computeSolarTimeStr, parseTimeStr } from "../src/solar";
import { GOLDEN_DIR } from "./golden";

const p = join(GOLDEN_DIR, "solar.json");
const golden = existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null;

describe("離線地點表", () => {
  it("階層與城市數一致", () => {
    const h = geographicHierarchy();
    const n = Object.values(h).reduce((a, c) => a + Object.values(c).reduce((b, l) => b + l.length, 0), 0);
    expect(allCities().length).toBe(n);
    expect(getGeoInfo("台北", "台灣")?.timezone).toBe("h8e");
    expect(getGeoInfo("台北", "台灣")?.coordinates).toBe("25n01, 121e33");
    expect(getGeoInfo("不存在", "台灣")).toBeNull();
  });
  it("時區與座標格式沿用 Python", () => {
    expect(calculateTimezone(121.5)).toBe("h8e");
    expect(calculateTimezone(-74)).toBe("h5w");
    expect(calculateTimezone(3)).toBe("h0e");
    expect(toAstroFormat(25.0330, 121.5654)).toBe("25n01, 121e33");
    expect(toAstroFormat(-33.8688, 151.2093)).toBe("33s52, 151e12");
  });
});

describe.skipIf(!golden)("真太陽時 vs Python 快照", () => {
  it(`${golden?.samples?.length ?? 0} 筆（城 × 時刻）全等`, () => {
    const diffs: string[] = [];
    for (const s of golden.samples as any[]) {
      const info = getGeoInfo(s.city, s.country)!;
      const [y, m, d, h, mi] = s.clock;
      const clock = buildClockTimeStr(y, m, d, h, mi);
      const got = computeSolarTimeStr(clock, `${info.place_en}, ${info.coordinates}`, info.timezone);
      if (got !== s.solar_str) diffs.push(`${s.city}|${s.country} ${clock}: got ${got} expected ${s.solar_str}`);
      else if (got) {
        const t = parseTimeStr(got);
        if ([t.year, t.month, t.day, t.hour, t.minute].join() !== s.solar.join()) diffs.push(`${s.city} parse mismatch`);
      }
    }
    expect(diffs, `${diffs.length} 筆不同：\n` + diffs.slice(0, 30).join("\n")).toEqual([]);
  });

  it("calculateChart 的 solar_time 路徑與 API 同義", () => {
    const r = calculateChart({
      year: 1980, month: 11, day: 17, hour: 10, minute: 0, gender: "男", name: "測試",
      timeType: "solar_time", place: { city: "台北", country: "台灣" },
    }, { includeFlow: false });
    expect(r.solar_time).toMatch(/^17 November 1980 at \d{2}:\d{2}$/);
    expect(r.chart.基本資料.出生地).toBe("台北, 台灣");
    // 太陽時與鐘錶時都記太陽時（API 路徑亦然）
    expect(r.chart.曆法數據.太陽時間).toBe(r.chart.曆法數據.鐘錶時間);
  });
});
