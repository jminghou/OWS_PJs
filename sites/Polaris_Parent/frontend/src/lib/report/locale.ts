/**
 * 客製報告的語系（2026-10-28 商品多語言階段 B）。
 *
 * 一種語言是一筆獨立商品（後台「產品管理」的語言版本）：/report 是繁中，/{locale}/report 讀該語言那一筆。
 * 商品頁的文案來自該語言商品的後台設定；這裡只放頁面固定的介面文字（按鈕、區塊標題）。
 * 下單精靈目前只有中文介面，語言與幣別透過 ?lang= 帶進草稿，訂單用該語言建立。
 *
 * 要加語言：這裡的 REPORT_LOCALES 與 REPORT_UI、i18n/config.ts、後台產品頁的 LANGUAGES、後端 SUPPORTED_LANGUAGES。
 */

export const REPORT_DEFAULT_LOCALE = 'zh-TW';
export const REPORT_LOCALES = ['zh-TW', 'zh-CN', 'en', 'ja'] as const;
export type ReportLocale = (typeof REPORT_LOCALES)[number];

/** 中文介面（下單精靈、會員中心）顯示用的語言名稱 */
export const LANGUAGE_NAMES: Record<string, string> = { 'zh-TW': '繁體中文', 'zh-CN': '簡體中文', en: '英文', ja: '日文' };

export const isReportLocale = (v: unknown): v is ReportLocale => REPORT_LOCALES.includes(v as ReportLocale);

/** 報告頁的網址前綴：繁中沒有前綴 */
export const reportBase = (locale: string) => (locale === REPORT_DEFAULT_LOCALE ? '/report' : `/${locale}/report`);

/** 下單入口帶上語言（繁中不帶） */
export function withLang(href: string, locale: string) {
  if (locale === REPORT_DEFAULT_LOCALE) return href;
  return `${href}${href.includes('?') ? '&' : '?'}lang=${encodeURIComponent(locale)}`;
}

export interface ReportUi {
  breadcrumb: string;
  catalogCount: (n: number) => string;
  cardDigital: string;
  viewReports: string;
  seeAllReports: string;
  digital: string;
  book: string;
  buy: (item: string) => string;
  from: string;
  bookIncludesDigital: string;
  startNote: string;
  process: string;
  reviews: string;
  fiveStars: string;
  faqOf: (name: string) => string;
  policyPrefix: string;
  policyLink: string;
  ready: string;
  audience: string;
  priceSoon: string;
  unavailableTitle: string;
  unavailableBody: string;
  goChinese: string;
  wizardNote: string;
}

export const REPORT_UI: Record<ReportLocale, ReportUi> = {
  'zh-TW': {
    breadcrumb: '客製報告',
    catalogCount: (n) => `共 ${n} 款報告`,
    cardDigital: '數位報告',
    viewReports: '看看報告',
    seeAllReports: '看所有報告',
    digital: '數位報告',
    book: '實體書',
    buy: (item) => `購買${item}`,
    from: '起',
    bookIncludesDigital: '（含數位報告）',
    startNote: '約 3 分鐘填完資料，付款前可以先預覽。',
    process: '怎麼製作',
    reviews: '讀者怎麼說',
    fiveStars: '五顆星',
    faqOf: (name) => `${name}常見問題`,
    policyPrefix: '完整條款請見',
    policyLink: '《交易政策》',
    ready: '準備好為重要的人製作一份報告了嗎？',
    audience: '你想送給誰？',
    priceSoon: '價格即將公布',
    unavailableTitle: '這份報告目前只有中文版',
    unavailableBody: '這個語言的版本還在準備中。你可以先看中文版的內容。',
    goChinese: '前往中文版',
    wizardNote: '',
  },
  'zh-CN': {
    breadcrumb: '定制报告',
    catalogCount: (n) => `共 ${n} 款报告`,
    cardDigital: '数字报告',
    viewReports: '看看报告',
    seeAllReports: '查看所有报告',
    digital: '数字报告',
    book: '实体书',
    buy: (item) => `购买${item}`,
    from: '起',
    bookIncludesDigital: '（含数字报告）',
    startNote: '约 3 分钟填完资料，付款前可以先预览。',
    process: '怎么制作',
    reviews: '读者怎么说',
    fiveStars: '五颗星',
    faqOf: (name) => `${name}常见问题`,
    policyPrefix: '完整条款请见',
    policyLink: '《交易政策》',
    ready: '准备好为重要的人制作一份报告了吗？',
    audience: '你想送给谁？',
    priceSoon: '价格即将公布',
    unavailableTitle: '这份报告目前只有中文版',
    unavailableBody: '简体中文版本还在准备中。你可以先看繁体中文版的内容。',
    goChinese: '前往中文版',
    wizardNote: '填写资料的页面目前为繁体中文。',
  },
  en: {
    breadcrumb: 'Personalised reports',
    catalogCount: (n) => `${n} ${n === 1 ? 'report' : 'reports'}`,
    cardDigital: 'Digital report',
    viewReports: 'See the reports',
    seeAllReports: 'See all reports',
    digital: 'Digital report',
    book: 'Printed book',
    buy: (item) => `Buy the ${item.toLowerCase()}`,
    from: '',
    bookIncludesDigital: ' (includes the digital report)',
    startNote: 'About 3 minutes to fill in. Preview before you pay.',
    process: 'How it is made',
    reviews: 'What readers say',
    fiveStars: 'Five stars',
    faqOf: (name) => `${name}: FAQ`,
    policyPrefix: 'Full terms: ',
    policyLink: 'Terms of sale',
    ready: 'Ready to make a report for someone who matters?',
    audience: 'Who is it for?',
    priceSoon: 'Price coming soon',
    unavailableTitle: 'This report is currently only available in Chinese',
    unavailableBody: 'The English edition is still being prepared. You can read the Chinese version in the meantime.',
    goChinese: 'Go to the Chinese version',
    wizardNote: 'The order form is currently in Chinese.',
  },
  ja: {
    breadcrumb: 'オーダーメイドレポート',
    catalogCount: (n) => `全 ${n} 種類のレポート`,
    cardDigital: 'デジタルレポート',
    viewReports: 'レポートを見る',
    seeAllReports: 'すべてのレポートを見る',
    digital: 'デジタルレポート',
    book: '製本版',
    buy: (item) => `${item}を購入`,
    from: '〜',
    bookIncludesDigital: '（デジタルレポート付き）',
    startNote: '入力は約 3 分。お支払い前にプレビューできます。',
    process: '制作の流れ',
    reviews: '読者の声',
    fiveStars: '星 5 つ',
    faqOf: (name) => `${name}のよくある質問`,
    policyPrefix: '詳しい条件は',
    policyLink: '「取引ポリシー」',
    ready: '大切な人のためにレポートを作りませんか？',
    audience: 'どなたに贈りますか？',
    priceSoon: '価格は近日公開',
    unavailableTitle: 'このレポートは現在、中国語版のみです',
    unavailableBody: '日本語版は準備中です。先に中国語版の内容をご覧いただけます。',
    goChinese: '中国語版へ',
    wizardNote: '入力ページは現在、中国語のみです。',
  },
};

export const reportUi = (locale: string): ReportUi => REPORT_UI[isReportLocale(locale) ? locale : REPORT_DEFAULT_LOCALE];
