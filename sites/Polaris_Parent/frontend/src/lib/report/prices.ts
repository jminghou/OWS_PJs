/**
 * 客製報告各版本的售價：向商品後台（shop.products）讀取，伺服器端與瀏覽器端皆可用。
 * 這裡只供顯示；實際金額以後端建單時讀到的價格為準（extensions/report_orders/service.py）。
 */
import { productApi } from '@/lib/api';
import { REPORT_VARIANTS, type ReportVariant } from './catalog';

export type PriceLabel = { text: string; available: boolean; amount: number | null };
export type ReportPrices = Record<ReportVariant, PriceLabel> & { symbol: string };

const UNAVAILABLE: PriceLabel = { text: '價格即將公布', available: false, amount: null };

export const formatPrice = (amount: number, symbol = 'NT$') => `${symbol}${amount.toLocaleString('zh-TW')}`;

export async function loadReportPrices(): Promise<ReportPrices> {
  let symbol = 'NT$';
  const entries = await Promise.all(
    REPORT_VARIANTS.map(async (v) => {
      try {
        const p: any = await productApi.getById(v.productId, 'zh-TW', 'TWD');
        if (typeof p?.price === 'number') {
          if (p.currency_symbol) symbol = p.currency_symbol;
          return [v.variant, { text: formatPrice(p.price, p.currency_symbol || 'NT$'), available: true, amount: p.price }];
        }
      } catch {
        /* 後台尚未建立此商品 */
      }
      return [v.variant, UNAVAILABLE];
    })
  );
  return { ...(Object.fromEntries(entries) as Record<ReportVariant, PriceLabel>), symbol };
}

/** 加購實體書的價差（physical − digital）；任一版本沒有價格就顯示「價格即將公布」 */
export function addonPrice(prices: ReportPrices): PriceLabel {
  const d = prices.digital.amount;
  const p = prices.physical.amount;
  if (d == null || p == null) return UNAVAILABLE;
  return { text: `+${formatPrice(p - d, prices.symbol)}`, available: true, amount: p - d };
}
