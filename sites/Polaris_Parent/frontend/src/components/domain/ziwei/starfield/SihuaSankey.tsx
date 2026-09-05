'use client';

import { useMemo, useState } from 'react';
import type { PalaceReadingsPayload } from '@/lib/api';
import { ChartTooltip, TipRow, TipTitle, useChartTooltip } from './ChartTooltip';

/**
 * A4 · 四化桑基（通道 ／ 場強 雙圖對照）。
 *
 * 同一組四化，引擎裡有**兩組係數不同的量**，而且排序剛好相反：
 *
 *   通道值 ＝ E × k × w場外   性質標記，進 86 維向量的 channel 維
 *            k：忌 1.6 最大、權 1.4、祿 1.2、科 1.0
 *   場強   ＝ E × g × w場     實際加進 S總 的量
 *            g：權/科 1.2、祿 1.0、**忌 0.5 最小**
 *
 * 所以同一顆化忌，用通道看可能是絕對主宰，用場強看卻是最弱的一條。
 * **兩張圖都對，但講的是不同的事，不可混用**——並列就是為了讓這件事自己說話。
 *
 * 節點高度是「該版本內的佔比」（各自歸一化），總量另外標在標題，
 * 這樣比較的是結構而不是被總量大小蓋過。
 */

const HUA_ORDER = ['祿', '權', '科', '忌'];

/**
 * 四化四色。這組跑過色盲全對比檢驗，雙模式通過，但落在 CVD 警告帶，
 * 依規則**必須配次要編碼**——所以每個節點都直接標數值與百分比，
 * 顏色從不單獨承載訊息，另附資料表檢視。
 */
const HUE: Record<string, string> = {
  祿: '#1baf7a',
  權: '#2a78d6',
  科: '#eda100',
  忌: '#d03b3b',
};

const X0 = 0;
const X1 = 400;
const NW = 13;
const H = 420;
const S_GAP = 14;
const T_GAP = 6;

const fmt = (v: number) => v.toFixed(2);

interface Link { star: string; hua: string; palaceCode: string; value: number }

export default function SihuaSankey({
  readings,
  className,
}: {
  readings: PalaceReadingsPayload;
  className?: string;
}) {
  const { tip, show, hide } = useChartTooltip();

  const sets = useMemo(() => {
    const channel: Link[] = [];
    const field: Link[] = [];
    readings.palaces.forEach((p) => {
      p.contributors.forEach((c) => {
        Object.entries(c.channels || {}).forEach(([hua, value]) => {
          if (value > 0) channel.push({ star: c.star, hua, palaceCode: p.code, value });
        });
      });
      p.field_sources.forEach((f) => {
        if (f.strength > 0) {
          field.push({ star: f.star, hua: f.hua, palaceCode: p.code, value: f.strength });
        }
      });
    });
    return { channel, field };
  }, [readings]);

  return (
    <section className={className}>
      <header className="mb-3">
        <h2 className="text-base font-semibold text-foreground">四化桑基（通道 ／ 場強 對照）</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          同一組四化，引擎裡有<b className="font-semibold text-foreground">兩組係數不同的量</b>：
          左圖是<b className="font-semibold text-foreground">通道值</b>（E×k×w，性質標記，進 86 維向量的 channel 維）；
          右圖是<b className="font-semibold text-foreground">場強</b>（E×g×w場，實際加進 S總 的量）。
          兩者的排序<b className="font-semibold text-foreground">可能相反</b>——這正是畫圖前必須先決定要講哪一個的原因。
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
        {HUA_ORDER.map((h) => (
          <span key={h} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 flex-none rounded-sm" style={{ background: HUE[h] }} />
            化{h}
          </span>
        ))}
        <span className="ml-1">節點高度＝該版本內的佔比（兩圖各自歸一化，總量見標題）</span>
      </div>

      <div className="flex flex-wrap gap-5">
        <SankeyPanel
          title="通道值"
          caption="E × k × w（性質標記；進 86 維向量的 channel 維）"
          links={sets.channel}
          palaces={readings.palaces}
          onShow={show}
          onHide={hide}
        />
        <SankeyPanel
          title="場強"
          caption="E × g × w場（實際加進 S總 的量；獨立空間表，不走取樣窗）"
          links={sets.field}
          palaces={readings.palaces}
          onShow={show}
          onHide={hide}
        />
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        <b className="font-semibold text-muted-foreground">為什麼會反轉</b>　通道係數 k：忌 1.6 最大；
        場強係數 g：忌 0.5 最小（權／科 1.2、祿 1.0）。
        <b className="font-semibold text-foreground">兩張圖都對，但講的是不同的事，不可混用。</b>
      </p>

      <ChartTooltip tip={tip} />
    </section>
  );
}

