/**
 * 星場引擎高階 API 與兩個前端視圖：
 *   engine.py analyze()、star_energy.py build_from_result()、palace_readings.py build_from_result()
 * 的對應物。輸出形狀＝ziwei-app astrology.ts 的 StarEnergyPayload / PalaceReadingsPayload。
 */
import dimStars from "../data/dim_stars.json";
import palaceCodes from "../data/palace_codes.json";
import earthlyBranchCodes from "../data/earthly_branch_codes.json";
import sihuaCodes from "../data/sihua_codes.json";
import { buildPalaceBranchMap } from "../convert";
import { pyDisp, pyRound } from "../util/pyround";
import { StarFieldComputer, type StarFieldResult } from "./field";
import { PalaceLens, type Reading } from "./lens";
import { parseV3 } from "./parser";
import { ENGINE_VERSION, PALACE_CODES, SAMPLING_WINDOW, VECTOR_VERSION, getRegistry, type V3Registry } from "./registry";

export * from "./registry";
export * from "./parser";
export * from "./field";
export * from "./lens";

// ── Names ──
const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const STAR_NAME = invert(dimStars as Record<string, string>);
const PALACE_NAME = invert(palaceCodes as Record<string, string>);
const BRANCH_NAME = invert(earthlyBranchCodes as Record<string, string>);
const SIHUA_NAME = invert(sihuaCodes as Record<string, string>);
const LAYER_ZH: Record<string, string> = { natal: "生年", decade: "大限", year: "流年", small: "小限" };

export class Names {
  constructor(private registry: V3Registry) {}
  star(code: string): string { return STAR_NAME[code] ?? STAR_NAME[code.toUpperCase()] ?? code; }
  palace(code: string): string { return PALACE_NAME[code.toUpperCase()] ?? code; }
  branch(code: string | null | undefined): string { return code ? (BRANCH_NAME[code] ?? code) : ""; }
  sihua(code: string): string { return SIHUA_NAME[code.toUpperCase()] ?? code; }
  relation(code: string): string { return SAMPLING_WINDOW.labels_zh?.[code] ?? code; }
  layerZh(layer: string): string { return LAYER_ZH[layer] ?? layer; }
  dimZh(slug: string): string { return this.registry.byName.get(slug)?.name_zh ?? slug; }
}

// ── Engine ──
export interface V3Result {
  vector: number[]; star_field: StarFieldResult; readings: Record<string, Reading>;
  body_reading: Reading | null; body_anchor: string | null; meta: Record<string, unknown>;
}

export class StarFieldEngine {
  readonly registry = getRegistry();
  private computer = new StarFieldComputer(this.registry);
  private lens = new PalaceLens();

  analyze(encoded: string[]): V3Result {
    const chart = parseV3(encoded);
    const layers = new Set(chart.transforms.map((t) => t.layer));
    const prefixes = new Set(chart.placements.map((p) => p.star_code[0]).filter((c) => "dsy".includes(c)));
    let chartKind = "natal";
    if (layers.has("year") || prefixes.has("y")) chartKind = "year";
    else if (layers.has("small") || prefixes.has("s")) chartKind = "small";
    else if (layers.has("decade") || prefixes.has("d")) chartKind = "decade";

    const field = this.computer.compute(chart);
    const palaceBranches = buildPalaceBranchMap(chart.placements);
    const readings: Record<string, Reading> = {};
    for (const pc of PALACE_CODES) {
      const r = this.lens.sample(pc, field.star_facts, field.transform_facts, chartKind);
      r.branch = palaceBranches[pc] ?? null;
      readings[pc] = r;
    }
    const bodyAnchor = chart.body_palace || null;
    return {
      vector: field.vector, star_field: field, readings,
      body_reading: bodyAnchor && readings[bodyAnchor] ? readings[bodyAnchor] : null,
      body_anchor: bodyAnchor,
      meta: {
        vector_version: VECTOR_VERSION, total_dims: this.registry.totalDims, layer_signature: "base",
        chart_kind: chartKind, palace_branches: palaceBranches, gender: chart.gender, body_anchor: bodyAnchor,
        transform_count: field.transform_facts.length, void_event_count: field.void_events.length,
      },
    };
  }
}

let _engine: StarFieldEngine | null = null;
export function getStarFieldEngine(): StarFieldEngine {
  if (!_engine) _engine = new StarFieldEngine();
  return _engine;
}

// ── star_energy ──
const KIND_GROUP: Record<string, string> = { major: "major", pair: "aux", solo: "aux", void: "aux" };
const DEGENERATE_NOTE = "本星未受任何調整，E ＝ 亮度倍率";
const r4 = (v: number | null | undefined, nd = 4) => (v === null || v === undefined ? null : pyRound(Number(v), nd));

