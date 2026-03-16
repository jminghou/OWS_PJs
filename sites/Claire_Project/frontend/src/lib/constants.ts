export type LanguageRegion = 'chinese' | 'asia' | 'americas' | 'europe';

export interface LanguageDefinition {
  code: string;
  name: string;
  flag?: string;
  region: LanguageRegion;
}

export const LANGUAGE_REGION_LABELS: Record<LanguageRegion, string> = {
  chinese:  '華語',
  asia:     '亞洲',
  americas: '美洲',
  europe:   '歐洲',
};

export const LANGUAGE_REGION_ORDER: LanguageRegion[] = ['chinese', 'asia', 'americas', 'europe'];

export const SUPPORTED_LANGUAGES: LanguageDefinition[] = [
  // ── 華語 ──────────────────────────────────────────────
  { code: 'zh-TW', name: '繁體中文（台灣）', flag: '🇹🇼', region: 'chinese' },
  { code: 'zh-HK', name: '繁體中文（港澳）', flag: '🇭🇰', region: 'chinese' },
  { code: 'zh-CN', name: '簡體中文',        flag: '🇨🇳', region: 'chinese' },

  // ── 亞洲 ──────────────────────────────────────────────
  { code: 'ja',    name: '日本語',           flag: '🇯🇵', region: 'asia' },
  { code: 'ko',    name: '한국어',           flag: '🇰🇷', region: 'asia' },
  { code: 'th',    name: 'ภาษาไทย',         flag: '🇹🇭', region: 'asia' },
  { code: 'vi',    name: 'Tiếng Việt',      flag: '🇻🇳', region: 'asia' },
  { code: 'ar',    name: 'العربية',          flag: '🇸🇦', region: 'asia' },
  { code: 'ru',    name: 'Русский',         flag: '🇷🇺', region: 'asia' },

  // ── 美洲 ──────────────────────────────────────────────
  { code: 'en',    name: 'English',         flag: '🇺🇸', region: 'americas' },

  // ── 歐洲 ──────────────────────────────────────────────
  { code: 'es',    name: 'Español',         flag: '🇪🇸', region: 'europe' },
  { code: 'fr',    name: 'Français',        flag: '🇫🇷', region: 'europe' },
  { code: 'de',    name: 'Deutsch',         flag: '🇩🇪', region: 'europe' },
  { code: 'sv',    name: 'Svenska',         flag: '🇸🇪', region: 'europe' },
  { code: 'no',    name: 'Norsk',           flag: '🇳🇴', region: 'europe' },
  { code: 'da',    name: 'Dansk',           flag: '🇩🇰', region: 'europe' },
];

export const DEFAULT_LANGUAGE = 'zh-TW';


