/**
 * 金額顯示（多幣別，2026-10-20）。與後端 extensions/report_orders/money.py 的 CURRENCIES 同步：
 * 金額一律是「最小單位」整數——台幣、日圓是元，美金、歐元、挪威克朗等是分。
 * 例：formatMoney(1980, 'TWD') → NT$1,980；formatMoney(4999, 'USD') → US$49.99。
 */

export const CURRENCIES: Record<string, { exponent: number; symbol: string; label: string }> = {
  TWD: { exponent: 0, symbol: 'NT$', label: '新台幣' },
  USD: { exponent: 2, symbol: 'US$', label: '美元' },
  EUR: { exponent: 2, symbol: '€', label: '歐元' },
  GBP: { exponent: 2, symbol: '£', label: '英鎊' },
  NOK: { exponent: 2, symbol: 'NOK ', label: '挪威克朗' },
  SEK: { exponent: 2, symbol: 'SEK ', label: '瑞典克朗' },
  DKK: { exponent: 2, symbol: 'DKK ', label: '丹麥克朗' },
  CNY: { exponent: 2, symbol: 'CN¥', label: '人民幣' },
  HKD: { exponent: 2, symbol: 'HK$', label: '港幣' },
  JPY: { exponent: 0, symbol: '¥', label: '日圓' },
  AUD: { exponent: 2, symbol: 'A$', label: '澳幣' },
  CAD: { exponent: 2, symbol: 'C$', label: '加幣' },
};

/** 最小單位整數 → 顯示字串。null／undefined 顯示「—」；不認得的幣別顯示代碼。 */
export function formatMoney(minor: number | null | undefined, currency: string = 'TWD'): string {
  if (minor == null) return '—';
  const c = CURRENCIES[currency];
  if (!c) return `${currency} ${minor.toLocaleString('en-US')}`;
  const value = minor / 10 ** c.exponent;
  const text = value.toLocaleString('en-US', { minimumFractionDigits: c.exponent, maximumFractionDigits: c.exponent });
  return value < 0 ? `−${c.symbol}${text.replace('-', '')}` : `${c.symbol}${text}`;
}
