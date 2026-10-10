'use client';

/**
 * 實體書與專人解讀的下單選項（預覽頁的「實體書版」與訂單頁的「加購」共用）：
 *   一、規格（必選；加減價只影響第一本）  二、數量（第一本／第二本起）
 *   三、特殊客製（選填，預設收合；一張訂單收一次）  四、專人解讀（ConsultOption）
 * 選項與價格來自後台「實體書設定」；實際金額以後端建單時計算的為準。
 */
import { useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import type { CustomKey, PhysicalConfig, PhysicalSelection, PriceLine } from '@/lib/api/reportOrders';
import { formatPrice } from '@/lib/report/prices';

export const defaultSelection = (cfg: PhysicalConfig | null): PhysicalSelection => ({
  spec_key: cfg?.specs.find((s) => s.price_delta === 0)?.key ?? cfg?.specs[0]?.key ?? null,
  quantity: 1,
  custom: [],
  spreads: 0,
});

/** 選擇是否仍有效（後台改了規格或關掉某個選項時，舊草稿的選擇可能已不存在） */
export function normaliseSelection(cfg: PhysicalConfig, sel: PhysicalSelection | undefined | null): PhysicalSelection {
  const base = defaultSelection(cfg);
  if (!sel) return base;
  const specOk = !cfg.specs.length || cfg.specs.some((s) => s.key === sel.spec_key);
  const keys = new Set(cfg.custom_options.map((o) => o.key));
  return {
    spec_key: specOk ? sel.spec_key ?? base.spec_key : base.spec_key,
    quantity: Math.min(Math.max(1, sel.quantity ?? 1), cfg.max_quantity),
    custom: (sel.custom ?? []).filter((k) => keys.has(k)),
    spreads: cfg.spreads ? Math.min(Math.max(0, sel.spreads ?? 0), cfg.spreads.max) : 0,
  };
}

const sym = (n: number, symbol: string) => (n < 0 ? `−${formatPrice(-n, symbol)}` : formatPrice(n, symbol));

export function Stepper({ value, min, max, onChange, label, unit }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string; unit: string;
}) {
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-white text-ink transition-colors hover:border-blue-500 disabled:opacity-30 disabled:hover:border-line-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100';
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`減少${label}`}>
        <Minus className="h-4 w-4" strokeWidth={2} />
      </button>
      <span className="min-w-[3.5rem] text-center font-latin text-lg font-bold text-ink" aria-live="polite">
        {value} <span className="font-body text-sm font-normal text-text">{unit}</span>
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`增加${label}`}>
        <Plus className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

const optionCls = (on: boolean) =>
  `flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-inner border-[1.5px] px-4 py-3 text-sm transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-100 ${on ? 'border-blue-500 bg-blue-50' : 'border-line bg-white hover:border-blue-500'}`;
const titleCls = 'font-heading text-[17px] font-normal text-ink';

