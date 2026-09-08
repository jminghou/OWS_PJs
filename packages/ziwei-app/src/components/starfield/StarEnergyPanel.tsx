'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StarEnergyCard, StarEnergyPayload } from '../../api/astrology';
import StarEnergyWaterfall from './StarEnergyWaterfall';

/**
 * 星曜能量面板：左側依 E 排序的橫條清單，點任一顆 → 右側出該星的 E 組成瀑布圖。
 *
 * 資料來自 /astrology/calculate 的 `star_energy`（需 include_star_energy: true），
 * 全部在排盤那一次請求裡算完（實測 <1 ms），所以點星曜是純查表，不打 API。
 *
 * 與互動命盤連動：`@ows/ziwei-chart` 的 `onPalaceClick` 給的是宮位代碼（1…C），
 * 把它傳進 `palaceCode` 即可把清單收斂到該宮，並自動選中該宮最強的一顆。
 * （該套件目前沒有星曜級的點擊事件，宮位級是現成能用的最細粒度。）
 */

type Group = 'all' | 'major' | 'aux';

const GROUP_TABS: { key: Group; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'major', label: '主星' },
  { key: 'aux', label: '輔星' },
];

interface Props {
  payload: StarEnergyPayload | null;
  /** 由命盤 onPalaceClick 傳入的宮位代碼（1…C）；null＝不過濾。 */
  palaceCode?: string | null;
  defaultGroup?: Group;
  className?: string;
}

export default function StarEnergyPanel({
  payload,
  palaceCode = null,
  defaultGroup = 'all',
  className,
}: Props) {
  const [group, setGroup] = useState<Group>(defaultGroup);
  const [selected, setSelected] = useState<string | null>(null);

  /** payload 為 null 時的空陣列要記憶化，否則每次 render 都是新參考，
   *  下面所有 useMemo/useEffect 的相依都會被判定為變動。 */
  const all = useMemo(() => payload?.stars ?? [], [payload]);

  /** 條長一律以全盤最大 E 為基準——切換篩選時不重新縮放，跨群組才可比。 */
  const maxE = useMemo(() => Math.max(...all.map((s) => s.e), 0.0001), [all]);

  const list = useMemo(() => {
    let rows = all;
    if (palaceCode) rows = rows.filter((s) => s.palace_code === palaceCode);
    if (group !== 'all') rows = rows.filter((s) => s.group === group);
    return rows;
  }, [all, group, palaceCode]);

  /** 選取跟著清單走：目前這顆被篩掉時，改選清單裡最強的一顆。 */
  useEffect(() => {
    if (!list.length) {
      setSelected(null);
      return;
    }
    if (!selected || !list.some((s) => s.code === selected)) {
      setSelected(list[0].code);
    }
  }, [list, selected]);

  const current: StarEnergyCard | null =
    list.find((s) => s.code === selected) ?? list[0] ?? null;

  if (!payload) return null;

  const palaceName = palaceCode ? all.find((s) => s.palace_code === palaceCode)?.palace : null;

  return (
    <section className={className}>
      <header className="mb-3">
        <h2 className="text-base font-semibold text-foreground">星曜能量</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          E ＝ 該星的出廠強度，由亮度、同宮輔星的影響加成、空劫衰減三者相乘而得。
          點任一顆星看它的 E 是怎麼算出來的。
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {GROUP_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setGroup(t.key)}
              aria-pressed={group === t.key}
              className={[
                'min-h-[32px] px-3 text-xs transition-colors',
                'border-l border-border first:border-l-0',
                group === t.key
                  ? 'bg-foreground font-semibold text-background'
                  : 'text-muted-foreground hover:bg-muted',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        {palaceName && (
          <span className="text-xs text-muted-foreground">
            已收斂至 <b className="font-semibold text-foreground">{palaceName}</b>（{list.length} 顆）
          </span>
        )}
        <span className="flex-1" />
        <Legend />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
        <ul className="space-y-0.5" role="listbox" aria-label="星曜能量排序">
          {list.map((s) => (
            <li key={s.code}>
              <button
                type="button"
                role="option"
                aria-selected={current?.code === s.code}
                onClick={() => setSelected(s.code)}
                className={[
                  'grid w-full grid-cols-[56px_1fr_44px] items-center gap-2 rounded-md px-1 py-1 text-left transition-colors',
                  current?.code === s.code ? 'bg-muted' : 'hover:bg-muted/60',
                ].join(' ')}
              >
                <span
                  className={[
                    'truncate text-right text-xs',
                    current?.code === s.code ? 'font-semibold text-foreground' : 'text-foreground',
                  ].join(' ')}
                >
                  {s.name}
                </span>
                <span className="relative h-[15px]">
                  <span
                    className="absolute left-0 top-0 h-[15px] rounded-r"
                    style={{
                      width: `${(s.e / maxE) * 100}%`,
                      background:
                        s.group === 'major'
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--muted-foreground))',
                      opacity: s.group === 'major' ? 0.9 : 0.55,
                    }}
                  />
                </span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">
                  {s.e.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
          {!list.length && (
            <li className="py-6 text-center text-xs text-muted-foreground">此範圍沒有星曜</li>
          )}
        </ul>

        {current && <StarEnergyWaterfall star={current} className="lg:sticky lg:top-4" />}
      </div>

      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        E 是「出廠強度」，不等於它在某個宮的影響力——後者還要乘上該宮的取樣權重。
        四化不乘進 E；它在這條鏈上唯一的作用是讓帶四化的星豁免空劫，因此顯示在「空劫」那一步。
      </p>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 flex-none rounded-sm"
          style={{ background: 'hsl(var(--primary))', opacity: 0.9 }}
        />
        主星
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 flex-none rounded-sm"
          style={{ background: 'hsl(var(--muted-foreground))', opacity: 0.55 }}
        />
        輔星
      </span>
    </div>
  );
}