function SankeyPanel({
  title,
  caption,
  links,
  palaces,
  onShow,
  onHide,
}: {
  title: string;
  caption: string;
  links: Link[];
  palaces: PalaceReadingsPayload['palaces'];
  onShow: (e: { clientX: number; clientY: number }, c: React.ReactNode) => void;
  onHide: () => void;
}) {
  const [hot, setHot] = useState<string | null>(null);
  const nameOf = useMemo(
    () => Object.fromEntries(palaces.map((p) => [p.code, p.name])),
    [palaces],
  );

  const model = useMemo(() => {
    const bySource = new Map<string, { star: string; hua: string; total: number; targets: Map<string, number> }>();
    const inflow = new Map<string, number>();
    links.forEach((l) => {
      const key = `${l.star}|${l.hua}`;
      if (!bySource.has(key)) bySource.set(key, { star: l.star, hua: l.hua, total: 0, targets: new Map() });
      const s = bySource.get(key)!;
      s.total += l.value;
      s.targets.set(l.palaceCode, (s.targets.get(l.palaceCode) ?? 0) + l.value);
      inflow.set(l.palaceCode, (inflow.get(l.palaceCode) ?? 0) + l.value);
    });

    const srcs = [...bySource.values()].sort(
      (a, b) => HUA_ORDER.indexOf(a.hua) - HUA_ORDER.indexOf(b.hua),
    );
    const tgts = palaces.filter((p) => (inflow.get(p.code) ?? 0) > 0);
    const grand = srcs.reduce((a, s) => a + s.total, 0) || 1;

    const sAvail = H - S_GAP * Math.max(0, srcs.length - 1);
    const tAvail = H - T_GAP * Math.max(0, tgts.length - 1);

    const sPos = new Map<string, { y: number; h: number; cur: number }>();
    let y = 0;
    srcs.forEach((s) => {
      const h = (s.total / grand) * sAvail;
      sPos.set(`${s.star}|${s.hua}`, { y, h, cur: y });
      y += h + S_GAP;
    });
    const tPos = new Map<string, { y: number; h: number; cur: number }>();
    y = 0;
    tgts.forEach((p) => {
      const h = ((inflow.get(p.code) ?? 0) / grand) * tAvail;
      tPos.set(p.code, { y, h, cur: y });
      y += h + T_GAP;
    });

    // 目標端依化類序分配，來源端依宮位序——兩端配對一致，交叉才有規律
    const ribbons: { key: string; d: string; hua: string; star: string; palace: string; v: number }[] = [];
    tgts.forEach((p) => {
      srcs.forEach((s) => {
        const v = s.targets.get(p.code);
        if (!v) return;
        const sp = sPos.get(`${s.star}|${s.hua}`)!;
        const tp = tPos.get(p.code)!;
        const sh = (v / grand) * sAvail;
        const th = (v / grand) * tAvail;
        const sy = sp.cur; sp.cur += sh;
        const ty = tp.cur; tp.cur += th;
        const mx = (X0 + NW + X1) / 2;
        ribbons.push({
          key: `${s.star}${s.hua}-${p.code}`,
          hua: s.hua, star: s.star, palace: p.name, v,
          d:
            `M${X0 + NW},${sy.toFixed(1)}C${mx},${sy.toFixed(1)} ${mx},${ty.toFixed(1)} ${X1},${ty.toFixed(1)}` +
            `L${X1},${(ty + th).toFixed(1)}C${mx},${(ty + th).toFixed(1)} ${mx},${(sy + sh).toFixed(1)} ${X0 + NW},${(sy + sh).toFixed(1)}Z`,
        });
      });
    });
    ribbons.sort((a, b) => b.v - a.v);

    return { srcs, tgts, grand, sPos, tPos, inflow, ribbons };
  }, [links, palaces]);

  return (
    <div className="min-w-[320px] flex-[1_1_400px] rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{caption}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
        {fmt(model.grand)}
        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">全盤總量</span>
      </p>

      <svg
        viewBox="-104 -14 604 448"
        className="mt-1 block h-auto w-full"
        role="img"
        aria-label={`四化${title}桑基圖`}
      >
        {model.ribbons.map((r) => (
          <path
            key={r.key}
            d={r.d}
            fill={HUE[r.hua]}
            fillOpacity={0.42}
            stroke="hsl(var(--card))"
            strokeWidth={0.6}
            opacity={hot && hot !== r.hua ? 0.07 : 1}
            className="cursor-pointer transition-opacity"
            onMouseMove={(e) => {
              setHot(r.hua);
              onShow(e, (
                <>
                  <TipTitle>{r.star}化{r.hua} → {r.palace}</TipTitle>
                  <TipRow label={title} value={fmt(r.v)} muted />
                  <TipRow label="佔全盤" value={`${((r.v / model.grand) * 100).toFixed(1)}%`} muted />
                </>
              ));
            }}
            onMouseLeave={() => { setHot(null); onHide(); }}
          />
        ))}

        {model.srcs.map((s) => {
          const n = model.sPos.get(`${s.star}|${s.hua}`)!;
          const my = n.y + n.h / 2;
          return (
            <g key={`${s.star}|${s.hua}`}>
              <rect x={X0} y={n.y} width={NW} height={n.h} rx={2} fill={HUE[s.hua]} />
              <text x={-8} y={(my - 2).toFixed(1)} textAnchor="end" fontSize={11}
                    fontWeight={600} fill="hsl(var(--foreground))">
                {s.star}化{s.hua}
              </text>
              <text x={-8} y={(my + 11).toFixed(1)} textAnchor="end" fontSize={10.5}
                    fill="hsl(var(--muted-foreground))">
                {fmt(s.total)}　{Math.round((s.total / model.grand) * 100)}%
              </text>
            </g>
          );
        })}

        {model.tgts.map((p) => {
          const n = model.tPos.get(p.code)!;
          return (
            <g key={p.code}>
              <rect x={X1} y={n.y} width={NW} height={n.h} rx={2} fill="hsl(var(--border))" />
              <text x={X1 + NW + 7} y={(n.y + n.h / 2 + 4).toFixed(1)} fontSize={11}
                    fill="hsl(var(--muted-foreground))">
                {p.name}{' '}
                <tspan fontSize={10.5} fill="hsl(var(--muted-foreground))">
                  {fmt(model.inflow.get(p.code) ?? 0)}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
