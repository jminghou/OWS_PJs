export interface LanguageDefinition {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: LanguageDefinition[] = [
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'zh-CN', name: '簡體中文' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'no', name: 'Norsk' },
  { code: 'ja', name: '日本語' },
  { code: 'vi', name: 'Tiếng Việt' },
];

export const DEFAULT_LANGUAGE = 'zh-TW';


