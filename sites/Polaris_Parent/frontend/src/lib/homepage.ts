import { homepageApi } from '@/lib/api';
import type { HomepageSettings } from '@/types';

/** 預設語系與各語系首頁共用的資料來源。ISR 與頁面的 revalidate 一致；後台存檔時另有 on-demand revalidate。 */
export async function getHomepageSettings(): Promise<HomepageSettings> {
  return homepageApi.getSettings({ next: { revalidate: 60 } })
    .catch(() => ({ slides: [], button_text: {}, updated_at: '' }));
}
