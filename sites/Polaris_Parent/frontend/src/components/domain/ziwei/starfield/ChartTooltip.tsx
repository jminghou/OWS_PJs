'use client';

import { useCallback, useState, type ReactNode } from 'react';

/**
 * 星場圖表共用的 hover 提示。
 *
 * 三張圖（熱力圖／弦圖／桑基）都需要「滑過某個標記 → 顯示明細」，
 * 行為一致就集中在這裡：跟隨游標、碰到視窗邊界自動翻邊、pointer-events: none
 * 不擋滑鼠事件。
 */

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

export function useChartTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);

  const show = useCallback((e: { clientX: number; clientY: number }, content: ReactNode) => {
    setTip({ x: e.clientX, y: e.clientY, content });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  return { tip, show, hide };
}

/** 尺寸估值：只用來決定要不要翻邊，翻錯的代價是貼邊而非跑出畫面。 */
const EST_W = 260;
const EST_H = 150;
const GAP = 14;

export function ChartTooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;

  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
  const left = tip.x + GAP + EST_W > vw - 8 ? Math.max(8, tip.x - GAP - EST_W) : tip.x + GAP;
  const top = tip.y + GAP + EST_H > vh - 8 ? Math.max(8, tip.y - GAP - EST_H) : tip.y + GAP;

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-[260px] rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-foreground shadow-lg"
      style={{ left, top }}
    >
      {tip.content}
    </div>
  );
}

/** 提示內的一列：左標籤、右數值（數值走等寬數字，直向對齊）。 */
export function TipRow({
  label,
  value,
  muted,
}: {
  label: ReactNode;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function TipTitle({ children }: { children: ReactNode }) {
  return <div className="mb-1 font-semibold">{children}</div>;
}

export function TipDivider() {
  return <hr className="my-1.5 border-border" />;
}
