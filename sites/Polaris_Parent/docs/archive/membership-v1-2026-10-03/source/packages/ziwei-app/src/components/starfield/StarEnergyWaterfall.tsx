'use client';

import { useMemo } from 'react';
import type { StarEnergyCard, StarEnergyStep } from '../../api/astrology';

/**
 * 單顆星的 E 組成瀑布圖。
 *
 *   E ＝ 亮度倍率 × (1 + 影響加成 M) × 空劫衰減
 *
 * 每一段的數值都由後端（p_d_graph_v3/star_energy.py）算好放在 `star.steps`，
 * 本元件**只負責畫**——係數表是後端的唯一真源，前端不重算、不硬編任何係數。
 *
 * 四化不是獨立的一段：它在 E 這條鏈上唯一的作用是讓帶四化的星豁免空劫，
 * 所以會顯示在「空劫」那一步（note 為「豁免（帶化X）」），
 * 並在下方以反事實呈現「若未帶四化會被砍成多少」。
 *
 * 顏色：增益／損失屬狀態語意，一律**同時**帶正負號與方向箭頭，
 * 不讓顏色單獨承載訊息（色盲與黑白列印皆可讀）。
 */

const VB_W = 340;
const VB_H = 210;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 26;
const PAD_B = 44;

/** 視為「無變化」的門檻——浮點誤差不該畫成箭頭。 */
const FLAT = 0.005;

const fmt = (v: number) => v.toFixed(2);
/** 顯示用數字：2 位並去尾隨 0（1.20→1.2、0.00→0）。與後端 star_energy._disp 同規則，
 *  避免同一個數字在柱標籤與等式列出現兩種精度。 */
const num = (v: number) => {
  const s = v.toFixed(2).replace(/\.?0+$/, '');
  return s === '' || s === '-' ? '0' : s;
};

interface Props {
  star: StarEnergyCard;
  /** 隱藏標題列（外層已有標題時用）。 */
  hideHeader?: boolean;
  className?: string;
}

export default function StarEnergyWaterfall({ star, hideHeader, className }: Props) {
  const { steps, top, bandW, barW } = useMemo(() => {
    const s = star.steps;
    const peak = Math.max(...s.map((x) => Math.max(x.from, x.to)), star.e) || 1;
    const band = (VB_W - PAD_L - PAD_R) / s.length;
    return {
      steps: s,
      top: peak * 1.18,
      bandW: band,
      barW: Math.min(40, band * 0.56),
    };
  }, [star]);

  const y = (v: number) => VB_H - PAD_B - (v / top) * (VB_H - PAD_T - PAD_B);
  const cx = (i: number) => PAD_L + bandW * i + bandW / 2;

  const cf = star.counterfactual;
  const note = cf?.without_void?.text ?? cf?.without_sihua?.text ?? null;
  const noteTone = cf?.without_void ? 'loss' : cf?.without_sihua ? 'gain' : null;

  return (
    <div
      className={['rounded-xl border border-border bg-card p-4', className]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          // 狀態色：增益用固定的 status-good（非品牌色，不隨主題換）；
          // 損失沿用設計系統既有的 destructive。
          '--star-gain': '#0ca30c',
          '--star-loss': 'hsl(var(--destructive))',
        } as React.CSSProperties
      }
    >
      {!hideHeader && (
        <header className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            {star.name}
            <span className="ml-2 font-normal text-muted-foreground">{star.attr}</span>
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {star.palace}
            {star.branch && `（${star.branch}）`}　E ＝ 亮度倍率 × (1 + 影響加成 M) × 空劫衰減
          </p>
        </header>
      )}

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${star.name} 的 E 組成瀑布圖，最終 E 為 ${fmt(star.e)}`}
      >
        <line
          x1={PAD_L}
          y1={y(0)}
          x2={VB_W - PAD_R}
          y2={y(0)}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />
        {steps.map((st, i) => (
          <Bar
            key={st.key}
            step={st}
            prev={i > 0 ? steps[i - 1] : null}
            x={cx(i) - barW / 2}
            cx={cx(i)}
            prevRight={i > 0 ? cx(i - 1) + barW / 2 : 0}
            w={barW}
            y={y}
          />
        ))}
      </svg>

      <p className="mt-2 text-xs leading-relaxed tabular-nums text-muted-foreground">
        <b className="font-semibold text-foreground">{num(star.brightness_k)}</b>
        {' × (1'}
        {star.m >= 0 ? '＋' : '−'}
        {num(Math.abs(star.m))}
        {') × '}
        {num(star.void_k)}
        {' ＝ '}
        <b className="font-semibold text-foreground">{fmt(star.e)}</b>
      </p>

      {note && (
        <p
          className="mt-1 text-xs leading-relaxed"
          style={{ color: noteTone === 'loss' ? 'var(--star-loss)' : 'var(--star-gain)' }}
        >
          {note}
        </p>
      )}

      {!star.adjusted && star.degenerate_note && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {star.degenerate_note}
        </p>
      )}
    </div>
  );
}

/** 單一柱：起訖柱（基準／E）走中性色，變化柱依正負著色並強制帶符號。 */
function Bar({
  step,
  prev,
  x,
  cx,
  prevRight,
  w,
  y,
}: {
  step: StarEnergyStep;
  prev: StarEnergyStep | null;
  x: number;
  cx: number;
  prevRight: number;
  w: number;
  y: (v: number) => number;
}) {
  const isTotal = step.role === 'total';
  const d = step.to - step.from;
  const flat = Math.abs(d) < FLAT;
  const up = d >= 0;

  const yTop = y(Math.max(step.from, step.to));
  const yBottom = y(Math.min(step.from, step.to));
  const h = Math.max(2, yBottom - yTop);

  const fill = isTotal
    ? 'hsl(var(--muted-foreground))'
    : flat
      ? 'hsl(var(--border))'
      : up
        ? 'var(--star-gain)'
        : 'var(--star-loss)';
  const opacity = isTotal ? 0.55 : flat ? 0.9 : 0.85;

  const labelFill = isTotal
    ? 'hsl(var(--foreground))'
    : flat
      ? 'hsl(var(--muted-foreground))'
      : up
        ? 'var(--star-gain)'
        : 'var(--star-loss)';
  const labelText = isTotal
    ? fmt(step.to)
    : flat
      ? '無變化'
      : `${up ? '▲＋' : '▼−'}${Math.abs(d).toFixed(2)}`;

  return (
    <g>
      {prev && !isTotal && (
        <line
          x1={prevRight}
          y1={y(prev.to)}
          x2={x}
          y2={y(prev.to)}
          stroke="hsl(var(--border))"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      <rect x={x} y={yTop} width={w} height={h} rx={3} fill={fill} fillOpacity={opacity} />
      <text
        x={cx}
        y={yTop - 6}
        textAnchor="middle"
        fontSize={isTotal ? 11 : 10.5}
        fontWeight={600}
        fill={labelFill}
      >
        {labelText}
      </text>
      <text x={cx} y={VB_H - PAD_B + 15} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
        {step.label}
      </text>
      {step.note && (
        <text x={cx} y={VB_H - PAD_B + 28} textAnchor="middle" fontSize={9.5} fill="hsl(var(--muted-foreground))">
          {step.note}
        </text>
      )}
    </g>
  );
}