export default function PhysicalOptions({ cfg, value, onChange, symbol = 'NT$' }: {
  cfg: PhysicalConfig;
  value: PhysicalSelection;
  onChange: (v: PhysicalSelection) => void;
  symbol?: string;
}) {
  const custom = value.custom ?? [];
  const spreads = value.spreads ?? 0;
  const hasCustomChoices = cfg.custom_options.length > 0 || !!cfg.spreads;
  const [open, setOpen] = useState(custom.length > 0 || spreads > 0);
  const spec = cfg.specs.find((s) => s.key === value.spec_key);
  const firstCopy = cfg.first_copy_price + (spec?.price_delta ?? 0);
  const customTotal = custom.reduce((a, k) => a + (cfg.custom_options.find((o) => o.key === k)?.price ?? 0), 0)
    + spreads * (cfg.spreads?.price ?? 0);
  const toggle = (k: CustomKey, on: boolean) =>
    onChange({ ...value, custom: on ? [...custom, k] : custom.filter((x) => x !== k) });

  return (
    <div className="space-y-7">
      {cfg.specs.length > 0 && (
        <fieldset>
          <legend className={titleCls}>選擇規格</legend>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {cfg.specs.map((s) => (
              <label key={s.key} className={optionCls(value.spec_key === s.key)}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="physical-spec" className="h-4 w-4 accent-blue-500" checked={value.spec_key === s.key}
                    onChange={() => onChange({ ...value, spec_key: s.key })} />
                  <span className="font-medium text-ink">{s.label}</span>
                </span>
                <span className="font-latin text-text">{s.price_delta ? sym(s.price_delta, symbol) : '原價'}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <p className={titleCls}>數量</p>
        <p className="mt-1 text-sm text-text">
          第一本 {formatPrice(firstCopy, symbol)}，第二本起每本 {formatPrice(cfg.extra_copy_price, symbol)}（含運費）。每本內容相同，寄到同一個地址。
        </p>
        <div className="mt-3">
          <Stepper value={value.quantity ?? 1} min={1} max={cfg.max_quantity} label="數量" unit="本"
            onChange={(v) => onChange({ ...value, quantity: v })} />
        </div>
      </div>

      {hasCustomChoices && (
        <div className="rounded-inner border-[1.5px] border-line bg-white">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 rounded-inner">
            <span className="flex-1">
              <span className={`block ${titleCls}`}>特殊客製（選填）</span>
              <span className="block text-sm text-text">需要自己的封面、改寫文字、放指定圖片或頁面時再展開；一張訂單只收一次。</span>
            </span>
            {customTotal > 0 && <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 font-latin text-sm text-blue-700">+{formatPrice(customTotal, symbol)}</span>}
            <ChevronDown className={`h-5 w-5 shrink-0 text-text transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {open && (
            <div className="space-y-2 border-t border-line p-3">
              {cfg.custom_options.map((o) => {
                const on = custom.includes(o.key);
                return (
                  <label key={o.key} className={`${optionCls(on)} items-start`}>
                    <span className="flex items-start gap-3">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-500" checked={on}
                        onChange={(e) => toggle(o.key, e.target.checked)} />
                      <span>
                        <span className="block font-medium text-ink">{o.label}</span>
                        <span className="block text-caption text-text">{o.note}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-latin text-text">+{formatPrice(o.price, symbol)}</span>
                  </label>
                );
              })}
              {cfg.spreads && (
                <div className={`${optionCls(spreads > 0)} flex-wrap cursor-default`}>
                  <span>
                    <span className="block font-medium text-ink">{cfg.spreads.label}</span>
                    <span className="block text-caption text-text">每一個跨頁 +{formatPrice(cfg.spreads.price, symbol)}；之後在書裡選位置、放照片和文字。</span>
                  </span>
                  <Stepper value={spreads} min={0} max={cfg.spreads.max} label="跨頁數" unit="跨頁"
                    onChange={(v) => onChange({ ...value, spreads: v })} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 專人解讀：次數選擇 */
export function ConsultOption({ cfg, value, onChange, symbol = 'NT$' }: {
  cfg: PhysicalConfig; value: number; onChange: (v: number) => void; symbol?: string;
}) {
  if (!cfg.consult) return null;
  return (
    <div>
      <p className={titleCls}>{cfg.consult.label}（選填）</p>
      <p className="mt-1 text-sm text-text">
        由專人陪你一起讀這份報告，每次 {cfg.consult.minutes} 分鐘 {formatPrice(cfg.consult.price, symbol)}。付款後我們以 Email 或電話跟你約時間。
      </p>
      <div className="mt-3">
        <Stepper value={value} min={0} max={cfg.consult.max_sessions} label="解讀次數" unit="次" onChange={onChange} />
      </div>
    </div>
  );
}

/** 金額明細 */
export function PriceBreakdown({ lines, total, symbol = 'NT$', totalLabel = '合計（含運費）' }: {
  lines: PriceLine[]; total: number; symbol?: string; totalLabel?: string;
}) {
  return (
    <dl className="text-sm">
      {lines.map((l, i) => (
        <div key={i} className="flex justify-between gap-4 py-1.5">
          <dt className="text-text">{l.label}</dt>
          <dd className="font-latin text-ink">{sym(l.amount, symbol)}</dd>
        </div>
      ))}
      <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
        <dt className="font-bold text-ink">{totalLabel}</dt>
        <dd className="font-latin text-[22px] font-extrabold text-ink">{formatPrice(total, symbol)}</dd>
      </div>
    </dl>
  );
}
