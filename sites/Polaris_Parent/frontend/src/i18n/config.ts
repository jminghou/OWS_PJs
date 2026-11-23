// i18n 配置：前台語系的單一來源（middleware、[locale] layout、頁首頁尾、siteConfig 都從這裡讀）。
// 列在這裡＝網站有這個語系的頁面；訪客看不看得到由後台「語系設定」決定，
// 編輯中的語言只放行持語言預覽通行證的人（middleware.ts）。
export const locales = ['zh-TW', 'zh-CN', 'en', 'ja', 'es', 'no', 'ko'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-TW';

export const isLocale = (v: unknown): v is Locale => locales.includes(v as Locale);

// 語言顯示名稱
export const localeNames: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  'en': 'English',
  'ja': '日本語',
  'es': 'Español',
  'no': 'Norsk',
  'ko': '한국어',
};

// 語言標籤（用於 HTML lang 屬性）
export const localeLabels: Record<Locale, string> = {
  'zh-TW': 'zh-Hant-TW',
  'zh-CN': 'zh-Hans-CN',
  'en': 'en',
  'ja': 'ja',
  'es': 'es',
  'no': 'nb',
  'ko': 'ko',
};
