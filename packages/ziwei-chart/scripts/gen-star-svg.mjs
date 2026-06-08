/**
 * 由 src/assets/stars/*.svg 產生 src/react/starSvgData.ts（內嵌向量資料）。
 *
 * 用法：  npm run gen:stars       （在 packages/ziwei-chart 下）
 *
 * 規則：
 *   - 取出 viewBox 與 <svg> 內層內容（含 defs/style/path）。
 *   - 把每個 SVG 的 class 代號 "cls-" 加上星曜碼前綴，避免多圖內嵌時全域 CSS 碰撞。
 *   - 壓掉多餘空白。
 * 新增/替換一顆星：把 {CODE}.svg 丟進 src/assets/stars/ 再跑本腳本即可。
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const STARS_DIR = join(here, "..", "src", "assets", "stars");
const OUT = join(here, "..", "src", "react", "starSvgData.ts");

const files = readdirSync(STARS_DIR).filter((f) => f.toLowerCase().endsWith(".svg")).sort();

/** 是否為「深色墨」（要換成 currentColor，讓圖示跟著主題變色）。白/淺色保留。 */
function isDarkInk(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r + g + b < 200; // 近黑（如 #231815/#050101）→ true；#fff → false
}

const data = {};
const colors = new Set();
for (const f of files) {
  const code = f.slice(0, -4);
  const s = readFileSync(join(STARS_DIR, f), "utf-8");
  const vbMatch = s.match(/viewBox="([^"]+)"/);
  const viewBox = vbMatch ? vbMatch[1] : "0 0 100 100";
  let inner = s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  for (const c of inner.matchAll(/fill:\s*(#[0-9A-Fa-f]{3,6})/g)) colors.add(c[1]);
  for (const c of inner.matchAll(/fill="(#[0-9A-Fa-f]{3,6})"/g)) colors.add(c[1]);
  inner = inner.split("cls-").join(code + "cls-");
  // 深色墨 → currentColor（圖示色由主題的 starGlyph 控制；白色高光保留）
  inner = inner.replace(/(#[0-9A-Fa-f]{3,6})/g, (m) => (isDarkInk(m) ? "currentColor" : m));
  inner = inner.replace(/\s+/g, " ").trim();
  data[code] = { viewBox, inner };
}

const header = `/**
 * 星曜向量資料（內嵌）—— 由 scripts/gen-star-svg.mjs 自 assets/stars/*.svg 產生。
 * 請勿手改：要更新圖示請改 assets/stars/ 後執行 \`npm run gen:stars\`。
 * 採內嵌 inner SVG（與 p_e_artist 一致），class 名已加星曜碼前綴避免全域碰撞。
 */
export interface StarSvg { viewBox: string; inner: string; }
export const STAR_SVG_DATA: Record<string, StarSvg> = `;
const tail = `;

export function hasStarSvg(code: string): boolean {
  return code in STAR_SVG_DATA;
}
`;

writeFileSync(OUT, header + JSON.stringify(data, null, 2) + tail, "utf-8");
console.log(`gen:stars → ${files.length} 顆星寫入 ${OUT}`);
console.log("distinct fill colors:", [...colors].sort().join(", "));
