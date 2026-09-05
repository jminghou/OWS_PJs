'use client';

import { useMemo } from 'react';
import type { PalaceReadingsPayload } from '@/lib/api';
import { ChartTooltip, TipDivider, TipRow, TipTitle, useChartTooltip } from './ChartTooltip';

/**
 * A1 · 輔星流量矩陣（12 宮 × 8 輔星組）。
 *
 * 格值＝該輔星組流入該宮的**原始流量**（Σ E×w，未乘類權）。
 * 輔星類權為 0 ⇒ 不入 S總；這張圖看的是「同組疊加的突波落在哪個宮」。
 *
 * 顏色：單一色相的序列色階（藍，淺→深）。序列編碼只用一個色相，
 * 不用彩虹——彩虹會讓人以為不同顏色是不同類別。
 * 「無流入」不是色階的最淺階，而是虛線空格，兩者語意不同不可混。
 */

/** 序列色階：藍 100→700。近零最淺（向底色退），最高最深。 */
const RAMP = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
  '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
];

/** 該底色上該用深字還是淺字（sRGB 相對亮度）。 */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  return L > 0.42 ? '#0b0b0b' : '#ffffff';
}

const fmt = (v: number) => v.toFixed(2);

export default function PalaceAuxHeatmap({
  readings,
  className,
}: {
  readings: PalaceReadingsPayload;
  className?: string;
}) {
  const { tip, show, hide } = useChartTooltip();
  const groups = readings.meta.aux_groups;

  const { max, auxMax, totalMax, grand } = useMemo(() => {
    let m = 0;
    readings.palaces.forEach((p) => groups.forEach((g) => {
      const v = p.aux_flow[g] ?? 0;
      if (v > m) m = v;
    }));
    return {
      max: m || 1,
      auxMax: Math.max(...readings.palaces.map((p) => p.s_aux_flow), 0.0001),
      totalMax: Math.max(...groups.map((g) => readings.aux_totals[g] ?? 0), 0.0001),
      grand: groups.reduce((a, g) => a + (readings.aux_totals[g] ?? 0), 0),
    };
  }, [readings, groups]);

  const color = (v: number) => RAMP[Math.round((v / max) * (RAMP.length - 1))];

  return (
    <section className={className}>
      <header className="mb-3">
        <h2 className="text-base font-semibold text-foreground">輔星流量矩陣</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          格值＝該輔星組流入該宮的原始流量（Σ E×w，未乘類權）。
          <b className="font-semibold text-foreground">輔星不入 S總</b>
          ，這張圖看的是同組疊加的突波位置。滑過格子可下鑽到逐星明細。
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          0
          <span
            className="h-2.5 w-28 rounded-full"
            style={{ background: `linear-gradient(90deg, ${RAMP.join(',')})` }}
          />
          {fmt(max)}
          <span className="ml-1">流量</span>
        </span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 flex-none rounded-sm ring-[1.5px] ring-inset ring-foreground" />
          該宮最強輔星組
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 flex-none rounded-sm border border-dashed border-border" />
          無流入
        </span>
      </div>

      {/* 窄螢幕讓矩陣自己橫向捲動，頁面本體不橫捲 */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          className="grid min-w-[620px] gap-0.5"
          style={{
            gridTemplateColumns: `74px repeat(${groups.length}, minmax(54px, 1fr)) 88px`,
          }}
        >
          <div />
          {groups.map((g) => (
            <div key={g} className="self-end pb-1 text-center text-[11px] leading-tight text-muted-foreground">
              {g}
            </div>
          ))}
          <div className="self-end pb-1 text-center text-[11px] text-muted-foreground">S輔</div>

          {readings.palaces.map((p) => {
            const rowVals = groups.map((g) => p.aux_flow[g] ?? 0).filter((v) => v > 0);
            const rowMax = rowVals.length ? Math.max(...rowVals) : null;
            return (
              <FragmentRow
                key={p.code}
                palace={p}
                groups={groups}
                rowMax={rowMax}
                color={color}
                auxMax={auxMax}
                onShow={show}
                onHide={hide}
              />
            );
          })}

          <div className="border-t border-border pr-2 pt-1.5 text-right text-[11px] text-muted-foreground">
            全盤Σ
          </div>
          {groups.map((g) => {
            const v = readings.aux_totals[g] ?? 0;
            return (
              <div
                key={g}
                className={[
                  'border-t border-border pt-1.5 text-center text-[11px] tabular-nums',
                  v === totalMax ? 'font-semibold text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {fmt(v)}
              </div>
            );
          })}
          <div className="border-t border-border pt-1.5 text-center text-[11px] tabular-nums text-muted-foreground">
            {fmt(grand)}
          </div>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer list-none py-1.5 text-xs text-muted-foreground">
          ▸ 資料表檢視
        </summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-medium">宮位</th>
                {groups.map((g) => (
                  <th key={g} className="px-2 py-1.5 text-right font-medium">{g}</th>
                ))}
                <th className="px-2 py-1.5 text-right font-medium">S輔</th>
              </tr>
            </thead>
            <tbody>
              {readings.palaces.map((p) => (
                <tr key={p.code} className="border-b border-border">
                  <td className="px-2 py-1.5">{p.name}（{p.branch}）</td>
                  {groups.map((g) => (
                    <td key={g} className="px-2 py-1.5 text-right tabular-nums">
                      {p.aux_flow[g] ? fmt(p.aux_flow[g]) : '—'}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(p.s_aux_flow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        <b className="font-semibold text-muted-foreground">讀圖注意</b>　底列「全盤Σ」是欄合計，
        但取樣窗會讓同一顆星被多個宮重複取樣，
        <b className="font-semibold text-foreground">因此它只能做組間相對比較，不是全盤總量</b>。
        右欄 S輔 與各宮 S總 量綱不同，不可同軸比較。
      </p>

      <ChartTooltip tip={tip} />
    </section>
  );
}

function FragmentRow({
  palace,
  groups,
  rowMax,
  color,
  auxMax,
  onShow,
  onHide,
}: {
  palace: PalaceReadingsPayload['palaces'][number];
  groups: string[];
  rowMax: number | null;
  color: (v: number) => string;
  auxMax: number;
  onShow: (e: { clientX: number; clientY: number }, c: React.ReactNode) => void;
  onHide: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-end gap-1 pr-2 text-xs text-foreground">
        <span className="font-medium">{palace.name}</span>
        <span className="text-[10px] text-muted-foreground">{palace.branch}</span>
      </div>

      {groups.map((g) => {
        const v = palace.aux_flow[g] ?? 0;
        if (!v) {
          return (
            <div
              key={g}
              className="flex h-8 items-center justify-center rounded border border-dashed border-border text-[11px] text-muted-foreground"
            >
              －
            </div>
          );
        }
        const bg = color(v);
        const ink = inkOn(bg);
        const stars = palace.contributors.filter((c) => c.group === 'aux' && c.attr === g);
        return (
          <div
            key={g}
            className="relative flex h-8 items-center justify-center rounded text-xs tabular-nums transition-[filter] hover:brightness-105"
            style={{ background: bg, color: ink }}
            onMouseMove={(e) =>
              onShow(e, (
                <>
                  <TipTitle>
                    {palace.name}（{palace.branch}）· {g}
                  </TipTitle>
                  <TipRow label="流入該宮" value={fmt(v)} muted />
                  {stars.length > 0 && <TipDivider />}
                  {stars.map((s, i) => (
                    <TipRow
                      key={`${s.star_code}-${i}`}
                      label={
                        <>
                          {s.star}{' '}
                          <span className="text-muted-foreground">
                            {s.from_palace}·{s.relation}
                          </span>
                        </>
                      }
                      value={fmt(s.flow)}
                    />
                  ))}
                  {stars.length > 1 && <TipRow label="合計" value={fmt(v)} muted />}
                  {v === rowMax && (
                    <>
                      <TipDivider />
                      <span className="text-muted-foreground">該宮最強輔星組</span>
                    </>
                  )}
                </>
              ))
            }
            onMouseLeave={onHide}
          >
            {fmt(v)}
            {v === rowMax && (
              /* ring-current 讓外框跟著格內字色走：淺格深框、深格淺框，兩邊都看得見 */
              <span
                className="pointer-events-none absolute inset-[2px] rounded-[3px] ring-[1.5px] ring-inset ring-current"
                style={{ color: ink }}
              />
            )}
          </div>
        );
      })}

      <div className="flex h-8 items-center gap-1.5 pl-2">
        <span
          className="h-2 flex-none rounded-r"
          style={{
            width: `${(palace.s_aux_flow / auxMax) * 48}px`,
            background: 'hsl(var(--primary))',
            opacity: 0.35,
          }}
        />
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {fmt(palace.s_aux_flow)}
        </span>
      </div>
    </>
  );
}
