import { contentApi } from '@/lib/api';
import type { Content } from '@/types';

/**
 * 取得相關文章（伺服器端，供 SSR）。
 * 策略：① 同分類的已發佈文章優先；② 不足則補最新文章。去重並排除自己。
 * 推薦會進入初始 HTML，利於 AI/搜尋抓取，也建立站內主題叢集連結。
 */
export async function getRelatedPosts(post: Content, limit = 4): Promise<Content[]> {
  const language = post.language || 'zh-TW';
  const collected: Content[] = [];
  const seen = new Set<number>([post.id]);

  const pushUnique = (items: Content[]) => {
    for (const c of items) {
      if (collected.length >= limit) break;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      collected.push(c);
    }
  };

  // 1. 同分類
  if (post.category?.id) {
    try {
      const res = await contentApi.getList({
        category_id: post.category.id,
        status: 'published',
        type: 'article',
        language,
        per_page: limit + 1, // 多取一篇，扣掉自己後仍足夠
      });
      pushUnique(res.contents);
    } catch {
      /* 推薦為加值內容，失敗不影響主文 */
    }
  }

  // 2. 不足則補最新文章
  if (collected.length < limit) {
    try {
      const res = await contentApi.getList({
        status: 'published',
        type: 'article',
        language,
        per_page: limit + collected.length + 1,
      });
      pushUnique(res.contents);
    } catch {
      /* 同上 */
    }
  }

  return collected;
}
