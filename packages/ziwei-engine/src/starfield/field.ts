/**
 * 星場計算器：p_d_graph_v3/star_field.py 的對應物。
 * 浮點運算順序與 Python 逐步相同（E 的每一步都會進黃金檔比對）。
 */
import { COEFFICIENTS, INFLUENCE_MATRIX, PALACE_CODES, SAMPLING_WINDOW, type V3Registry } from "./registry";
import type { V3ChartState } from "./parser";

export interface StarFact {
  star: string; dim_index: number; dim_name: string; kind: string; palace: string; branch: string | null;
  brightness: string | null; brightness_factor: number; voided: boolean; void_factor: number;
  sihua_exempt: boolean; influence_bonus: number; E: number; channels: Record<string, number>;
}
export interface VoidHit { star: string; palace: string; relation: string; factor: number }
export interface VoidEvent { void_star: string; palace: string; affected: VoidHit[]; exempted: VoidHit[] }
export interface TransformFact {
  star: string; sihua: string; layer: string; palace: string | null; E: number; channel_value: number; dim_index: number | null;
}
export interface StarFieldResult {
  vector: number[]; star_facts: StarFact[]; void_events: VoidEvent[]; transform_facts: TransformFact[];
}

export class StarFieldComputer {
  private voidStars: Set<string>;
  private voidK: number;
  private sihuaK: Record<string, number>;
  private brightness: Record<string, number>;
  private majorStars: Set<string>;
  private voidReach: Array<[string, number, number]> = [];

  constructor(readonly registry: V3Registry) {
    const c = COEFFICIENTS;
    this.voidStars = new Set(c.void_stars ?? []);
    this.voidK = Number(c.void_k ?? 0.45);
    this.sihuaK = c.sihua_k ?? {};
    this.brightness = c.brightness_factors ?? {};
    this.majorStars = new Set(registry.eDims.filter((d) => d.kind === "major").flatMap((d) => d.stars));
    const scope = c.void_scope_relations ?? ["main"];
    for (const rel of scope) {
      const w = Number(SAMPLING_WINDOW.weights[rel] ?? 0);
      const factor = 1.0 - (1.0 - this.voidK) * w;
      if (factor >= 1.0) continue;
      for (const off of SAMPLING_WINDOW.offsets[rel] ?? []) this.voidReach.push([rel, off, factor]);
    }
  }

  compute(chart: V3ChartState): StarFieldResult {
    const exempt = new Set(chart.transforms.map((t) => t.star_code));
    const voidEvents = this.collectVoidEvents(chart, exempt);
    const voidFactors = new Map<string, number>();
    for (const ev of voidEvents) {
      for (const hit of ev.affected) {
        const cur = voidFactors.get(hit.star) ?? 1.0;
        voidFactors.set(hit.star, Math.min(cur, hit.factor));
      }
    }
    const exemptedInReach = new Set<string>();
    for (const ev of voidEvents) for (const hit of ev.exempted) exemptedInReach.add(hit.star);

    // Pass 1
    const rawE = new Map<string, number>();
    const meta = new Map<string, [string, string | null, string | null, number]>();
    for (const p of chart.placements) {
      const star = p.star_code;
      if (!this.registry.starToDim.has(star)) continue;
      const bcode = chart.brightness[star] ?? null;
      const bfactor = Number(bcode !== null && bcode in this.brightness ? this.brightness[bcode] : 1.0);
      let e = 1.0 * bfactor;
      if (!this.voidStars.has(star)) e *= voidFactors.get(star) ?? 1.0;
      rawE.set(star, e);
      meta.set(star, [p.palace_code, p.branch_code || null, bcode, bfactor]);
    }

    // Pass 2
    const facts: StarFact[] = [];
    for (const [star, e0] of rawE) {
      const [palace, branch, bcode, bfactor] = meta.get(star)!;
      const dimIndex = this.registry.starToDim.get(star)!;
      const dim = this.registry.dims[dimIndex];
      let bonus = 0.0;
      let e = e0;
      if (this.majorStars.has(star)) {
        for (const co of chart.getStarsInPalace(palace)) {
          if (co === star) continue;
          const row = INFLUENCE_MATRIX[co];
          if (!row) continue;
          const coeff = row[star] ?? 0.0;
          if (coeff && rawE.has(co)) bonus += coeff * rawE.get(co)!;
        }
        e = e * (1.0 + bonus);
      }
      facts.push({
        star, dim_index: dimIndex, dim_name: dim.name, kind: dim.kind, palace, branch,
        brightness: bcode, brightness_factor: bfactor,
        voided: voidFactors.has(star), void_factor: voidFactors.get(star) ?? 1.0,
        sihua_exempt: exemptedInReach.has(star), influence_bonus: bonus, E: e, channels: {},
      });
    }
    const factByStar = new Map(facts.map((f) => [f.star, f]));

    const transformFacts: TransformFact[] = [];
    for (const t of chart.transforms) {
      const f = factByStar.get(t.star_code);
      if (!f) {
        transformFacts.push({ star: t.star_code, sihua: t.sihua_code, layer: t.layer, palace: t.palace_code || null, E: 0.0, channel_value: 0.0, dim_index: null });
        continue;
      }
      const chDim = this.registry.channelIndex.get(`${f.dim_index}|${t.sihua_code}`);
      const k = Number(this.sihuaK[t.sihua_code] ?? 1.0);
      const value = chDim !== undefined ? f.E * k : 0.0;
      if (chDim !== undefined) f.channels[t.sihua_code] = (f.channels[t.sihua_code] ?? 0.0) + value;
      transformFacts.push({ star: t.star_code, sihua: t.sihua_code, layer: t.layer, palace: f.palace, E: f.E, channel_value: value, dim_index: chDim ?? null });
    }

    const vector = new Array<number>(this.registry.totalDims).fill(0.0);
    for (const f of facts) {
      vector[f.dim_index] += f.E;
      for (const [sihua, value] of Object.entries(f.channels)) {
        const chDim = this.registry.channelIndex.get(`${f.dim_index}|${sihua}`);
        if (chDim !== undefined) vector[chDim] += value;
      }
    }
    return { vector, star_facts: facts, void_events: voidEvents, transform_facts: transformFacts };
  }

  private collectVoidEvents(chart: V3ChartState, exempt: Set<string>): VoidEvent[] {
    const events: VoidEvent[] = [];
    for (const p of chart.placements) {
      if (!this.voidStars.has(p.star_code)) continue;
      const base = PALACE_CODES.indexOf(p.palace_code);
      if (base < 0) continue;
      const affected: VoidHit[] = [];
      const exempted: VoidHit[] = [];
      for (const [rel, off, factor] of this.voidReach) {
        const target = PALACE_CODES[(base + off) % 12];
        for (const s of chart.getStarsInPalace(target)) {
          if (this.voidStars.has(s)) continue;
          if (!this.registry.starToDim.has(s)) continue;
          const hit = { star: s, palace: target, relation: rel, factor };
          if (exempt.has(s)) exempted.push(hit); else affected.push(hit);
        }
      }
      events.push({ void_star: p.star_code, palace: p.palace_code, affected, exempted });
    }
    return events;
  }
}
