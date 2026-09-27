/**
 * 由黃金表 test/golden/lunar.csv 反推 lunar-typescript 與 sxtwl 不一致的日子，
 * 產出 src/lunar/overrides.json。sxtwl 是真相（DB 七萬張盤都靠它），引擎以覆寫表對齊。
 *
 * 只收「農曆年／月／日／閏」的差異；月干支不進排盤（p01_count 無消費者），
 * 差異另列 monthGzMismatch 供測試放行，不覆寫。
 *
 * 用法：node scripts/gen-lunar-overrides.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Solar } from "lunar-typescript";

const rows = readFileSync(new URL("../test/golden/lunar.csv", import.meta.url), "utf-8").trim().split(/\r?\n/).slice(1);
const overrides = {};
const monthGzMismatch = [];
for (const ln of rows) {
  const [y, m, d, ly, lm, ld, leap, monthGz] = ln.split(",");
  const L = Solar.fromYmd(+y, +m, +d).getLunar();
  const key = `${y}-${m}-${d}`;
  if (L.getYear() !== +ly || Math.abs(L.getMonth()) !== +lm || L.getDay() !== +ld || (L.getMonth() < 0) !== (leap === "1")) {
    overrides[key] = [+ly, +lm, +ld, leap === "1" ? 1 : 0];
  }
  if (L.getMonthInGanZhi() !== monthGz) monthGzMismatch.push(key);
}
const out = { _comment: "solar 'y-m-d' → [lunarYear, lunarMonth, lunarDay, isLeap]，來源 sxtwl（gen-lunar-overrides.mjs 產生，勿手改）", overrides, monthGzMismatch };
writeFileSync(new URL("../src/lunar/overrides.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`overrides: ${Object.keys(overrides).length} days; monthGz mismatches: ${monthGzMismatch.length}`);
console.log(Object.keys(overrides).join(" "));
