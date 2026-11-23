import type { HomepageSettings } from './types';
import { request, type FetchOptions } from './client';

export interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
  /** 訪客看得到的語言；languages 裡其餘的是「編輯中」。寫入時省略＝不改 */
  public_languages?: string[];
  /** 這個站台是否已啟用「編輯中」語言（有設定 public_languages） */
  locale_gate?: boolean;
}

export interface LocalePreviewPass {
  token: string;
  /** Unix 秒 */
  expires_at: number;
  /** null＝全部語言 */
  languages: string[] | null;
}

/** 語言預覽通行證：編輯中的語言只放行持通行證的人（core/backend_engine/blueprints/api/locale_preview.py） */
export const localePreviewApi = {
  /** 員工通行證（12 小時、全部語言） */
  pass: () => request<LocalePreviewPass>('/locale-preview/pass', { method: 'POST' }),
  /** 邀請通行證：給沒有後台帳號的翻譯／審稿人 */
  invite: (data: { languages: string[]; days: number; note?: string }) =>
    request<LocalePreviewPass>('/locale-preview/invites', { method: 'POST', body: JSON.stringify(data) }),
  /** 停用所有已發出的通行證（含自己的） */
  revokeAll: () => request<{ message: string }>('/locale-preview/revoke-all', { method: 'POST' }),
};

export const i18nApi = {
  getSettings: async (options: FetchOptions = {}): Promise<I18nSettings> => {
    return request<I18nSettings>('/settings/i18n', options);
  },

  updateSettings: async (data: I18nSettings): Promise<{ message: string }> => {
    return request<{ message: string }>('/settings/i18n', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  addLanguage: async (code: string, name: string): Promise<{
    message: string;
    languages: string[];
    language_names: Record<string, string>;
  }> => {
    return request<{
      message: string;
      languages: string[];
      language_names: Record<string, string>;
    }>('/settings/i18n/languages', {
      method: 'POST',
      body: JSON.stringify({ code, name }),
    });
  },

  removeLanguage: async (code: string): Promise<{
    message: string;
    languages: string[];
    language_names: Record<string, string>;
  }> => {
    return request<{
      message: string;
      languages: string[];
      language_names: Record<string, string>;
    }>(`/settings/i18n/languages/${code}`, {
      method: 'DELETE',
    });
  },
};

export const homepageApi = {
  getAdminSettings: async (): Promise<HomepageSettings> => request<HomepageSettings>('/settings/homepage/admin', { cache: 'no-store' }),
  getSettings: async (options: FetchOptions = {}): Promise<HomepageSettings> => {
    return request<HomepageSettings>('/settings/homepage', options);
  },

  updateSettings: async (data: Partial<HomepageSettings>): Promise<{ message: string }> => {
    return request<{ message: string }>('/settings/homepage', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ── 專欄頁頁頭（core: /settings/column-profile）────────────────────────────
// 型別放這裡而非 @ows/ui/types：後者因 Claire 依賴而凍結（docs/FROZEN_CONTRACT.md）。

export interface ColumnProfileLink {
  label: string;
  url: string;
}

export interface ColumnProfileFields {
  name?: string;
  subtitle?: string;
  bio?: string;
}

/** 精選標籤圓圈。後台存 tag_id；公開端另外補上 code（篩選用）與當前語系的 name。 */
export interface ColumnHighlight {
  tag_id: number;
  image_url: string;
  code?: string;
  name?: string;
}

export interface ColumnProfile {
  avatar_url: string;
  links: ColumnProfileLink[];
  actions: ColumnProfileLink[];
  highlights: ColumnHighlight[];
  locales: Record<string, ColumnProfileFields>;
}

export const columnProfileApi = {
  getProfile: async (language?: string, options: FetchOptions = {}): Promise<ColumnProfile> =>
    request<ColumnProfile>('/settings/column-profile', { params: language ? { language } : {}, ...options }),

  getAdminProfile: async (): Promise<ColumnProfile> =>
    request<ColumnProfile>('/settings/column-profile/admin', { cache: 'no-store' }),

  updateProfile: async (data: ColumnProfile): Promise<{ message: string; column_profile: ColumnProfile }> =>
    request<{ message: string; column_profile: ColumnProfile }>('/settings/column-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// 已移除（P2 契約比對）：homepageApi.uploadSlideImage 打的
// POST /settings/homepage/upload 在 core 不存在，兩站也沒有呼叫。
// 幻燈片圖片實際走的是媒體庫（/media-lib/files）。
