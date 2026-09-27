/**
 * 取樣鏡頭：p_d_graph_v3/lens.py 的對應物。
 */
import { COEFFICIENTS, PALACE_CODES, SAMPLING_WINDOW, SIHUA_CODES } from "./registry";
import type { StarFact, TransformFact } from "./field";

export interface Contributor {
  star: string; dim_name: string; kind: string; palace: string; relation: string; weight: number;
  kind_weight: number; E: number; contribution: number; flow: number; channels: Record<string, number>;
}
export interface FieldSource {
  star: string; sihua: string; palace: string; relation: string; weight: number; gain: number; E: number;
  strength: number; layer: string;
}
export interface Reading {
  center: string; branch: string | null; S: number; S_major: number; S_aux: number; S_aux_flow: number;
  S_sihua: number; channels: Record<string, number>; chong: number; contributors: Contributor[];
  field_sources: FieldSource[];
}

export class PalaceLens {
  private weights = SAMPLING_WINDOW.weights;
  private chartScope = new Map<string, Set<string>>();
  private offsetRelation = new Map<number, string>();
  private kindWeights = COEFFICIENTS.kind_s_weights ?? {};
  private fieldGains = COEFFICIENTS.sihua_field?.gains ?? {};
  private fieldWeights = COEFFICIENTS.sihua_field?.weights ?? {};
  private layerScope = new Map<string, Set<string>>();

  constructor() {
    for (const [k, rels] of Object.entries(SAMPLING_WINDOW.chart_scope ?? {})) this.chartScope.set(k, new Set(rels));
    for (const rel of SAMPLING_WINDOW.priority) {
      for (const off of SAMPLING_WINDOW.offsets[rel] ?? []) if (!this.offsetRelation.has(off)) this.offsetRelation.set(off, rel);
    }
    for (const [layer, rels] of Object.entries(COEFFICIENTS.sihua_layer_scope ?? {})) this.layerScope.set(layer, new Set(rels));
  }

  resolveRelation(starPalace: string, center: string): string {
    const a = PALACE_CODES.indexOf(starPalace);
    const b = PALACE_CODES.indexOf(center);
    if (a < 0 || b < 0) return "other";
    return this.offsetRelation.get((((a - b) % 12) + 12) % 12) ?? "other";
  }

  sample(center: string, starFacts: StarFact[], transformFacts: TransformFact[] | null, chartKind = "natal"): Reading {
    const reading: Reading = {
      center, branch: null, S: 0.0, S_major: 0.0, S_aux: 0.0, S_aux_flow: 0.0, S_sihua: 0.0,
      channels: Object.fromEntries(SIHUA_CODES.map((c) => [c, 0.0])), chong: 0.0, contributors: [], field_sources: [],
    };
    const chartAllowed = this.chartScope.get(chartKind);
    let byStar: Map<string, TransformFact[]> | null = null;
    if (transformFacts !== null) {
      byStar = new Map();
      for (const t of transformFacts) {
        const l = byStar.get(t.star);
        if (l) l.push(t); else byStar.set(t.star, [t]);
      }
    }
    for (const f of starFacts) {
      const rel = this.resolveRelation(f.palace, center);
      if (chartAllowed && !chartAllowed.has(rel)) continue;
      const w = Number(this.weights[rel] ?? 0.0);
      if (w <= 0.0) continue;
      const kind = f.kind || "solo";
      const kw = Number(kind in this.kindWeights ? this.kindWeights[kind] : 1.0);
      const flow = f.E * w;
      const contribution = flow * kw;
      reading.S += contribution;
      if (kind === "major") reading.S_major += contribution;
      else { reading.S_aux += contribution; reading.S_aux_flow += flow; }
      const chWeighted: Record<string, number> = {};
      if (byStar === null) {
        for (const [sihua, value] of Object.entries(f.channels)) {
          const weighted = value * w;
          reading.channels[sihua] = (reading.channels[sihua] ?? 0.0) + weighted;
          chWeighted[sihua] = weighted;
        }
      } else {
        for (const t of byStar.get(f.star) ?? []) {
          if (!t.channel_value) continue;
          const scope = this.layerScope.get(t.layer);
          if (scope && !scope.has(rel)) continue;
          const weighted = t.channel_value * w;
          reading.channels[t.sihua] = (reading.channels[t.sihua] ?? 0.0) + weighted;
          chWeighted[t.sihua] = (chWeighted[t.sihua] ?? 0.0) + weighted;
        }
      }
      reading.contributors.push({
        star: f.star, dim_name: f.dim_name, kind, palace: f.palace, relation: rel, weight: w, kind_weight: kw,
        E: f.E, contribution, flow, channels: chWeighted,
      });
    }
    for (const t of transformFacts ?? []) {
      if (!t.palace) continue;
      const rel = this.resolveRelation(t.palace, center);
      if (chartAllowed && !chartAllowed.has(rel)) continue;
      const scope = this.layerScope.get(t.layer);
      if (scope && !scope.has(rel)) continue;
      const wf = Number(this.fieldWeights[rel] ?? 0.0);
      if (wf <= 0.0) continue;
      const g = Number(this.fieldGains[t.sihua] ?? 0.0);
      const strength = t.E * g * wf;
      if (!strength) continue;
      reading.S_sihua += strength;
      reading.S += strength;
      if (rel === "opposite" && t.sihua === "BI") reading.chong += strength;
      reading.field_sources.push({ star: t.star, sihua: t.sihua, palace: t.palace, relation: rel, weight: wf, gain: g, E: t.E, strength, layer: t.layer });
    }
    reading.contributors.sort((a, b) => b.flow - a.flow);
    reading.field_sources.sort((a, b) => b.strength - a.strength);
    return reading;
  }
}
