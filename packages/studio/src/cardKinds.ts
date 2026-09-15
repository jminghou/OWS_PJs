'use client';

/**
 * 知識卡片類型（可設定）：後端 /studio/card-kinds 提供，這裡快取一份給所有元件用。
 * 沒載到之前先用預設五種，畫面不會閃空。
 */
import { useEffect, useState } from 'react';
import { request } from '@ows/platform-api/client';

export interface CardKindDef {
  key: string;
  label: string;
  color: CardKindColor;
  active: boolean;
  usage?: number;
}

export type CardKindColor = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'orange' | 'sky' | 'pink' | 'lime' | 'gray';

/** 徽章用的 Tailwind 類別；必須是完整字串，Tailwind 才掃得到。順序 = 色相環（暖→冷→紅紫），灰色殿後。 */
export const KIND_COLOR_CLASSES: Record<CardKindColor, { badge: string; swatch: string }> = {
  orange:  { badge: 'bg-orange-50 text-orange-700',   swatch: 'bg-orange-500' },
  amber:   { badge: 'bg-amber-50 text-amber-700',     swatch: 'bg-amber-500' },
  lime:    { badge: 'bg-lime-50 text-lime-700',       swatch: 'bg-lime-600' },
  emerald: { badge: 'bg-emerald-50 text-emerald-700', swatch: 'bg-emerald-500' },
  sky:     { badge: 'bg-sky-50 text-sky-700',         swatch: 'bg-sky-500' },
  blue:    { badge: 'bg-blue-50 text-blue-700',       swatch: 'bg-blue-500' },
  violet:  { badge: 'bg-violet-50 text-violet-700',   swatch: 'bg-violet-500' },
  pink:    { badge: 'bg-pink-50 text-pink-700',       swatch: 'bg-pink-500' },
  rose:    { badge: 'bg-rose-50 text-rose-700',       swatch: 'bg-rose-500' },
  gray:    { badge: 'bg-muted text-muted-foreground', swatch: 'bg-gray-400' },
};

/** 調色盤實際提供的顏色（少一點比較好選）；lime / pink 仍可顯示舊資料，只是不再列在選單。 */
export const PALETTE: CardKindColor[] = ['orange', 'amber', 'emerald', 'sky', 'blue', 'violet', 'rose', 'gray'];

export const DEFAULT_CARD_KINDS: CardKindDef[] = [
  { key: 'viewpoint',       label: '觀點',     color: 'blue',    active: true },
  { key: 'case',            label: '案例',     color: 'emerald', active: true },
  { key: 'research',        label: '研究資料', color: 'amber',   active: true },
  { key: 'ziwei',           label: '紫微概念', color: 'violet',  active: true },
  { key: 'brand_principle', label: '品牌原則', color: 'rose',    active: true },
];

export interface CardKindsResponse {
  kinds: CardKindDef[];
  orphans: Array<{ key: string; usage: number }>;
  colors: CardKindColor[];
}

export const cardKindApi = {
  get: () => request<CardKindsResponse>('/studio/card-kinds'),
  save: (kinds: Array<Omit<CardKindDef, 'usage'>>) =>
    request<CardKindsResponse>('/studio/card-kinds', { method: 'PUT', body: JSON.stringify({ kinds }) }),
};

// ---- 模組層快取 + 訂閱 ----
let cache: CardKindDef[] = DEFAULT_CARD_KINDS;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }

export function setCardKindsCache(kinds: CardKindDef[]) {
  cache = kinds; loaded = true; notify();
}

function ensureLoaded() {
  if (loaded || inflight) return inflight;
  inflight = cardKindApi.get()
    .then((r) => { cache = r.kinds; loaded = true; notify(); })
    .catch(() => { /* 保留預設 */ })
    .finally(() => { inflight = null; });
  return inflight;
}

/** 所有類型（含停用）。 */
export function useCardKinds(): CardKindDef[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    ensureLoaded();
    return () => { listeners.delete(l); };
  }, []);
  return cache;
}

/** 啟用中的類型（下拉選單、篩選用）。 */
export function useActiveCardKinds(): CardKindDef[] {
  return useCardKinds().filter((k) => k.active);
}

/** 查單一類型的名稱與顏色；未知的 key 回灰色並用 key 當名稱。 */
export function kindMeta(kinds: CardKindDef[], key: string): { label: string; className: string } {
  const k = kinds.find((x) => x.key === key);
  if (!k) return { label: key, className: KIND_COLOR_CLASSES.gray.badge };
  return { label: k.label, className: KIND_COLOR_CLASSES[k.color]?.badge ?? KIND_COLOR_CLASSES.gray.badge };
}
