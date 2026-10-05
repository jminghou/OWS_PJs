'use client';

import { useEffect, useId, useRef } from 'react';

export interface WheelOption<T extends string | number> {
  value: T;
  label: string;
}

interface WheelColumnProps<T extends string | number> {
  /** 給報讀器的欄位名稱（年、月、日…） */
  label: string;
  options: WheelOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PAD = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;

/**
 * 滾輪選擇器的一欄：原生捲動 + CSS scroll-snap，停在正中間那一列就是選取值。
 * 不依賴套件。觸控滑動、滑鼠滾輪、點選、鍵盤（↑↓ PageUp/Down Home End）都能操作；
 * 對報讀器是一個 listbox。
 */
export default function WheelColumn<T extends string | number>({
  label, options, value, onChange, className = '',
}: WheelColumnProps<T>) {
  const id = useId();
  const scroller = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  // 程式捲動（外部改值、鍵盤、點選）的目標位置；抵達前的捲動事件不是使用者的選擇，不解讀
  const programmaticTarget = useRef<number | null>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  // 外部改值（或選項變動，例如月份改變後日數變少）→ 捲到對應位置
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const top = index * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - top) > 1) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      programmaticTarget.current = top;
      el.scrollTo({ top, behavior: mounted.current && !reduceMotion ? 'smooth' : 'auto' });
    }
    mounted.current = true;
  }, [index, options.length]);

  // 依捲動位置提交選取值。用 ref 取最新的 props，讓計時器與卸載時的收尾都拿得到
  const latest = useRef({ options, value, onChange });
  latest.current = { options, value, onChange };
  const lastScrollTop = useRef<number | null>(null);
  const commit = () => {
    settleTimer.current = null;
    if (lastScrollTop.current === null) return;
    const { options: opts, value: current, onChange: emit } = latest.current;
    const next = Math.min(opts.length - 1, Math.max(0, Math.round(lastScrollTop.current / ITEM_HEIGHT)));
    if (opts[next].value !== current) emit(opts[next].value);
  };

  // 卸載時（例如滑完立刻按「完成」關閉面板）還沒到靜止判定的時間 → 直接提交，不要丟掉這次選擇
  useEffect(() => () => {
    if (settleTimer.current) {
      clearTimeout(settleTimer.current);
      commit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 捲動停下來後，取最靠近中線的那一列
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = event.currentTarget;
    if (programmaticTarget.current !== null) {
      // 動畫途中若瀏覽器卡頓，中間位置會被當成「停下來了」而把值彈回去 —— 所以到站前一律略過
      if (Math.abs(scrollTop - programmaticTarget.current) <= 1) programmaticTarget.current = null;
      return;
    }
    lastScrollTop.current = scrollTop;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(commit, 120);
  };

  const releaseProgrammatic = () => {
    programmaticTarget.current = null;
  };

  const select = (next: number) => {
    const clamped = Math.min(options.length - 1, Math.max(0, next));
    if (options[clamped].value !== value) onChange(options[clamped].value);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      PageUp: index - VISIBLE_ROWS,
      PageDown: index + VISIBLE_ROWS,
      Home: 0,
      End: options.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key]);
    }
  };

  return (
    <div className={`relative ${className}`} style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}>
      {/* 中線的選取框 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 rounded-lg border-y border-brand-purple-200 bg-brand-purple-50/60"
        style={{ top: PAD, height: ITEM_HEIGHT }}
      />
      <div
        ref={scroller}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${id}-${index}`}
        tabIndex={0}
        onScroll={handleScroll}
        // 使用者親手介入（觸控、滑鼠、滾輪）就交還控制權
        onPointerDown={releaseProgrammatic}
        onTouchStart={releaseProgrammatic}
        onWheel={releaseProgrammatic}
        onKeyDown={handleKeyDown}
        className="relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-lg outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-brand-purple-500 [&::-webkit-scrollbar]:hidden"
        style={{
          paddingTop: PAD,
          paddingBottom: PAD,
          // 上下淡出，讓中線那一列最清楚
          maskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 35%, #000 65%, transparent)',
        }}
      >
        {options.map((option, i) => (
          <div
            key={option.value}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === index}
            onClick={() => select(i)}
            className={`flex cursor-pointer snap-center items-center justify-center whitespace-nowrap text-lg tabular-nums transition-colors ${
              i === index ? 'font-semibold text-gray-900' : 'text-gray-500'
            }`}
            style={{ height: ITEM_HEIGHT }}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
}
