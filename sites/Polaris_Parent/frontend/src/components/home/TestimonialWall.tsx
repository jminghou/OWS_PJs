'use client';

import { useEffect } from 'react';

const SENJA_SCRIPT = 'https://static.senja.io/dist/platform.js';

interface TestimonialWallProps {
  /** Senja widget 的 ID（Senja 後台 → Widgets → 該 widget → Share → Embed 程式碼裡的 data-id） */
  widgetId?: string;
  heading: string;
}

/**
 * 使用者回饋牆：嵌入 Senja 的 widget（https://senja.io）。內容完全在 Senja 後台管理
 * （收集、審核、排版、樣式），這裡只負責放容器並載入它的腳本。
 *
 * Senja 官方的嵌入方式是「.senja-embed 容器 + platform.js」，腳本載入時會掃描頁面上的容器。
 * 這裡每次掛載都重新插入腳本，而不是用 next/script 載一次：站內換頁回到首頁時容器是新的，
 * 只載一次的話腳本不會再掃描，牆會是空的。
 *
 * 沒設定 widget ID 時：正式環境整個區塊不輸出；開發環境顯示預留位置，方便確認版面。
 */
export default function TestimonialWall({ widgetId, heading }: TestimonialWallProps) {
  useEffect(() => {
    if (!widgetId) return;
    const script = document.createElement('script');
    script.src = SENJA_SCRIPT;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [widgetId]);

  if (!widgetId && process.env.NODE_ENV === 'production') return null;

  return (
    <section aria-labelledby="home-testimonials-heading" className="scroll-mt-20">
      <h2 id="home-testimonials-heading" className="mx-auto max-w-[680px] text-2xl font-bold text-gray-900">
        {heading}
      </h2>
      <div className="mt-8">
        {widgetId ? (
          // data-mode="shadow"：widget 渲染在 shadow DOM 裡，樣式與本站互不干擾
          <div className="senja-embed" data-id={widgetId} data-mode="shadow" data-lazyload="false" />
        ) : (
          <div className="rounded-banner border-2 border-dashed border-warm-300 bg-white/60 px-6 py-16 text-center text-gray-500">
            <p className="font-medium text-gray-700">回饋牆預留位置（只在開發環境顯示）</p>
            <p className="mt-2 text-sm">
              在 <code className="rounded bg-warm-100 px-1.5 py-0.5">.env.local</code> 設定{' '}
              <code className="rounded bg-warm-100 px-1.5 py-0.5">NEXT_PUBLIC_SENJA_WIDGET_ID</code> 後，這裡會顯示 Senja 的回饋牆。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
