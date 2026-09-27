/**
 * v3 維度註冊表與係數：p_d_graph_v3/config.py 的對應物（只保留 E 計算鏈需要的部分）。
 * 資料檔（dimension_definitions_v3 / coefficients / sampling_window / influence_matrix）
 * 由 Python 引擎的 data/ 轉成 JSON，內容一字不改。
 */
import dimsJson from "../data/dimension_definitions_v3.json";
import coefficientsJson from "../data/coefficients.json";
import samplingJson from "../data/sampling_window.json";
import influenceJson from "../data/influence_matrix.json";

export const VECTOR_VERSION = "3.6";
export const ENGINE_VERSION = "3.8.0";
export const SIHUA_CODES = ["FO", "PW", "HO", "BI"] as const;
export const PALACE_CODES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"];

export interface V3DimDef {
  index: number; name: string; name_zh: string; kind: string; stars: string[]; can_sihua: boolean;
}

export interface Coefficients {
  brightness_factors: Record<string, number>;
  sihua_k: Record<string, number>;
  sihua_field: { gains: Record<string, number>; weights: Record<string, number> };
  kind_s_weights: Record<string, number>;
  sihua_layer_scope: Record<string, string[]>;
  void_k: number;
  void_stars: string[];
  void_scope_relations: string[];
}

export interface SamplingWindow {
  weights: Record<string, number>;
  offsets: Record<string, number[]>;
  priority: string[];
  chart_scope: Record<string, string[]>;
  labels_zh: Record<string, string>;
}

export const COEFFICIENTS = coefficientsJson as unknown as Coefficients;
export const SAMPLING_WINDOW = samplingJson as unknown as SamplingWindow;
export const INFLUENCE_MATRIX = influenceJson as Record<string, Record<string, number>>;

export class V3Registry {
  readonly dims: V3DimDef[];
  readonly byName = new Map<string, V3DimDef>();
  readonly starToDim = new Map<string, number>();
  readonly channelIndex = new Map<string, number>(); // `${eDimIndex}|${SIHUA}`
  readonly eDims: V3DimDef[] = [];

  constructor() {
    this.dims = [...(dimsJson as V3DimDef[])].sort((a, b) => a.index - b.index);
    for (const d of this.dims) this.byName.set(d.name, d);
    for (const d of this.dims) {
      if (d.kind === "channel") {
        const i = d.name.lastIndexOf("_");
        const base = this.byName.get(d.name.slice(0, i));
        const sihua = d.name.slice(i + 1).toUpperCase();
        if (base) this.channelIndex.set(`${base.index}|${sihua}`, d.index);
      } else {
        this.eDims.push(d);
        for (const s of d.stars) this.starToDim.set(s, d.index);
      }
    }
  }

  get totalDims(): number { return this.dims.length; }
}

let _registry: V3Registry | null = null;
export function getRegistry(): V3Registry {
  if (!_registry) _registry = new V3Registry();
  return _registry;
}
