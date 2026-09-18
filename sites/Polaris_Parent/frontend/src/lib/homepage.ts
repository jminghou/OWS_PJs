import { contentApi, homepageApi } from '@/lib/api';
import type { Content, HomepageSettings } from '@/types';

// 文字清單式首頁：少量精選。後台選「最新」時取這麼多篇；「手動」則照後台挑的篇數與順序。
const LATEST_COUNT = 6;
// ISR：與頁面的 revalidate 一致；後台存檔時另有 on-demand revalidate
const FETCH_OPTIONS = { next: { revalidate: 60 } };

/** 預設語系與各語系首頁共用的資料來源。 */
export async function getHomePageData(locale: string) {
  const homepageSettings: HomepageSettings = await homepageApi.getSettings(FETCH_OPTIONS)
    .catch(() => ({ slides: [], button_text: {}, updated_at: '' }));
  const wall = homepageSettings.article_wall;
  let articles: Content[] = [];
  if (wall?.mode === 'manual') {
    if (wall.article_ids.length) {
      const response = await contentApi
        .getList({ ids: wall.article_ids.join(','), status: 'published', type: 'article', per_page: 24, language: locale }, FETCH_OPTIONS)
        .catch(() => ({ contents: [] as Content[] }));
      const byId = new Map(response.contents.map((post) => [post.id, post]));
      // 照後台存的順序排；已下架、語系不符、排程未到的文章不顯示
      articles = wall.article_ids.flatMap((id) => {
        const post = byId.get(id);
        if (!post || post.status !== 'published' || (post.language || 'zh-TW') !== locale ||
            (post.published_at && new Date(post.published_at).getTime() > Date.now())) return [];
        return [post];
      });
    }
  } else {
    articles = await contentApi
      .getList({ status: 'published', type: 'article', per_page: LATEST_COUNT, language: locale }, FETCH_OPTIONS)
      .then((response) => response.contents)
      .catch(() => []);
  }
  return { homepageSettings, articles };
}
