import { columnProfileApi, type ColumnProfile } from '@/lib/api';

export const EMPTY_COLUMN_PROFILE: ColumnProfile = {
  avatar_url: '',
  links: [],
  actions: [],
  highlights: [],
  locales: {},
};

/** 專欄頁頭資料（伺服器端，ISR 60 秒；後台存檔時另有 on-demand revalidate）。取不到就用空設定，頁面退回預設文案。 */
export async function getColumnProfile(locale = 'zh-TW'): Promise<ColumnProfile> {
  return columnProfileApi
    .getProfile(locale, { next: { revalidate: 60 } })
    .then((profile) => ({ ...EMPTY_COLUMN_PROFILE, ...profile }))
    .catch(() => EMPTY_COLUMN_PROFILE);
}
