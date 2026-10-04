/**
 * 客製報告各版本的售價：向商品後台（shop.products）讀取，伺服器端與瀏覽器端皆可用。
 * 這裡只供顯示；實際金額以後端建單時讀到的價格為準（extensions/report_orders/service.py）。
 */
import { productApi } from '@/lib/api';
import { REPORT_VARIANTS, type ReportVariant } from './catalog';

export type PriceLabel = { text: string; available: boolean };
export type ReportPrices = Record<ReportVariant, PriceLabel>;

export async function loadReportPrices(): Promise<ReportPrices> {
  const entries = await Promise.all(
    REPORT_VARIANTS.map(async (v) => {
      try {
        const p: any = await productApi.getById(v.productId, 'zh-TW', 'TWD');
        if (typeof p?.price === 'number') {
          return [v.variant, { text: `${p.currency_symbol || 'NT$'}${p.price.toLocaleString('zh-TW')}`, available: true }];
        }
      } catch {
        /* 後台尚未建立此商品 */
      }
      return [v.variant, { text: '價格即將公布', available: false }];
    })
  );
  return Object.fromEntries(entries) as ReportPrices;
}
