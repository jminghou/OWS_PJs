import { request } from '@/lib/api';
import { defaultLocale, isLocale } from '@/i18n/config';

interface I18nPublic {
  enabled: boolean;
  languages: string[];
  public_languages?: string[];
}

/**
 * 訪客看得到的語言（伺服器端，5 分鐘快取）。hreflang、noindex 判斷用。
 * 查不到時只回預設語言：寧可少宣告，也不要把編輯中的語言曝光給搜尋引擎。
 */
export async function getPublicLocales(): Promise<string[]> {
  try {
    const s = await request<I18nPublic>('/settings/i18n', { next: { revalidate: 300 } });
    const list = s.public_languages ?? (s.enabled ? s.languages : []);
    return [defaultLocale, ...list.filter((l) => isLocale(l) && l !== defaultLocale)];
  } catch {
    return [defaultLocale];
  }
}
