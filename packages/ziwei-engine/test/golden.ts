/** 黃金檔讀取工具（測試共用）。 */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

export const GOLDEN_DIR = join(__dirname, "golden");

export interface LunarRow {
  y: number; m: number; d: number;
  ly: number; lm: number; ld: number; leap: boolean;
  monthGz: string; dayGz: string; jieqi: number; week: number;
}

export function loadLunarRows(): LunarRow[] {
  const p = join(GOLDEN_DIR, "lunar.csv");
  if (!existsSync(p)) throw new Error(`缺黃金檔 ${p}，先跑 scripts/gen_ziwei_golden.py`);
  const lines = readFileSync(p, "utf-8").trim().split(/\r?\n/);
  lines.shift();
  return lines.map((ln) => {
    const c = ln.split(",");
    return {
      y: +c[0], m: +c[1], d: +c[2], ly: +c[3], lm: +c[4], ld: +c[5], leap: c[6] === "1",
      monthGz: c[7], dayGz: c[8], jieqi: +c[9], week: +c[10],
    };
  });
}

export interface GoldenIndexEntry {
  file: string; chart_id: string; year: number; month: number; day: number;
  hour: number; minute: number; gender: string; name: string; note: string; full: boolean;
}

export function loadChartIndex(): GoldenIndexEntry[] {
  const p = join(GOLDEN_DIR, "charts", "index.json");
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf-8"));
}

export function loadChart(file: string): any {
  const buf = readFileSync(join(GOLDEN_DIR, "charts", file));
  return JSON.parse(gunzipSync(buf).toString("utf-8"));
}
