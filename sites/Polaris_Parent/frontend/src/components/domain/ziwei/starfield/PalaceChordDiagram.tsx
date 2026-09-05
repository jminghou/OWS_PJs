'use client';

import { useMemo, useState } from 'react';
import type { PalaceReading, PalaceReadingsPayload, ReadingContributor } from '@/lib/api';
import { ChartTooltip, TipDivider, TipRow, TipTitle, useChartTooltip } from './ChartTooltip';

/**
 * A2 · 宮位取樣弦圖（12 節點・有向）。
 *
 * 每條弦＝一組星曜從**所在宮**流向**被取樣宮**的量。粗端為來源、細端為去向。
 * 弧上的深色內環＝該宮的**主宮自給量**（星就在本宮，不畫成弦）。
 *
 * ## 為什麼只用兩個顏色
 *
 * 12 宮塗 12 色遠超過可辨識上限；改用三合局塗 4 色也過不了色盲全對比檢驗。
 * 所以改成**依取樣關係塗色**（對宮 w0.8 ／ 三方 w0.5），只用兩個色相——
 * 這反而更有資訊，因為它直接畫出取樣窗的權重。
 *
 * 三合局結構不需要顏色：三方弦連的本來就是同一組三合局，
 * 所以橘弦會自己畫出四個三角形；對宮弦連的是六組對沖，藍弦自己畫出六條直徑。
 * 這是三方四正的幾何，不是排版效果。
 */

type FlowKind = 'power' | 'aux' | 'all';

const KIND_TABS: { key: FlowKind; label: string }[] = [
  { key: 'power', label: '主星（S力）' },
  { key: 'aux', label: '輔星（S輔）' },
  { key: 'all', label: '全部' },
];

const R = 218;
const RW = 15;
const TAU = Math.PI * 2;
const PAD = 0.02;
/** 目標端收窄到 42%，讓「流向」看得出來（兩宮之間的雙向弦才不會糊成一條）。 */
const TAPER = 0.42;

const fmt = (v: number) => v.toFixed(2);

/**
 * 極座標 → 直角座標，**座標量化到小數 2 位**。
 *
 * 這個 round 不是為了好看，是 SSR 正確性：ECMAScript 不要求 Math.sin/cos
 * 正確捨入，Node 與瀏覽器的 V8 可能差最後一個 ULP，
 * 於是同一條 path 的 `d` 字串在伺服器與用戶端不一致 → React hydration mismatch。
 * 量化後兩邊必然相同；在 viewBox 660 的尺度下 0.01 單位遠小於一個像素。
 */
const q = (v: number) => Math.round(v * 100) / 100;
const P = (a: number, r: number): [number, number] => [
  q(r * Math.sin(a)),
  q(-r * Math.cos(a)),
];

function arcPath(a0: number, a1: number, r0: number, r1: number) {
  const lg = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = P(a0, r1);
  const [x1, y1] = P(a1, r1);
  const [x2, y2] = P(a1, r0);
  const [x3, y3] = P(a0, r0);
  return `M${x0},${y0}A${r1},${r1},0,${lg},1,${x1},${y1}L${x2},${y2}A${r0},${r0},0,${lg},0,${x3},${y3}Z`;
}

function ribbonPath(a0: number, a1: number, b0: number, b1: number, r: number) {
  const [x0, y0] = P(a0, r);
  const [x1, y1] = P(a1, r);
  const [x2, y2] = P(b0, r);
  const [x3, y3] = P(b1, r);
  const la = a1 - a0 > Math.PI ? 1 : 0;
  const lb = b1 - b0 > Math.PI ? 1 : 0;
  return (
    `M${x0},${y0}A${r},${r},0,${la},1,${x1},${y1}Q0,0,${x2},${y2}` +
    `A${r},${r},0,${lb},1,${x3},${y3}Q0,0,${x0},${y0}Z`
  );
}

/** 依檢視模式取這一筆取樣的量：主星看 contribution，輔星／全部看原始 flow。 */
function amountOf(c: ReadingContributor, kind: FlowKind) {
  if (kind === 'power') return c.group === 'major' ? c.contribution : 0;
  if (kind === 'aux') return c.group === 'aux' ? c.flow : 0;
  return c.flow;
}

interface Edge {
  src: number;
  dst: number;
  v: number;
  relation: string;
  stars: ReadingContributor[];
  s0: number; s1: number; t0: number; t1: number;
}

