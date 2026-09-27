/**
 * v3 橋接解碼器：p_d_graph_v3/bridge/chart_parser.py 的對應物。
 * 與 convert/ 的解碼器差在：支援運限四化 T-token（帶 layer）、附便利索引（同宮星曜表）。
 */
import { decodeSpecial, deriveYearStemCodeFromTransforms } from "../convert";

const SIHUA = new Set(["FO", "PW", "HO", "BI"]);
const LAYER_MARKERS: Record<string, string> = { D: "decade", Y: "year", S: "small" };

export interface V3Placement { star_code: string; palace_code: string; branch_code: string }
export interface V3Transform { star_code: string; palace_code: string; sihua_code: string; layer: string }

export class V3ChartState {
  gender = ""; body_palace = ""; life_master = ""; body_master = ""; year_stem = ""; year_branch = "";
  placements: V3Placement[] = [];
  transforms: V3Transform[] = [];
  brightness: Record<string, string> = {};
  private palaceStars = new Map<string, string[]>();

  buildIndices(): void {
    this.palaceStars.clear();
    const seen = new Set<string>();
    for (const p of this.placements) {
      const key = `${p.star_code}|${p.palace_code}|${p.branch_code || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const list = this.palaceStars.get(p.palace_code);
      if (list) list.push(p.star_code); else this.palaceStars.set(p.palace_code, [p.star_code]);
    }
  }

  getStarsInPalace(palace: string): string[] { return this.palaceStars.get(palace) ?? []; }
}

export function parseV3(encoded: string[]): V3ChartState {
  const chart = new V3ChartState();
  for (const raw of encoded) {
    const code = raw.trim();
    if (!code) continue;
    const prefix = code[0].toUpperCase();
    if (prefix === "T") {
      if (code.length !== 8) continue;
      const sihua = code.slice(5, 7).toUpperCase();
      const layer = LAYER_MARKERS[code[7].toUpperCase()];
      if (!SIHUA.has(sihua) || !layer) continue;
      chart.transforms.push({ star_code: code.slice(2, 5), palace_code: code[1], sihua_code: sihua, layer });
      continue;
    }
    if ("GQLMIY".includes(prefix)) {
      const r = decodeSpecial(code);
      switch (r.type) {
        case "gender": chart.gender = r.value; break;
        case "body_palace_location": chart.body_palace = r.palace; break;
        case "life_master": chart.life_master = r.star; break;
        case "body_master": chart.body_master = r.star; break;
        case "brightness": chart.brightness[r.star] = r.value >= 0 ? `P${r.value}` : `N${Math.abs(r.value)}`; break;
        case "year_gz": chart.year_stem = r.stem; chart.year_branch = r.branch; break;
        default: break;
      }
      continue;
    }
    if (code.length === 4 || code.length === 6) {
      const suffix = code.length === 6 ? code.slice(4, 6) : "00";
      if (SIHUA.has(suffix.toUpperCase())) {
        chart.transforms.push({ star_code: code.slice(1, 4), palace_code: code[0], sihua_code: suffix.toUpperCase(), layer: "natal" });
      } else {
        chart.placements.push({ star_code: code.slice(1, 4), palace_code: code[0], branch_code: suffix === "00" ? "" : suffix });
      }
    }
  }
  if (!chart.year_stem) {
    const d = deriveYearStemCodeFromTransforms(chart.transforms);
    if (d) chart.year_stem = d;
  }
  chart.buildIndices();
  return chart;
}
