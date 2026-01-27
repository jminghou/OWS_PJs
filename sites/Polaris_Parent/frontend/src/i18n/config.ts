// i18n 配置
export const locales = ['zh-TW', 'zh-CN', 'en', 'ja'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-TW';

// 語言顯示名稱
export const localeNames: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  'en': 'English',
  'ja': '日本語',
};

// 語言標籤（用於 HTML lang 屬性）
export const localeLabels: Record<Locale, string> = {
  'zh-TW': 'zh-Hant-TW',
  'zh-CN': 'zh-Hans-CN',
  'en': 'en',
  'ja': 'ja',
};
