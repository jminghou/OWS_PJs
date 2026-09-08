import type { HomepageSettings } from './types';
import { request, type FetchOptions } from './client';

export interface I18nSettings {
  enabled: boolean;
  default_language: string;
  languages: string[];
  language_names: Record<string, string>;
}

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

// 已移除（P2 契約比對）：homepageApi.uploadSlideImage 打的
// POST /settings/homepage/upload 在 core 不存在，兩站也沒有呼叫。
// 幻燈片圖片實際走的是媒體庫（/media-lib/files）。