export function buildStarEnergy(result: V3Result, engine: StarFieldEngine, kinds?: string[] | null): Record<string, unknown> {
  const sf = result.star_field;
  const names = new Names(engine.registry);
  const preExempt = new Map<string, number>();
  for (const ev of sf.void_events) for (const hit of ev.exempted) {
    const cur = preExempt.get(hit.star);
    preExempt.set(hit.star, cur === undefined ? hit.factor : Math.min(cur, hit.factor));
  }
  const hitBy = new Map<string, Record<string, unknown> & { factor: number }>();
  for (const ev of sf.void_events) for (const hit of ev.affected) {
    const cur = hitBy.get(hit.star);
    if (!cur || hit.factor < cur.factor) {
      hitBy.set(hit.star, { void_star: names.star(ev.void_star), void_palace: names.palace(ev.palace), relation: hit.relation, factor: hit.factor });
    }
  }
  const sihuaOf = new Map<string, { hua: string; layer: string; channel_value: number | null }>();
  for (const t of sf.transform_facts) sihuaOf.set(t.star, { hua: names.sihua(t.sihua), layer: names.layerZh(t.layer), channel_value: r4(t.channel_value) });

  let wanted: Set<string> | null = null;
  if (kinds && kinds.length) {
    wanted = new Set();
    for (const k of kinds) {
      if (k === "aux") for (const [x, g] of Object.entries(KIND_GROUP)) { if (g === "aux") wanted.add(x); }
      else wanted.add(k);
    }
  }
  const cards: Array<Record<string, any>> = [];
  for (const f of sf.star_facts) {
    if (wanted && !wanted.has(f.kind)) continue;
    const bk = Number(f.brightness_factor);
    const m = Number(f.influence_bonus);
    const vk = Number(f.void_factor);
    const p1 = 1.0, p2 = bk, p3 = bk * (1 + m), p4 = p3 * vk;
    const voidState = f.sihua_exempt ? "exempt" : f.voided ? "hit" : "none";
    const hua = sihuaOf.get(f.star) ?? null;
    let voidNote: string;
    let voidDetail: unknown = null;
    if (voidState === "hit") { voidNote = `×${pyDisp(vk)}`; voidDetail = hitBy.get(f.star) ?? {}; }
    else if (voidState === "exempt") voidNote = hua ? `豁免（帶化${hua.hua}）` : "豁免";
    else voidNote = "未命中";
    const steps = [
      { key: "base", label: "基準", from: 0.0, to: r4(p1), delta: r4(p1), note: null, role: "total" },
      { key: "brightness", label: `亮度 ${f.brightness || "—"}`, from: r4(p1), to: r4(p2), delta: r4(p2 - p1), note: `×${pyDisp(bk)}`, role: "step" },
      { key: "influence", label: "影響加成", from: r4(p2), to: r4(p3), delta: r4(p3 - p2), note: (m > 0 ? "＋" : m < 0 ? "−" : "") + pyDisp(Math.abs(m)), role: "step" },
      { key: "void", label: "空劫", from: r4(p3), to: r4(p4), delta: r4(p4 - p3), note: voidNote, role: "step" },
      { key: "total", label: "E", from: 0.0, to: r4(f.E), delta: r4(f.E), note: null, role: "total" },
    ];
    const adjusted = Math.abs(m) > 1e-9 || Math.abs(vk - 1.0) > 1e-9 || voidState === "exempt";
    const counterfactual: Record<string, unknown> = {};
    if (voidState === "hit") {
      counterfactual.without_void = { e: r4(p3), gain: r4(p3 - p4), pct: p3 ? r4((p3 - p4) / p3 * 100, 1) : null, text: `若未被空劫命中，E 會是 ${pyDisp(p3)}` };
    }
    if (voidState === "exempt") {
      const wv = preExempt.get(f.star) ?? 1.0;
      const we = p3 * wv;
      counterfactual.without_sihua = {
        would_be_void_k: r4(wv, 4), e: r4(we), gain: r4(f.E - we), pct: we ? r4((f.E / we - 1) * 100, 1) : null,
        text: hua ? `四化豁免了空劫；若未帶化${hua.hua}，會被 ×${pyDisp(wv)} 砍到 ${pyDisp(we)}` : null,
      };
    }
    cards.push({
      code: f.star, name: names.star(f.star), attr: names.dimZh(f.dim_name), kind: f.kind, group: KIND_GROUP[f.kind] ?? "aux",
      palace: names.palace(f.palace), palace_code: f.palace, branch: names.branch(f.branch), brightness: f.brightness,
      brightness_k: r4(bk, 4), m: r4(m, 4), void_state: voidState, void_k: r4(vk, 4), void_detail: voidDetail, sihua: hua,
      e: r4(f.E), adjusted, degenerate_note: adjusted ? null : DEGENERATE_NOTE, steps,
      counterfactual: Object.keys(counterfactual).length ? counterfactual : null,
    });
  }
  // Python sort(key=-e) 是穩定排序：等值保持插入序。JS sort 亦穩定（ES2019+）。
  cards.sort((a, b) => (b.e as number) - (a.e as number));
  return {
    meta: {
      engine_version: ENGINE_VERSION, vector_version: VECTOR_VERSION,
      formula: "E = 亮度倍率 × (1 + 影響加成 M) × 空劫衰減",
      sihua_note: "四化不乘進 E；它在 E 這條鏈上的唯一作用是豁免空劫。通道值與場強屬於 E 之後的量，見各星 sihua.downstream。",
      degenerate_note: DEGENERATE_NOTE, star_count: cards.length,
    },
    stars: cards,
  };
}

