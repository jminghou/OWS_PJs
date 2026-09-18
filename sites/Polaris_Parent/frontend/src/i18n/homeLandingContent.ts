// 首頁（文字型 landing）的站台文案。
// heroIntroDefaults 是 Hero 的靜態預設：後台「首頁設定 → Hero 介紹」有填的欄位優先，留空的欄位退回這裡。
// 其餘區塊（文章清單、排盤入口、結尾訂閱）目前只在這裡改。
import type { HeroIntro, HeroIntroFields } from '@/types';

export const heroIntroDefaults: HeroIntro['locales'] = {
  'zh-TW': {
    eyebrow: '親紫之間',
    headline: '用紫微斗數與數據，讀懂孩子的天賦',
    body:
      '每個孩子出生時，都帶著一份自己的「原廠規格書」。親紫之間把紫微斗數當成一套可以驗證的數據庫來讀——不談宿命，只談趨勢與特質。\n\n' +
      '我們幫家長看懂孩子的天賦、理解他和你的不同，找到他聽得進去的說話方式。',
    newsletter_note: '訂閱電子報，第一時間收到新的親子紫微文章與觀察。',
  },
  'zh-CN': {
    eyebrow: '亲紫之间',
    headline: '用紫微斗数与数据，读懂孩子的天赋',
    body:
      '每个孩子出生时，都带着一份自己的“原厂规格书”。亲紫之间把紫微斗数当成一套可以验证的数据库来读——不谈宿命，只谈趋势与特质。\n\n' +
      '我们帮家长看懂孩子的天赋、理解他和你的不同，找到他听得进去的说话方式。',
    newsletter_note: '订阅电子报，第一时间收到新的亲子紫微文章与观察。',
  },
  en: {
    eyebrow: 'Polaris Parent',
    headline: "Understand your child's gifts through Zi Wei Dou Shu and data",
    body:
      'Every child arrives with their own "factory spec sheet". We read Zi Wei Dou Shu as a body of data that can be tested. It is not about fate. It is about tendencies and traits.\n\n' +
      "We help parents see their child's gifts, understand how their child differs from them, and find the words their child can actually hear.",
    newsletter_note: 'Subscribe to get new articles and observations on parenting with Zi Wei Dou Shu.',
  },
  ja: {
    eyebrow: '親紫之間',
    headline: '紫微斗数とデータで、子どもの才能を読み解く',
    body:
      '子どもは誰でも、自分だけの「仕様書」を持って生まれてきます。親紫之間は紫微斗数を、検証できるデータベースとして読み解きます。宿命ではなく、傾向と特性の話です。\n\n' +
      '子どもの才能を理解し、親である自分との違いを受け止め、その子に届く言葉を見つけるお手伝いをします。',
    newsletter_note: 'ニュースレターに登録すると、紫微斗数と子育ての新しい記事や気づきが届きます。',
  },
};

export interface HomeLandingContent {
  articlesHeading: string;
  articlesViewAll: string;
  articlesEmpty: string;
  ziweiHeading: string;
  ziweiBody: string;
  ziweiButton: string;
  closingHeading: string;
  closingBody: string;
}

export const homeLandingContent: Record<string, HomeLandingContent> = {
  'zh-TW': {
    articlesHeading: '從這幾篇開始',
    articlesViewAll: '查看全部文章',
    articlesEmpty: '文章準備中，請稍後再來。',
    ziweiHeading: '線上排盤',
    ziweiBody: '輸入出生資料，立即看到孩子（或你自己）的紫微命盤。免費註冊即可保存命盤。',
    ziweiButton: '開始排盤',
    closingHeading: '不想錯過新文章？',
    closingBody: '留下 Email，新文章發布時我們會寄給你。',
  },
  'zh-CN': {
    articlesHeading: '从这几篇开始',
    articlesViewAll: '查看全部文章',
    articlesEmpty: '文章准备中，请稍后再来。',
    ziweiHeading: '在线排盘',
    ziweiBody: '输入出生资料，立即看到孩子（或你自己）的紫微命盘。免费注册即可保存命盘。',
    ziweiButton: '开始排盘',
    closingHeading: '不想错过新文章？',
    closingBody: '留下 Email，新文章发布时我们会发给你。',
  },
  en: {
    articlesHeading: 'Start with these',
    articlesViewAll: 'View all articles',
    articlesEmpty: 'Articles are on the way. Please check back soon.',
    ziweiHeading: 'Online chart',
    ziweiBody: "Enter a birth date and time to see your child's (or your own) Zi Wei chart right away. Register for free to save it.",
    ziweiButton: 'Create a chart',
    closingHeading: "Don't want to miss new articles?",
    closingBody: "Leave your email and we'll send new articles when they are published.",
  },
  ja: {
    articlesHeading: 'まずはこの記事から',
    articlesViewAll: 'すべての記事を見る',
    articlesEmpty: '記事を準備中です。しばらくしてからまたお越しください。',
    ziweiHeading: 'オンライン命盤作成',
    ziweiBody: '生年月日と出生時刻を入力すると、お子さま（またはご自身）の紫微命盤がすぐに表示されます。無料登録で命盤を保存できます。',
    ziweiButton: '命盤を作成する',
    closingHeading: '新しい記事を見逃したくない方へ',
    closingBody: 'メールアドレスを登録すると、新しい記事の公開時にお知らせします。',
  },
};

const FALLBACK_LOCALE = 'zh-TW';

export function getHomeLandingContent(locale: string): HomeLandingContent {
  return homeLandingContent[locale] ?? homeLandingContent[FALLBACK_LOCALE];
}

/** 逐欄位合併：後台有填的用後台，留空的退回靜態預設。 */
export function resolveHeroIntro(locale: string, saved?: HeroIntro): HeroIntroFields & { image_url?: string } {
  const defaults = heroIntroDefaults[locale] ?? heroIntroDefaults[FALLBACK_LOCALE] ?? {};
  const fields = saved?.locales?.[locale] ?? {};
  const merged: HeroIntroFields = { ...defaults };
  (Object.keys(fields) as (keyof HeroIntroFields)[]).forEach((key) => {
    if (fields[key]?.trim()) merged[key] = fields[key];
  });
  return { ...merged, image_url: saved?.image_url || undefined };
}
