'use client';

import { useState } from 'react';
import type { PalaceReadingsPayload, StarEnergyPayload } from '../../api/astrology';
import PalaceAuxHeatmap from './PalaceAuxHeatmap';
import PalaceChordDiagram from './PalaceChordDiagram';
import SihuaSankey from './SihuaSankey';
import StarEnergyPanel from './StarEnergyPanel';

/**
 * 星場分析區塊：四張圖以分頁呈現。
 *
 * 四張圖同時攤開會是一面牆，且它們回答的是不同問題，
 * 一次看一張才讀得下去——所以用分頁而不是堆疊。
 *
 * 資料全部來自排盤那一次 /calculate（include_star_energy + include_readings），
 * 切分頁不打 API、不重算。
 *
 * `palaceCode` 可由互動命盤的 onPalaceClick 餵進來：點宮位 → 星曜能量分頁
 * 自動收斂到該宮。命盤與這裡用的是同一套宮位代碼（1…C）。
 */

type TabKey = 'star' | 'heat' | 'chord' | 'sihua';

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: 'star', label: '星曜能量', hint: '每顆星的 E 與它的組成' },
  { key: 'heat', label: '輔星矩陣', hint: '哪個宮位堆了哪一組輔星' },
  { key: 'chord', label: '取樣弦圖', hint: '每個宮的力量從哪裡來' },
  { key: 'sihua', label: '四化流向', hint: '四化打到哪些宮位' },
];

export default function StarfieldSection({
  starEnergy,
  readings,
  palaceCode,
  className,
}: {
  starEnergy: StarEnergyPayload | null;
  readings: PalaceReadingsPayload | null;
  palaceCode?: string | null;
  className?: string;
}) {
  const [tab, setTab] = useState<TabKey>('star');

  const available: Record<TabKey, boolean> = {
    star: !!starEnergy,
    heat: !!readings,
    chord: !!readings,
    sihua: !!readings,
  };
  if (!starEnergy && !readings) return null;

  return (
    <div className={className}>
      <header className="mb-3">
        <h2 className="font-medium text-foreground">星場分析</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          以下數值全部由排盤結果推導，每一步都可回溯到係數表——不是評語，是結構。
        </p>
      </header>

      <div
        role="tablist"
        aria-label="星場分析圖表"
        className="mb-4 flex flex-wrap gap-1.5"
      >
        {TABS.filter((t) => available[t.key]).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            title={t.hint}
            onClick={() => setTab(t.key)}
            className={[
              'min-h-[34px] rounded-lg border px-3 text-xs transition-colors',
              tab === t.key
                ? 'border-foreground bg-foreground font-semibold text-background'
                : 'border-border text-muted-foreground hover:bg-muted',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'star' && starEnergy && (
        <StarEnergyPanel payload={starEnergy} palaceCode={palaceCode ?? null} />
      )}
      {tab === 'heat' && readings && <PalaceAuxHeatmap readings={readings} />}
      {tab === 'chord' && readings && <PalaceChordDiagram readings={readings} />}
      {tab === 'sihua' && readings && <SihuaSankey readings={readings} />}
    </div>
  );
}
