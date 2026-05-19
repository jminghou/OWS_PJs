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

export function formatPrice(
  price: number,
  currency: string = 'TWD',
  locale: string = 'zh-TW'
): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const decimals = ['JPY', 'TWD', 'KRW'].includes(currency) ? 0 : 2;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
  return `${symbol} ${formatted}`;
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function getCurrencyName(currency: string, language: string = 'zh-TW'): string {
  return CURRENCY_NAMES[currency]?.[language] || currency;
}

export function getSupportedCurrencies(): string[] {
  return Object.keys(CURRENCY_SYMBOLS);
}

export function isValidCurrency(currency: string): boolean {
  return currency in CURRENCY_SYMBOLS;
}