// ── palace_readings ──
function auxGroups(reg: V3Registry): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const d of reg.eDims) if (d.kind !== "major" && !seen.has(d.name_zh)) { seen.add(d.name_zh); out.push(d.name_zh); }
  return out;
}
function majorDims(reg: V3Registry): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const d of reg.eDims) if (d.kind === "major" && !seen.has(d.name_zh)) { seen.add(d.name_zh); out.push(d.name_zh); }
  return out;
}

export function buildPalaceReadings(result: V3Result, engine: StarFieldEngine): Record<string, unknown> {
  const names = new Names(engine.registry);
  const groups = auxGroups(engine.registry);
  const auxTotals: Record<string, number> = Object.fromEntries(groups.map((g) => [g, 0.0]));
  const palaces: Array<Record<string, any>> = [];
  for (const [code, rd] of Object.entries(result.readings)) {
    const auxFlow: Record<string, number> = Object.fromEntries(groups.map((g) => [g, 0.0]));
    const contributors = rd.contributors.map((c) => {
      const dimZh = names.dimZh(c.dim_name);
      if (c.kind !== "major" && dimZh in auxFlow) { auxFlow[dimZh] += c.flow; auxTotals[dimZh] += c.flow; }
      const channels: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(c.channels ?? {})) if (v) channels[names.sihua(k)] = r4(v);
      return {
        star: names.star(c.star), star_code: c.star, attr: dimZh, kind: c.kind, group: c.kind === "major" ? "major" : "aux",
        from_palace: names.palace(c.palace), from_code: c.palace, relation: names.relation(c.relation), relation_code: c.relation,
        w: r4(c.weight), kind_weight: r4(c.kind_weight), e: r4(c.E), flow: r4(c.flow), contribution: r4(c.contribution), channels,
      };
    });
    const fieldSources = (rd.field_sources ?? []).map((fs) => ({
      star: names.star(fs.star), star_code: fs.star, hua: names.sihua(fs.sihua), layer: names.layerZh(fs.layer),
      from_palace: names.palace(fs.palace), from_code: fs.palace, relation: names.relation(fs.relation),
      w: r4(fs.weight), g: r4(fs.gain), e: r4(fs.E), strength: r4(fs.strength),
    }));
    const channels: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(rd.channels ?? {})) channels[names.sihua(k)] = r4(v);
    palaces.push({
      code, name: names.palace(code), branch: names.branch(rd.branch),
      s_total: r4(rd.S), s_power: r4(rd.S_major), s_hua: r4(rd.S_sihua), s_aux_flow: r4(rd.S_aux_flow),
      channels, owed: r4(rd.chong), aux_flow: Object.fromEntries(Object.entries(auxFlow).map(([g, v]) => [g, r4(v)])),
      contributors, field_sources: fieldSources,
    });
  }
  palaces.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const body = result.body_anchor;
  return {
    meta: {
      engine_version: ENGINE_VERSION, vector_version: VECTOR_VERSION, aux_groups: groups, major_dims: majorDims(engine.registry),
      notes: {
        flow_vs_contribution: "flow＝E×w（原始流量，未乘類權）；contribution＝flow×類權。輔星類權為 0 ⇒ contribution 恆為 0，但 flow 照列——熱力圖與弦圖看 flow，進 S總 的是 contribution。",
        aux_totals: "欄合計。取樣窗使同一顆星被多宮取樣，**只能做組間相對比較，不是全盤總量**。",
        sihua_two_quantities: "channels＝通道值（E×k×w，進 86 維 channel 維）；field_sources[].strength＝場強（E×g×w場，實際進 S總）。兩組係數不同、排序會相反，畫圖前須先決定講哪一個。",
      },
    },
    palaces,
    aux_totals: Object.fromEntries(Object.entries(auxTotals).map(([g, v]) => [g, r4(v)])),
    body_anchor: body ? { code: body, name: names.palace(body) } : null,
  };
}

/** 對應 astrology.__init__._build_v3_views：同一次 analyze 出兩張視圖 */
export function buildV3Views(encoded: string[], opts: { starEnergy?: boolean; readings?: boolean; kinds?: string[] | null } = {}) {
  const eng = getStarFieldEngine();
  const result = eng.analyze(encoded);
  return {
    star_energy: opts.starEnergy === false ? null : buildStarEnergy(result, eng, opts.kinds ?? null),
    readings: opts.readings === false ? null : buildPalaceReadings(result, eng),
    result,
  };
}
