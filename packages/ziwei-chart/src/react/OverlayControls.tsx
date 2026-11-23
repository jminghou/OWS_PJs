import { useId, useState, type FC } from "react";
import type { FlowData } from "../core/flow";
import { decadeForAge, OVERLAY_LABEL, OVERLAY_ORDER, type OverlayKind, type OverlayResult } from "../core/overlay";
import type { ZiweiTheme } from "../core/theme";
import type { OverlayState } from "./types";

interface OverlayControlsProps {
  flow: FlowData;
  state: OverlayState;
  year: number;
  resolved: OverlayResult | null;
  onChange: (next: OverlayState) => void;
  theme: ZiweiTheme;
}

export function layerInk(theme: ZiweiTheme, kind: OverlayKind | "natal"): string {
  switch (kind) {
    case "decade": return theme.colors.layerDecade;
    case "small": return theme.colors.layerSmall;
    case "year": return theme.colors.layerYear;
    default: return theme.colors.layerNatal;
  }
}

/** One target year drives every visible layer and both navigation levels. */
export const OverlayControls: FC<OverlayControlsProps> = ({ flow, state, year, onChange, theme }) => {
  const id = useId();
  const [jumpOpen, setJumpOpen] = useState(false);
  const [mode, setMode] = useState<"year" | "age">("year");
  const [draft, setDraft] = useState("");
  const entries = (flow.years.length ? flow.years : flow.smallLimits)
    .filter((e): e is typeof e & { year: number } => e.year != null)
    .filter((e, i, all) => all.findIndex((x) => x.year === e.year) === i)
    .sort((a, b) => a.year - b.year);
  const current = entries.find((e) => e.year === year);
  // Use the same age-to-decade rule as the renderer; never invent age conversions.
  const groups: { key: string; label: string; entries: typeof entries }[] = [];
  for (const entry of entries) {
    const decade = entry.age == null ? null : decadeForAge(flow, entry.age);
    const key = decade ? `decade-${decade.order}` : `other-${Math.floor(entries.indexOf(entry) / 10)}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const firstAge = flow.decades.map((d) => Number(d.ageRange.match(/\d+/)?.[0])).filter(Number.isFinite);
      const before = entry.age != null && firstAge.length > 0 && entry.age < Math.min(...firstAge);
      group = { key, label: decade ? `${decade.ageRange} 歲（虛歲）` : before ? "起運前" : "其他年份", entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  const index = groups.findIndex((g) => g.entries.some((e) => e.year === year));
  const group = groups[index];
  const rangeLabel = (g: typeof group) => g ? `${g.entries[0].year}–${g.entries[g.entries.length - 1].year} 年` : "";
  const anyOn = state.decade || state.small || state.year;
  const available = { decade: flow.decades.length > 0, small: flow.smallLimits.length > 0, year: flow.years.length > 0 };
  const canSelect = (y: number) => entries.some((e) => e.year === y);
  const setYear = (y: number) => { if (canSelect(y)) onChange({ ...state, targetYear: y }); };
  const today = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Taipei", year: "numeric" }).format(new Date()));
  const target = /^\d+$/.test(draft) ? entries.find((e) => (mode === "year" ? e.year : e.age) === Number(draft)) : undefined;

  const openPicker = () => { setDraft(String(year)); setMode("year"); setJumpOpen(!jumpOpen); };

  return (
    <section className="zw-flow" aria-label="運限切換">
      <style>{`
        .zw-flow{font-family:var(--font-noto),"Microsoft JhengHei",sans-serif;color:var(--ink,#1f2333);margin-bottom:8px;container-type:inline-size;font-size:14px;line-height:1.7}
        .zw-flow *{box-sizing:border-box}
        .zw-flow button,.zw-flow select,.zw-flow input{font:inherit;min-height:36px;border-radius:9999px;padding:4px 16px;white-space:nowrap;max-width:100%}
        .zw-flow button{border:0;background:transparent;color:var(--blue-500,#0967e7);font-weight:700;cursor:pointer;transition:filter 150ms ease-out,box-shadow 150ms ease-out}
        .zw-flow button:hover{background:var(--blue-50,#eef5ff)}
        .zw-flow button:active{filter:brightness(.9)}
        .zw-flow button:focus-visible,.zw-flow select:focus-visible,.zw-flow input:focus-visible{outline:0;box-shadow:0 0 0 4px var(--blue-100,#dceaff)}
        .zw-flow button:disabled{background:var(--line,#e3e5ee);color:var(--muted,#6b7084);cursor:not-allowed;filter:none;box-shadow:none}
        .zw-flow .zw-top,.zw-flow .zw-layers,.zw-flow .zw-range{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .zw-flow .zw-top{justify-content:space-between;margin-bottom:4px}
        .zw-flow .zw-layers{gap:4px}
        .zw-flow .zw-layers button{color:var(--text,#4b5063);padding-inline:12px}
        .zw-flow .zw-layers button[aria-pressed=true],.zw-flow .zw-years button[aria-pressed=true]{background:var(--blue-500,#0967e7);color:var(--surface,#ffffff)}
        .zw-flow .zw-period{font-weight:400;color:var(--muted,#6b7084);padding-inline:8px}
        .zw-flow .zw-nav{display:flex;gap:4px;align-items:center}
        .zw-flow .zw-nav button{padding-inline:12px}
        .zw-flow .zw-current{color:var(--ink,#1f2333);background:var(--tint,#f3f1ec);font-variant-numeric:tabular-nums}
        .zw-flow .zw-caption{font-size:13px;color:var(--muted,#6b7084);font-weight:400}
        .zw-flow .zw-picker{margin-top:8px;padding:12px;background:var(--paper,#fcfaf6);border-radius:20px}
        .zw-flow select,.zw-flow input{background:var(--surface,#ffffff);color:var(--ink,#1f2333);border:1.5px solid var(--line-strong,#c6c9d4);min-width:0}
        .zw-flow input{width:100px;font-variant-numeric:tabular-nums}
        .zw-flow .zw-years{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin-top:8px}
        .zw-flow .zw-years button{padding:4px;border-radius:12px;color:var(--text,#4b5063);font-weight:400;font-variant-numeric:tabular-nums}
        .zw-flow .zw-years small{display:block;font-size:12px;color:inherit}
        .zw-flow .zw-form{margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .zw-flow .zw-hint{font-size:13px;color:var(--muted,#6b7084);margin:4px 0 0}
        @container(min-width:760px){.zw-flow .zw-years{grid-template-columns:repeat(10,minmax(0,1fr))}}
        @container(max-width:480px){.zw-flow button,.zw-flow select,.zw-flow input{min-height:44px}.zw-flow .zw-top{gap:0}.zw-flow .zw-nav{justify-content:space-between}.zw-flow .zw-nav button{padding-inline:4px;min-width:44px;font-size:13px}.zw-flow .zw-nav .zw-current{flex:1;min-width:0}.zw-flow .zw-period{padding-left:8px}.zw-flow .zw-current .zw-caption{font-size:12px}}
        @media(prefers-reduced-motion:reduce){.zw-flow button{transition:none}}
      `}</style>
      <div className="zw-top">
        <div className="zw-layers" role="group" aria-label="疊宮顯示，可複選；本命固定顯示">
          <button type="button" aria-label="只看本命" aria-pressed={!anyOn} style={!anyOn ? { background: layerInk(theme, "natal"), color: "#ffffff" } : undefined} onClick={() => onChange({ ...state, decade: false, small: false, year: false })}>本命</button>
          {OVERLAY_ORDER.map((kind) => <button key={kind} type="button" disabled={!available[kind]} aria-pressed={state[kind]} style={state[kind] && available[kind] ? { background: layerInk(theme, kind), color: "#ffffff" } : undefined} title={`${OVERLAY_LABEL[kind]}疊宮（可複選）`} onClick={() => onChange({ ...state, [kind]: !state[kind] })}>{OVERLAY_LABEL[kind]}</button>)}
          <button type="button" disabled={!canSelect(today)} title={canSelect(today) ? "回到今年" : "今年不在資料範圍內"} onClick={() => setYear(today)}>今年</button>
        </div>
        {entries.length > 0 && <button type="button" className="zw-period" aria-expanded={jumpOpen} aria-controls={`${id}-picker`} onClick={openPicker} title="選擇大限與年份">{group?.label.replace("（虛歲）", "")} · {rangeLabel(group)} · 選年</button>}
      </div>
      {!entries.length ? <p className="zw-hint">目前沒有可選的年份資料。</p> : <>
        <div className="zw-nav" role="group" aria-label="年份快捷操作">
          {[-10, -1].map((step) => <button key={step} type="button" disabled={!canSelect(year + step)} onClick={() => setYear(year + step)}>−{Math.abs(step)} 年</button>)}
          <button type="button" className="zw-current" aria-label={`${year} 年，${current?.age ?? "未知"} 虛歲；跳轉年份或歲數`} aria-expanded={jumpOpen} aria-controls={`${id}-picker`} onClick={openPicker}><span>{year}</span><span className="zw-caption">{current?.age != null ? ` · ${current.age} 虛歲` : " 年"}</span></button>
          {[1, 10].map((step) => <button key={step} type="button" disabled={!canSelect(year + step)} onClick={() => setYear(year + step)}>＋{step} 年</button>)}
        </div>
        {jumpOpen && <div id={`${id}-picker`} className="zw-picker" onKeyDown={(e) => { if (e.key === "Escape") setJumpOpen(false); }}>
          <div className="zw-range">
            <select aria-label="選擇大限區間" value={group?.key ?? ""} style={{ flex: "1 1 180px" }} onChange={(e) => { const selected = groups.find((g) => g.key === e.target.value); if (selected) { setYear(selected.entries[0].year); setDraft(String(mode === "year" ? selected.entries[0].year : selected.entries[0].age ?? "")); } }}>
              {!group && <option value="" disabled>選擇區間</option>}
              {groups.map((g) => <option value={g.key} key={g.key}>{g.label} · {rangeLabel(g)}</option>)}
            </select>
            <button type="button" onClick={() => setJumpOpen(false)}>收起</button>
          </div>
          <div className="zw-years" role="group" aria-label="此區間內的年份">{group?.entries.map((entry) => <button type="button" key={entry.year} aria-pressed={entry.year === year} aria-label={`${entry.year} 年${entry.age == null ? "" : `，虛歲 ${entry.age} 歲`}`} onClick={() => { setYear(entry.year); setJumpOpen(false); }}>
            {entry.year}<small>{entry.age == null ? "—" : `${entry.age} 歲`}</small>
          </button>)}</div>
          <form className="zw-form" onSubmit={(e) => { e.preventDefault(); if (target) { setYear(target.year); setJumpOpen(false); } }}>
            <select aria-label="跳轉輸入方式" value={mode} onChange={(e) => { const next = e.target.value as "year" | "age"; setMode(next); setDraft(String((next === "year" ? current?.year : current?.age) ?? "")); }}><option value="year">西元年份</option><option value="age">歲數（虛歲）</option></select>
            <input aria-label={mode === "year" ? "西元年份" : "虛歲"} inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} aria-describedby={`${id}-hint`} />
            <button type="submit" disabled={!target}>前往</button>
          </form>
          <p id={`${id}-hint`} aria-live="polite" className="zw-hint">{target ? `${target.year} 年 · ${target.age == null ? "歲數資料未提供" : `${target.age} 歲（虛歲）`}` : `請輸入有資料的${mode === "year" ? "年份" : "虛歲"}（年份範圍：${entries[0].year}–${entries[entries.length - 1].year}）。`}</p>
        </div>}
      </>}
    </section>
  );
};
