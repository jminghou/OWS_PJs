/**
 * 真太陽時、夏令時與離線地點：與後端 extensions/astrology/birthplace.py 的快照逐筆比對
 * （scripts/gen_ziwei_geo.py 產生 test/golden/solar.json：每城 × 樣本時刻 × 兩種時間類型）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateChart } from "../src";
import { astroCoordinates, BirthplaceError, offsetToken, resolveBirthTime, wallOffsetSeconds } from "../src/birth";
import { allCities, calculateTimezone, geographicHierarchy, getGeoInfo, toAstroFormat } from "../src/geo";
import { GOLDEN_DIR } from "./golden";

const p = join(GOLDEN_DIR, "solar.json");
const golden = existsSync(p) ? JSON.parse(readFileSync(p, "utf-8")) : null;
// 全球城市（GeoNames，scripts/gen_world_places.py 產生）：前端帶 lat／lon／tz 換算，與後端 place={geonameid} 逐筆比對
const pw = join(GOLDEN_DIR, "world_solar.json");
const worldGolden = existsSync(pw) ? JSON.parse(readFileSync(pw, "utf-8")) : null;

describe("離線地點表", () => {
  it("階層與城市數一致，每城都有 IANA 時區", () => {
    const h = geographicHierarchy();
    const n = Object.values(h).reduce((a, c) => a + Object.values(c).reduce((b, l) => b + l.length, 0), 0);
    expect(allCities().length).toBe(n);
    expect(allCities().every((c) => c.tz)).toBe(true);
    expect(getGeoInfo("台北", "台灣")?.tz).toBe("Asia/Taipei");
    expect(getGeoInfo("成都", "中國")?.tz).toBe("Asia/Shanghai");
    expect(getGeoInfo("不存在", "台灣")).toBeNull();
  });
  it("座標格式沿用 Python", () => {
    expect(calculateTimezone(121.5)).toBe("h8e");
    expect(toAstroFormat(25.0330, 121.5654)).toBe("25n01, 121e33");
    expect(toAstroFormat(-33.8688, 151.2093)).toBe("33s52, 151e12");
  });
});

describe("時差", () => {
  const c = (year: number, month: number, day: number, hour = 12, minute = 0) => ({ year, month, day, hour, minute });
  it("歷史時區與夏令時", () => {
    expect(wallOffsetSeconds("Asia/Taipei", c(1975, 7, 15))).toBe(9 * 3600);   // 台灣夏令時
    expect(wallOffsetSeconds("Asia/Taipei", c(1980, 7, 15))).toBe(8 * 3600);
    expect(wallOffsetSeconds("Asia/Singapore", c(1975, 1, 15))).toBe(7.5 * 3600);
    expect(wallOffsetSeconds("Asia/Kolkata", c(1990, 1, 15))).toBe(5.5 * 3600);
  });
  it("夏令時切換：不存在與重疊的時刻取切換前的時差（同 Python fold=0）", () => {
    expect(wallOffsetSeconds("America/New_York", c(2010, 3, 14, 2, 30))).toBe(-5 * 3600);
    expect(wallOffsetSeconds("America/New_York", c(2010, 11, 7, 1, 30))).toBe(-4 * 3600);
  });
  it("時區字串", () => {
    expect(offsetToken(8 * 3600)).toBe("h8e");
    expect(offsetToken(5.5 * 3600)).toBe("h5.5e");
    expect(offsetToken(-3 * 3600)).toBe("h3w");
  });
});

describe("出生時間換算", () => {
  it("一般時間：有出生地就扣夏令時差，可能跨日", () => {
    const b = resolveBirthTime({ year: 1979, month: 8, day: 1, hour: 0, minute: 30, timeType: "clock_time",
                                 place: { city: "台北", country: "台灣" } });
    expect(b.dst_minutes).toBe(60);
    expect(b.resolved).toEqual({ year: 1979, month: 7, day: 31, hour: 23, minute: 30 });
  });
  it("一般時間：沒給出生地維持原樣", () => {
    const b = resolveBirthTime({ year: 1975, month: 7, day: 15, hour: 10, minute: 0 });
    expect(b.resolved.hour).toBe(10);
    expect(b.tz).toBeNull();
  });
  it("查不到出生地一律報錯，不退回鐘錶時間", () => {
    expect(() => resolveBirthTime({ year: 1980, month: 1, day: 1, hour: 1, minute: 0, timeType: "solar_time",
                                    place: { city: "Taipei", country: "Taiwan" } })).toThrow(BirthplaceError);
    expect(() => resolveBirthTime({ year: 1980, month: 1, day: 1, hour: 1, minute: 0, timeType: "solar_time" }))
      .toThrow(BirthplaceError);
  });
});

// 兩邊時區資料版本不同造成的已知差異（後端 pip tzdata 較新、Node/瀏覽器 ICU 較舊）。
// 建單一律以後端為準，前端只是預覽；ICU 跟上之後這裡的項目會自然消失。
const KNOWN_TZDATA_DIFFS = [
  // tzdata 2025c 更正下加州 1975 年有夏令時；Node 22 內建 2025b 還是全年 UTC-8
  { city: "蒂華納", country: "墨西哥", year: 1975 },
];
const isKnownDiff = (s: any) =>
  KNOWN_TZDATA_DIFFS.some((k) => k.city === s.city && k.country === s.country && k.year === s.clock[0]);

describe.skipIf(!golden)("出生時間換算 vs Python 快照", () => {
  it(`${golden?.samples?.length ?? 0} 筆（城 × 時刻 × 時間類型）全等`, () => {
    const diffs: string[] = [];
    for (const s of golden.samples as any[]) {
      if (isKnownDiff(s)) continue;
      const [year, month, day, hour, minute] = s.clock;
      const b = resolveBirthTime({ year, month, day, hour, minute, timeType: s.time_type,
                                   place: { city: s.city, country: s.country } });
      const got = [b.resolved.year, b.resolved.month, b.resolved.day, b.resolved.hour, b.resolved.minute];
      if (got.join() !== s.resolved.join() || b.solar_time !== s.solar_str
          || b.utc_offset_minutes !== s.utc_offset_minutes || b.dst_minutes !== s.dst_minutes) {
        diffs.push(`${s.city}|${s.country} ${s.clock} ${s.time_type}: got ${got} ${b.solar_time} `
                   + `off=${b.utc_offset_minutes} dst=${b.dst_minutes}; expected ${s.resolved} ${s.solar_str} `
                   + `off=${s.utc_offset_minutes} dst=${s.dst_minutes}`);
      }
    }
    expect(diffs, `${diffs.length} 筆不同：\n` + diffs.slice(0, 30).join("\n")).toEqual([]);
  });

  it("calculateChart 的 solar_time 路徑與 API 同義", () => {
    const r = calculateChart({
      year: 1980, month: 11, day: 17, hour: 10, minute: 0, gender: "男", name: "測試",
      timeType: "solar_time", place: { city: "台北", country: "台灣" },
    }, { includeFlow: false });
    expect(r.solar_time).toBe("17 November 1980 at 10:21");
    expect(r.birth_time.tz).toBe("Asia/Taipei");
    expect(r.chart.基本資料.出生地).toBe("台北, 台灣");
    // 太陽時與鐘錶時都記太陽時（API 路徑亦然）
    expect(r.chart.曆法數據.太陽時間).toBe(r.chart.曆法數據.鐘錶時間);
  });
});

describe("全球城市（帶座標與時區）", () => {
  it("座標格式與後端 Birthplace.coordinates 相同（含 1e-6 分容差）", () => {
    expect(astroCoordinates(69.6489, 18.95508)).toBe("69n38, 18e57");
    expect(astroCoordinates(25 + 17 / 60, 121 + 33 / 60)).toBe("25n17, 121e33");
    expect(astroCoordinates(-33.86785, 151.20732)).toBe("33s52, 151e12");
  });
  it("座標優先於城市名：內建表沒有的城市也能換算", () => {
    const b = resolveBirthTime({ year: 2010, month: 7, day: 15, hour: 12, minute: 0, timeType: "clock_time",
                                 place: { city: "Tromsø", country: "挪威", lat: 69.6489, lon: 18.95508, tz: "Europe/Oslo" } });
    expect(b.tz).toBe("Europe/Oslo");
    expect(b.dst_minutes).toBe(60);
    expect(b.resolved.hour).toBe(11);
    expect(b.birthplace).toBe("Tromsø, 挪威");
  });
});

describe.skipIf(!worldGolden)("全球城市 vs Python 快照", () => {
  it(`${worldGolden?.samples?.length ?? 0} 筆（${worldGolden?.cities ?? 0} 個時區代表城市 × 時刻 × 時間類型）全等`, () => {
    const diffs: string[] = [];
    for (const s of worldGolden.samples as any[]) {
      if (s.tz === "America/Tijuana" && s.clock[0] === 1975) continue;  // 同 KNOWN_TZDATA_DIFFS（蒂華納 1975）
      const [year, month, day, hour, minute] = s.clock;
      const b = resolveBirthTime({ year, month, day, hour, minute, timeType: s.time_type,
                                   place: { city: s.city, country: s.country, lat: s.lat, lon: s.lon, tz: s.tz,
                                            place_en: s.place_en } });
      const got = [b.resolved.year, b.resolved.month, b.resolved.day, b.resolved.hour, b.resolved.minute];
      if (got.join() !== s.resolved.join() || b.solar_time !== s.solar_str || b.birthplace !== s.birthplace
          || b.utc_offset_minutes !== s.utc_offset_minutes || b.dst_minutes !== s.dst_minutes) {
        diffs.push(`${s.city}|${s.tz} ${s.clock} ${s.time_type}: got ${got} ${b.solar_time} off=${b.utc_offset_minutes} `
                   + `dst=${b.dst_minutes}; expected ${s.resolved} ${s.solar_str} off=${s.utc_offset_minutes} dst=${s.dst_minutes}`);
      }
    }
    expect(diffs, `${diffs.length} 筆不同：\n` + diffs.slice(0, 30).join("\n")).toEqual([]);
  });
});
