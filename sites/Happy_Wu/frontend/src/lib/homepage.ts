import { contentApi, homepageApi } from '@/lib/api';
import type { Content, HomepageSettings } from '@/types';

/** One data path for the default and translated homepages. */
export async function getHomePageData(locale: string) {
  const homepageSettings: HomepageSettings = await homepageApi.getSettings({ cache: 'no-store' })
    .catch(() => ({ slides: [], button_text: {}, updated_at: '' }));
  const wall = homepageSettings.article_wall;
  let latestPosts: Content[] = [];
  if (wall?.mode === 'manual') {
    if (wall.article_ids.length) {
      const response = await contentApi.getList({ ids: wall.article_ids.join(','), status: 'published', type: 'article', per_page: 24, language: locale }, { cache: 'no-store' }).catch(() => ({ contents: [] }));
      const byId = new Map(response.contents.map(post => [post.id, post]));
      latestPosts = wall.article_ids.flatMap(id => {
        const post = byId.get(id);
        if (!post || post.status !== 'published' || (post.language || 'zh-TW') !== locale ||
            (post.published_at && new Date(post.published_at).getTime() > Date.now())) return [];
        return [post];
      });
    }
  } else {
    latestPosts = await contentApi.getList({ status: 'published', type: 'article', per_page: 12, language: locale }, { cache: 'no-store' })
      .then(response => response.contents).catch(() => []);
  }
  return { homepageSettings, latestPosts };
}