export default function PalaceChordDiagram({
  readings,
  className,
}: {
  readings: PalaceReadingsPayload;
  className?: string;
}) {
  const { tip, show, hide } = useChartTooltip();
  const [kind, setKind] = useState<FlowKind>('power');
  const [focus, setFocus] = useState<number | null>(null);

  const palaces = readings.palaces;
  const idxOf = useMemo(
    () => Object.fromEntries(palaces.map((p, i) => [p.code, i])),
    [palaces],
  );

  const layout = useMemo(() => {
    const n = palaces.length;
    const flow: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const stars: ReadingContributor[][][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => [] as ReadingContributor[]),
    );

    palaces.forEach((p, dst) => {
      p.contributors.forEach((c) => {
        const v = amountOf(c, kind);
        if (!(v > 0)) return;
        const src = idxOf[c.from_code];
        if (src === undefined) return;
        flow[src][dst] += v;
        stars[src][dst].push(c);
      });
    });

    const self = flow.map((row, i) => row[i]);
    const tot = flow.map((row, i) =>
      self[i] + row.reduce((a, v, j) => (j === i ? a : a + v), 0)
        + flow.reduce((a, r, j) => (j === i ? a : a + r[i]), 0),
    );
    const sum = tot.reduce((a, b) => a + b, 0) || 1;
    const span = TAU - n * PAD * 2;

    const arcs: { i: number; a0: number; a1: number; total: number; self: number }[] = [];
    let ang = -PAD;
    tot.forEach((t, i) => {
      ang += PAD;
      const w = (t / sum) * span;
      arcs.push({ i, a0: ang, a1: ang + w, total: t, self: self[i] });
      ang += w + PAD;
    });

    // 弧內依對手宮序切段：先出（i→j）後入（j→i），兩端配對一致才不會交錯
    const cur = arcs.map((a) => a.a0 + (self[a.i] / sum) * span);
    const seg: Record<string, [number, number]> = {};
    arcs.forEach((a) => {
      const i = a.i;
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        if (flow[i][j] > 0) {
          const w = (flow[i][j] / sum) * span;
          seg[`o|${i}|${j}`] = [cur[i], cur[i] + w];
          cur[i] += w;
        }
        if (flow[j][i] > 0) {
          const w = (flow[j][i] / sum) * span;
          seg[`i|${j}|${i}`] = [cur[i], cur[i] + w];
          cur[i] += w;
        }
      }
    });

    const edges: Edge[] = [];
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j || !(flow[i][j] > 0)) continue;
        const s = seg[`o|${i}|${j}`];
        const t = seg[`i|${i}|${j}`];
        if (!s || !t) continue;
        const tc = (t[0] + t[1]) / 2;
        const th = ((t[1] - t[0]) * TAPER) / 2;
        edges.push({
          src: i, dst: j, v: flow[i][j],
          relation: stars[i][j][0]?.relation ?? '三方',
          stars: stars[i][j],
          s0: s[0], s1: s[1], t0: tc - th, t1: tc + th,
        });
      }
    }
    edges.sort((a, b) => b.v - a.v);

    const inflow = palaces.map((_, i) =>
      flow.reduce((a, r, j) => (j === i ? a : a + r[i]), 0),
    );
    return { arcs, edges, self, inflow, flow };
  }, [palaces, idxOf, kind]);

  const selfRates = useMemo(
    () =>
      palaces
        .map((p, i) => {
          const denom = layout.self[i] + layout.inflow[i];
          return { p, rate: denom ? layout.self[i] / denom : 0, total: denom };
        })
        .sort((a, b) => a.rate - b.rate),
    [palaces, layout],
  );

  const relColor = (rel: string) =>
    rel === '對宮' ? 'var(--chord-opposite)' : 'var(--chord-trine)';

  return (
    <section
      className={className}
      style={
        {
          // 兩個序列色槽（固定順序，不隨資料重新指派）
          '--chord-opposite': '#2a78d6',
          '--chord-trine': '#eb6834',
        } as React.CSSProperties
      }
    >
      <header className="mb-3">
        <h2 className="text-base font-semibold text-foreground">宮位取樣弦圖</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          每條弦＝一組星曜從<b className="font-semibold text-foreground">所在宮</b>流向
          <b className="font-semibold text-foreground">被取樣宮</b>的量。粗端為來源、細端為去向。
          弧上的深色內環＝該宮的<b className="font-semibold text-foreground">主宮自給量</b>
          （星就在本宮，不畫成弦）。
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {KIND_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={kind === t.key}
              onClick={() => { setKind(t.key); setFocus(null); }}
              className={[
                'min-h-[32px] border-l border-border px-3 text-xs transition-colors first:border-l-0',
                kind === t.key
                  ? 'bg-foreground font-semibold text-background'
                  : 'text-muted-foreground hover:bg-muted',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <Swatch color="var(--chord-opposite)" label="對宮（w 0.8）" />
          <Swatch color="var(--chord-trine)" label="三方（w 0.5）" />
          <Swatch color="hsl(var(--muted-foreground))" label="主宮自給（w 1.0）" square />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <svg
          viewBox="-330 -330 660 660"
          className="mx-auto h-auto w-full max-w-[600px] flex-[1_1_400px]"
          role="img"
          aria-label="宮位取樣有向弦圖"
        >
          <g>
            {layout.edges.map((e) => {
              const on = focus === null || e.src === focus || e.dst === focus;
              return (
                <path
                  key={`${e.src}-${e.dst}`}
                  d={ribbonPath(e.s0, e.s1, e.t0, e.t1, R - RW - 1.5)}
                  fill={relColor(e.relation)}
                  fillOpacity={0.48}
                  stroke="hsl(var(--card))"
                  strokeWidth={0.7}
                  opacity={on ? 1 : 0.07}
                  className="transition-opacity"
                  onMouseMove={(ev) =>
                    show(ev, (
                      <>
                        <TipTitle>
                          {palaces[e.src].name} → {palaces[e.dst].name}
                        </TipTitle>
                        <TipRow label={`${e.relation}　量`} value={fmt(e.v)} muted />
                        <TipDivider />
                        {e.stars.map((s, i) => (
                          <TipRow
                            key={`${s.star_code}-${i}`}
                            label={s.star}
                            value={fmt(amountOf(s, kind))}
                          />
                        ))}
                      </>
                    ))
                  }
                  onMouseLeave={hide}
                />
              );
            })}
          </g>

          <g>
            {layout.arcs.map((a) => {
              const p = palaces[a.i];
              const mid = (a.a0 + a.a1) / 2;
              const [lx, ly] = P(mid, R + 22);
              const anchor = Math.abs(lx) < 14 ? 'middle' : lx > 0 ? 'start' : 'end';
              const selfW = a.total ? (a.a1 - a.a0) * (a.self / a.total) : 0;
              const on = focus === a.i;
              return (
                <g
                  key={p.code}
                  className="cursor-pointer"
                  onMouseEnter={() => setFocus(a.i)}
                  onMouseLeave={() => { setFocus(null); hide(); }}
                  onMouseMove={(ev) => {
                    const outflow = layout.flow[a.i].reduce(
                      (s, v, j) => (j === a.i ? s : s + v), 0,
                    );
                    const denom = a.self + layout.inflow[a.i];
                    show(ev, (
                      <>
                        <TipTitle>{p.name}（{p.branch}）</TipTitle>
                        <TipRow label="主宮自給" value={fmt(a.self)} muted />
                        <TipRow label="由他宮流入" value={fmt(layout.inflow[a.i])} muted />
                        <TipRow label="流向他宮" value={fmt(outflow)} muted />
                        <TipDivider />
                        <TipRow
                          label="自給率"
                          value={`${denom ? Math.round((a.self / denom) * 100) : 0}%`}
                        />
                      </>
                    ));
                  }}
                >
                  <path d={arcPath(a.a0, a.a1, R - RW, R)} fill="hsl(var(--border))" />
                  {selfW > 0 && (
                    <path
                      d={arcPath(a.a0, a.a0 + selfW, R - RW, R)}
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.75}
                    />
                  )}
                  <text
                    x={lx.toFixed(1)}
                    y={(ly - 1).toFixed(1)}
                    textAnchor={anchor}
                    fontSize={11.5}
                    fontWeight={on ? 600 : 400}
                    fill={on ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
                  >
                    {p.name}
                  </text>
                  <text
                    x={lx.toFixed(1)}
                    y={(ly + 11).toFixed(1)}
                    textAnchor={anchor}
                    fontSize={10}
                    fill="hsl(var(--muted-foreground))"
                  >
                    {p.branch}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="min-w-[240px] flex-[1_1_240px]">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
            自給率排序（低 → 高）·{' '}
            {KIND_TABS.find((t) => t.key === kind)?.label}
          </h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {selfRates.map(({ p, rate, total }) => (
                <tr key={p.code} className="border-b border-border">
                  <td className="py-1.5 text-muted-foreground">
                    {p.name}
                    <span
                      className="mt-0.5 block h-1 rounded-full bg-muted-foreground/50"
                      style={{ width: `${Math.round(rate * 100)}%` }}
                    />
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{Math.round(rate * 100)}%</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {fmt(total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            自給率＝主宮自身的量 ÷ 該宮流入總量。
            <b className="font-semibold text-foreground">越低代表這個宮的力量越多來自其他宮</b>。
          </p>
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        <b className="font-semibold text-muted-foreground">結構備註</b>　三方弦連的是同一組三合局，
        因此橘色弦會自己畫出四個三角形；對宮弦連的是六組對沖，藍色弦會自己畫出六條直徑。
        這是三方四正的取樣窗幾何，不是排版效果。
      </p>

      <ChartTooltip tip={tip} />
    </section>
  );
}

function Swatch({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={square ? 'h-3 w-3 flex-none rounded-sm' : 'h-2.5 w-5 flex-none rounded-sm'}
        style={{ background: color, opacity: square ? 0.75 : 0.62 }}
      />
      {label}
    </span>
  );
}

export type { PalaceReading };
