/**
 * 親紫專欄（IG 式總覽頁）的介面文案與頁頭預設值。
 * 頁頭文字以後台「專欄頁設定」（/admin/column）為準；留空的欄位退回這裡。
 */
import type { ColumnProfile, ColumnProfileFields, ColumnProfileLink } from '@/lib/api';

export interface ColumnCopy {
  pageTitle: string;
  posts: string;
  categories: string;
  topics: string;
  all: string;
  search: string;
  searchPlaceholder: string;
  clear: string;
  searching: (q: string) => string;
  empty: string;
  emptySearch: (q: string) => string;
  loadMore: string;
  retry: string;
  loadError: string;
  highlightsLabel: string;
  tabsLabel: string;
  defaults: Required<ColumnProfileFields>;
  defaultActions: (basePath: string) => ColumnProfileLink[];
}

const zhTW: ColumnCopy = {
  pageTitle: '親紫專欄',
  posts: '篇文章',
  categories: '個分類',
  topics: '個主題',
  all: '全部',
  search: '搜尋文章',
  searchPlaceholder: '搜尋親子教養文章…',
  clear: '清除',
  searching: (q) => `搜尋「${q}」`,
  empty: '這裡還沒有文章',
  emptySearch: (q) => `沒有找到包含「${q}」的文章`,
  loadMore: '載入更多',
  retry: '重新載入',
  loadError: '文章載入失敗，請稍後再試',
  highlightsLabel: '精選主題',
  tabsLabel: '文章分類',
  defaults: {
    name: '親紫之間',
    subtitle: '紫微斗數 × 親子教養',
    bio: '探索紫微斗數在親子教養中的應用，理解孩子的天賦特質，建立更深層的親子連結。',
  },
  defaultActions: (basePath) => [
    { label: '購買報告', url: '/report' },
    { label: '訂閱電子報', url: `${basePath}/newsletter` },
  ],
};

const zhCN: ColumnCopy = {
  ...zhTW,
  pageTitle: '亲紫专栏',
  posts: '篇文章',
  categories: '个分类',
  topics: '个主题',
  search: '搜索文章',
  searchPlaceholder: '搜索亲子教养文章…',
  clear: '清除',
  searching: (q) => `搜索「${q}」`,
  empty: '这里还没有文章',
  emptySearch: (q) => `没有找到包含「${q}」的文章`,
  loadMore: '加载更多',
  retry: '重新加载',
  loadError: '文章加载失败，请稍后再试',
  highlightsLabel: '精选主题',
  tabsLabel: '文章分类',
  defaults: {
    name: '亲紫之间',
    subtitle: '紫微斗数 × 亲子教养',
    bio: '探索紫微斗数在亲子教养中的应用，理解孩子的天赋特质，建立更深层的亲子连结。',
  },
  defaultActions: (basePath) => [
    { label: '购买报告', url: '/report' },
    { label: '订阅电子报', url: `${basePath}/newsletter` },
  ],
};

const en: ColumnCopy = {
  pageTitle: 'Articles',
  posts: 'posts',
  categories: 'categories',
  topics: 'topics',
  all: 'All',
  search: 'Search articles',
  searchPlaceholder: 'Search parenting articles…',
  clear: 'Clear',
  searching: (q) => `Search: “${q}”`,
  empty: 'No articles yet',
  emptySearch: (q) => `No articles found for “${q}”`,
  loadMore: 'Load more',
  retry: 'Retry',
  loadError: 'Could not load articles. Please try again.',
  highlightsLabel: 'Featured topics',
  tabsLabel: 'Article categories',
  defaults: {
    name: 'Qin Zi',
    subtitle: 'Zi Wei Dou Shu × Parenting',
    bio: "Explore Zi Wei Dou Shu in parenting and understand your child's unique talents.",
  },
  defaultActions: (basePath) => [
    { label: 'Reports', url: '/report' },
    { label: 'Newsletter', url: `${basePath}/newsletter` },
  ],
};

const ja: ColumnCopy = {
  ...en,
  pageTitle: '記事',
  posts: '記事',
  categories: 'カテゴリ',
  topics: 'トピック',
  all: 'すべて',
  search: '記事を検索',
  searchPlaceholder: '子育ての記事を検索…',
  clear: 'クリア',
  searching: (q) => `「${q}」で検索`,
  empty: 'まだ記事がありません',
  emptySearch: (q) => `「${q}」を含む記事は見つかりませんでした`,
  loadMore: 'もっと見る',
  retry: '再読み込み',
  loadError: '記事を読み込めませんでした',
  highlightsLabel: '注目トピック',
  tabsLabel: '記事カテゴリ',
  defaults: {
    name: '親紫の間',
    subtitle: '紫微斗数 × 子育て',
    bio: '紫微斗数の育児への応用を探求し、お子様のユニークな才能を理解しましょう。',
  },
  defaultActions: (basePath) => [
    { label: 'レポート', url: '/report' },
    { label: 'ニュースレター', url: `${basePath}/newsletter` },
  ],
};

const COPY: Record<string, ColumnCopy> = { 'zh-TW': zhTW, 'zh-CN': zhCN, en, ja };

export function getColumnCopy(locale?: string): ColumnCopy {
  return COPY[locale || 'zh-TW'] || zhTW;
}

/** 合併後台文案與預設值：該語系有填用後台的，沒填退回該語系的內建預設（不跨語系借字） */
export function resolveProfileText(profile: ColumnProfile, locale: string, copy: ColumnCopy): Required<ColumnProfileFields> {
  const own = profile.locales[locale] || {};
  return {
    name: own.name || copy.defaults.name,
    subtitle: own.subtitle || copy.defaults.subtitle,
    bio: own.bio || copy.defaults.bio,
  };
}
