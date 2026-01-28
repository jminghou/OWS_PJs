/**
 * 幣值相關工具函數
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
  TWD: 'NT$',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
  CNY: '¥',
  HKD: 'HK$',
  SGD: 'S$',
};

export const CURRENCY_NAMES: Record<string, Record<string, string>> = {
  TWD: { 'zh-TW': '新台幣', en: 'TWD', ja: '台湾ドル' },
  USD: { 'zh-TW': '美元', en: 'USD', ja: '米ドル' },
  EUR: { 'zh-TW': '歐元', en: 'EUR', ja: 'ユーロ' },
  JPY: { 'zh-TW': '日圓', en: 'JPY', ja: '日本円' },
  GBP: { 'zh-TW': '英鎊', en: 'GBP', ja: 'ポンド' },
  CNY: { 'zh-TW': '人民幣', en: 'CNY', ja: '人民元' },
  HKD: { 'zh-TW': '港幣', en: 'HKD', ja: '香港ドル' },
  SGD: { 'zh-TW': '新加坡幣', en: 'SGD', ja: 'シンガポールドル' },
};

/**
 * 格式化價格顯示
 * @param price - 價格金額
 * @param currency - 幣值代碼 (TWD, USD, etc.)
 * @param locale - 語言地區 (zh-TW, en, ja, etc.)
 * @returns 格式化的價格字串 (例: "NT$ 1,200")
 */
export function formatPrice(
  price: number,
  currency: string = 'TWD',
  locale: string = 'zh-TW'
): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  // 根據幣值決定小數位數
  // JPY, TWD, KRW 等通常不使用小數
  const decimals = ['JPY', 'TWD', 'KRW'].includes(currency) ? 0 : 2;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);

  return `${symbol} ${formatted}`;
}

/**
 * 獲取幣值符號
 * @param currency - 幣值代碼
 * @returns 幣值符號
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * 獲取幣值名稱
 * @param currency - 幣值代碼
 * @param language - 語言代碼
 * @returns 幣值名稱
 */
export function getCurrencyName(currency: string, language: string = 'zh-TW'): string {
  return CURRENCY_NAMES[currency]?.[language] || currency;
}

/**
 * 獲取所有支援的幣值列表
 * @returns 幣值代碼陣列
 */
export function getSupportedCurrencies(): string[] {
  return Object.keys(CURRENCY_SYMBOLS);
}

/**
 * 檢查幣值是否有效
 * @param currency - 幣值代碼
 * @returns 是否有效
 */
export function isValidCurrency(currency: string): boolean {
  return currency in CURRENCY_SYMBOLS;
}
