/**
 * 由 src/assets/{stars,palace}/*.svg 產生 src/react/starSvgData.ts（內嵌向量資料）。
 *
 * 用法：  npm run gen:stars       （在 packages/ziwei-chart 下）
 *
 * 兩組資料：
 *   STAR_SVG_DATA   星曜圖示 + 四化徽章（F/P/H/I，四種形狀不同，不可一律畫圓）
 *   PALACE_SVG_DATA 宮位圖示（全寬 {碼}.svg 供本命、半寬 h{碼}.svg 供流盤層）
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
const PALACE_DIR = join(here, "..", "src", "assets", "palace");
const OUT = join(here, "..", "src", "react", "starSvgData.ts");

const svgsIn = (dir) => readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".svg")).sort();
const files = svgsIn(STARS_DIR);

/** 是否為「深色墨」（要換成 currentColor，讓圖示跟著主題變色）。白/淺色保留。 */
function isDarkInk(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r + g + b < 200; // 近黑（如 #231815/#050101）→ true；#fff → false
}

const colors = new Set();

/** 讀一個資料夾的 SVG → { code: {viewBox, inner} }。prefix 供 class 前綴去重。 */
function buildData(dir, list, classPrefix = "") {
  const out = {};
  for (const f of list) {
    const code = f.slice(0, -4);
    const s = readFileSync(join(dir, f), "utf-8");
    const vbMatch = s.match(/viewBox="([^"]+)"/);
    const viewBox = vbMatch ? vbMatch[1] : "0 0 100 100";
    let inner = s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    for (const c of inner.matchAll(/fill:\s*(#[0-9A-Fa-f]{3,6})/g)) colors.add(c[1]);
    for (const c of inner.matchAll(/fill="(#[0-9A-Fa-f]{3,6})"/g)) colors.add(c[1]);
    inner = inner.split("cls-").join(classPrefix + code + "cls-");
    inner = inner.replace(/(#[0-9A-Fa-f]{3,6})/g, (m) => (isDarkInk(m) ? "currentColor" : m));
    // 宮位圖的 stroke 也要跟著主題走（星曜圖是 fill 線稿，宮位圖是 stroke 線稿）
    inner = inner.replace(/stroke="#[0-9A-Fa-f]{3,6}"/g, 'stroke="currentColor"');
    // 線寬乘上 --zw-sw（使用端以 style 給值，預設 1）：副星縮小後要補到與主星同粗、
    // 宮位圖示要與主星同粗——與 p_e_artist 的 stroke_scale 同義。
    inner = inner.replace(/stroke-width:\s*([0-9.]+)px/g, "stroke-width: calc($1px * var(--zw-sw, 1))");
    inner = inner.replace(/stroke-width="([0-9.]+)"/g, 'style="stroke-width: calc($1px * var(--zw-sw, 1))"');
    inner = inner.replace(/\s+/g, " ").trim();
    out[code] = { viewBox, inner };
  }
  return out;
}

const data = buildData(STARS_DIR, files);
const palaceFiles = svgsIn(PALACE_DIR);
// 宮位碼可能與星曜碼撞名（宮位 "1"/"A" vs 星曜 "AAC"），class 前綴加 "p" 隔開
const palaceData = buildData(PALACE_DIR, palaceFiles, "p");

const header = `/**
 * 圖示向量資料（內嵌）—— 由 scripts/gen-star-svg.mjs 自 assets/{stars,palace}/*.svg 產生。
 * 請勿手改：要更新圖示請改 assets/ 後執行 \`npm run gen:stars\`。
 * 採內嵌 inner SVG（與 p_e_artist 一致），class 名已加代碼前綴避免全域碰撞；
 * 深色墨已轉 currentColor，由使用端的 color 控制，深色主題才跟得動。
 */
export interface StarSvg { viewBox: string; inner: string; }
export const STAR_SVG_DATA: Record<string, StarSvg> = `;
const mid = `;

/** 宮位圖示：全寬 {宮位碼}.svg（本命用）、半寬 h{宮位碼}.svg（流盤層用）。 */
export const PALACE_SVG_DATA: Record<string, StarSvg> = `;
const tail = `;

export function hasStarSvg(code: string): boolean {
  return code in STAR_SVG_DATA;
}

export function palaceSvg(code: string, half = false): StarSvg | undefined {
  return PALACE_SVG_DATA[(half ? "h" : "") + code];
}
`;

writeFileSync(
  OUT,
  header + JSON.stringify(data, null, 2) + mid + JSON.stringify(palaceData, null, 2) + tail,
  "utf-8",
);
console.log(`gen:stars → 星曜/徽章 ${files.length} 個、宮位 ${palaceFiles.length} 個寫入 ${OUT}`);

// 圖形實際範圍（四化徽章要貼著圖形放）：_bounds.json 由 P_Union p_e_artist/assets/gen_bounds.py
// 以 Inkscape 量測產生，換圖示時連同 SVG 一起搬過來。core 不能依賴 react/，故另寫一檔。
const boundsSrc = join(STARS_DIR, "_bounds.json");
const boundsOut = join(here, "..", "src", "core", "starBounds.ts");
const bounds = JSON.parse(readFileSync(boundsSrc, "utf-8"));
writeFileSync(
  boundsOut,
  `/**
 * 星曜圖示「實際圖形」佔畫框的比例 {l,t,r,b}（0–1）—— 由 scripts/gen-star-svg.mjs
 * 自 src/assets/stars/_bounds.json 產生，請勿手改。來源：P_Union p_e_artist/assets/gen_bounds.py。
 */
export interface ArtBounds { l: number; t: number; r: number; b: number; }
export const STAR_ART_BOUNDS: Record<string, ArtBounds> = ${JSON.stringify(bounds, null, 2)};
`,
  "utf-8",
);
console.log(`gen:stars → 圖形範圍 ${Object.keys(bounds).length} 個寫入 ${boundsOut}`);
console.log("distinct fill colors:", [...colors].sort().join(", "));
