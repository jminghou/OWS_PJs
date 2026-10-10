/**
 * 客製報告的售價：伺服器端與瀏覽器端皆可用。
 * - 數位版：讀商品後台（shop.products 的 natal-report-digital）
 * - 實體書：讀後端的實體書設定（/report-physical-config；後台「實體書設定」分頁），
 *   實體書＝第一本（含規格）＋第二本起×數量＋特殊客製。這裡的 physical 是「數位版＋一本最便宜規格」的起價。
 * 這裡只供顯示；實際金額以後端建單時計算的為準（extensions/report_orders/physical.py）。
 */
import { productApi, reportOrdersApi } from '@/lib/api';
import type { PhysicalConfig } from '@/lib/api/reportOrders';
import type { ReportVariant } from './catalog';

export type PriceLabel = { text: string; available: boolean; amount: number | null };
export type ReportPrices = Record<ReportVariant, PriceLabel> & { symbol: string; physicalConfig: PhysicalConfig | null };

const UNAVAILABLE: PriceLabel = { text: '價格即將公布', available: false, amount: null };

export const formatPrice = (amount: number, symbol = 'NT$') => `${symbol}${amount.toLocaleString('zh-TW')}`;

const label = (amount: number, symbol: string): PriceLabel => ({ text: formatPrice(amount, symbol), available: true, amount });

/** 實體書與專人解讀設定；兩者都沒開放或 API 失敗時回 null（實體書是否開放看 cfg.enabled） */
export async function loadPhysicalConfig(): Promise<PhysicalConfig | null> {
  try {
    const { config } = await reportOrdersApi.physicalConfig();
    return config && (config.enabled || config.consult) ? config : null;
  } catch {
    return null;
  }
}

/** 一本實體書（不含數位版）的最低價：第一本＋最便宜的規格 */
export function physicalStartPrice(cfg: PhysicalConfig): number {
  const minDelta = cfg.specs.length ? Math.min(...cfg.specs.map((s) => s.price_delta)) : 0;
  return cfg.first_copy_price + minDelta;
}

export async function loadReportPrices(): Promise<ReportPrices> {
  let symbol = 'NT$';
  let digital: PriceLabel = UNAVAILABLE;
  const [digitalRes, physicalConfig] = await Promise.all([
    productApi.getById('natal-report-digital', 'zh-TW', 'TWD').catch(() => null),
    loadPhysicalConfig(),
  ]);
  const p: any = digitalRes;
  if (typeof p?.price === 'number') {
    if (p.currency_symbol) symbol = p.currency_symbol;
    digital = label(p.price, symbol);
  }
  const physical = physicalConfig?.enabled && digital.amount != null
    ? label(digital.amount + physicalStartPrice(physicalConfig), symbol)
    : UNAVAILABLE;
  return { digital, physical, symbol, physicalConfig };
}

/** 加購實體書的起價（不含數位版）；沒開放實體書就顯示「價格即將公布」且 available=false */
export function addonPrice(prices: ReportPrices): PriceLabel {
  const cfg = prices.physicalConfig;
  if (!cfg || !prices.physical.available) return UNAVAILABLE;
  const start = physicalStartPrice(cfg);
  const varies = cfg.specs.some((s) => s.price_delta !== cfg.specs[0].price_delta);
  return { text: `+${formatPrice(start, prices.symbol)}${varies ? ' 起' : ''}`, available: true, amount: start };
}
