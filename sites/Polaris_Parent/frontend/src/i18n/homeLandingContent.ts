// 首頁（文字型 landing）的站台文案。
// heroIntroDefaults 是 Hero 的靜態預設：後台「首頁設定 → Hero 介紹」有填的欄位優先，留空的欄位退回這裡。
// 排盤、回饋牆、訂閱區塊的標題與說明目前只在這裡改。
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
    eyebrow: 'Qin Zi Blog',
    headline: "Understand your child's gifts through Zi Wei Dou Shu and data",
    body:
      'Every child arrives with their own "factory spec sheet". We read Zi Wei Dou Shu as a body of data that can be tested. It is not about fate. It is about tendencies and traits.\n\n' +
      "We help parents see their child's gifts, understand how their child differs from them, and find the words their child can actually hear.",
    newsletter_note: 'Subscribe to get new articles and observations on parenting with Zi Wei Dou Shu.',
  },
  ja: {
    eyebrow: '親紫の間',
    headline: '紫微斗数とデータで、子どもの才能を読み解く',
    body:
      '子どもは誰でも、自分だけの「仕様書」を持って生まれてきます。親紫の間は紫微斗数を、検証できるデータベースとして読み解きます。宿命ではなく、傾向と特性の話です。\n\n' +
      '子どもの才能を理解し、親である自分との違いを受け止め、その子に届く言葉を見つけるお手伝いをします。',
    newsletter_note: 'ニュースレターに登録すると、紫微斗数と子育ての新しい記事や気づきが届きます。',
  },
};

export interface HomeLandingContent {
  ziweiHeading: string;
  ziweiBody: string;
  testimonialsHeading: string;
  subscribeHeading: string;
}

export const homeLandingContent: Record<string, HomeLandingContent> = {
  'zh-TW': {
    ziweiHeading: '線上排盤',
    ziweiBody: '滑動選擇出生年月日與時間，按下排盤，命盤會直接出現在下方。',
    testimonialsHeading: '他們怎麼說',
    subscribeHeading: '訂閱電子報',
  },
  'zh-CN': {
    ziweiHeading: '在线排盘',
    ziweiBody: '滑动选择出生年月日与时间，按下排盘，命盘会直接出现在下方。',
    testimonialsHeading: '他们怎么说',
    subscribeHeading: '订阅电子报',
  },
  en: {
    ziweiHeading: 'Online chart',
    ziweiBody: 'Scroll to pick a birth date and time, then press the button. The chart appears right below.',
    testimonialsHeading: 'What readers say',
    subscribeHeading: 'Subscribe to the newsletter',
  },
  ja: {
    ziweiHeading: 'オンライン命盤作成',
    ziweiBody: '生年月日と時刻をスクロールで選んでボタンを押すと、すぐ下に命盤が表示されます。',
    testimonialsHeading: '読者の声',
    subscribeHeading: 'ニュースレターに登録',
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
