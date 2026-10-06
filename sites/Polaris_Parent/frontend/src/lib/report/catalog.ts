/**
 * 客製命理報告的商品目錄（會員 v2）。
 *
 * 文案、交期皆為佔位內容（PLACEHOLDER），正式販售前替換。
 * /report 是所有報告的目錄頁（書封），/report/{slug} 是單一報告的商品頁。
 * 價格不寫在這裡：以 product_id 向商品後台（shop.products）讀取，
 * 後台尚未建立該商品時頁面顯示「價格即將公布」。
 */

export type ReportVariant = 'digital' | 'physical';

export interface ReportVariantInfo {
  variant: ReportVariant;
  /** shop.products.product_id；在後台建立同代碼的商品即可帶出價格 */
  productId: string;
  label: string;
  summary: string;
  features: string[];
  deliveryNote: string;
}

/** 書封配色（components/report/ReportBookCover.tsx） */
export type CoverPalette = 'purple' | 'indigo' | 'rose' | 'teal';

/** 商品頁亮點列的圖示（lucide-react） */
export type HighlightIcon = 'users' | 'eye' | 'clock' | 'book' | 'pen';

/**
 * 一種客製報告（商品）。版型參考 Wonderbly 的商品頁：
 * 圖庫＋標題＋亮點＋價格＋CTA → 可展開的詳細說明 → 特色區塊 → 評價 → FAQ。
 * 每種報告預設是數位版；實體書是加購選項（見 REPORT_VARIANTS）。
 */
export interface ReportProduct {
  /** 網址代稱：/report/{slug} */
  slug: string;
  /**
   * 由哪一筆後台商品（shop.products.product_id）帶入顯示文字，通常是數位版。
   * 後台「產品管理」的名稱、簡短描述與「前台顯示設定」會蓋過這裡的預設值（lib/report/display.ts）。
   */
  displayProductId: string;
  name: string;
  tagline: string;
  /** 目錄卡片上的一句話 */
  cardDescription: string;
  /** 目錄卡片上的標籤，例如「新上市」 */
  badge?: string;
  /** 適用對象標籤，例如「適合所有年齡」 */
  audienceLabel: string;
  /** image：後台上傳的封面圖（有就顯示圖片，沒有就用 CSS 畫書封） */
  cover: { eyebrow: string; title: string; subtitle: string; palette: CoverPalette; image?: string };
  /** 商品頁圖庫：第一張固定是書封，其餘是內頁示意（後台沒上傳圖時顯示這些佔位說明） */
  gallery: string[];
  /** 後台上傳的內頁圖（有任何一張就取代 gallery 的佔位框） */
  galleryImages?: string[];
  highlights: { icon: HighlightIcon; text: string }[];
  intro: string[];
  testimonial: { quote: string; author: string };
  /** 可展開的詳細說明（對應 Wonderbly 的 How is it personalised / What's the story / Size & quality） */
  details: { title: string; body: string[] }[];
  /** 圖文特色區塊（對應 Wonderbly 的 When is a book not just a book / Add some extra magic） */
  /** image 是佔位說明；imageUrl 是後台上傳的圖片 */
  features: { title: string; body: string; image: string; imageUrl?: string }[];
  process: { title: string; body: string }[];
  faq: { q: string; a: string }[];
}

export const REPORT_PRODUCT: ReportProduct = {
  slug: 'natal-report',
  displayProductId: 'natal-report-digital',
  name: '本命客製報告',
  tagline: '［佔位］一份只為一個人寫的命盤報告',
  cardDescription: '［佔位］依出生資料排出命盤，逐章寫成一本只屬於主角的報告。',
  badge: '［佔位］新上市',
  audienceLabel: '［佔位］適合所有年齡',
  cover: { eyebrow: '親紫之間', title: '本命客製報告', subtitle: '［佔位］寫給一個獨一無二的人', palette: 'purple' },
  gallery: ['［佔位］扉頁題字', '［佔位］目錄', '［佔位］內頁：命盤總覽', '［佔位］內頁：性格與天賦', '［佔位］附錄：命盤圖'],
  highlights: [
    { icon: 'users', text: '［佔位］適合所有年齡，可為自己或家人製作' },
    { icon: 'eye', text: '付款前先預覽主角的命盤與樣張' },
    { icon: 'clock', text: '［佔位］付款後約 N 個工作天完成' },
    { icon: 'book', text: '可加購精裝實體書' },
  ],
  intro: [
    '［佔位］依照報告主角的出生資料排出命盤，由親紫之間的紫微斗數系統逐章分析，再經編輯審稿完成。',
    '［佔位］內容涵蓋性格、天賦、人際與成長方向等主題；你可以指定這份報告要給誰讀、書中怎麼稱呼主角，並在扉頁留下一段話。',
  ],
  testimonial: { quote: '［佔位］讀完才發現，原來有些事早就寫在命盤裡。', author: '［佔位］讀者 A' },
  details: [
    {
      title: '報告如何客製？',
      body: [
        '［佔位］填寫主角的姓名、性別、出生日期與時間，系統會排出主角的本命盤。',
        '［佔位］你可以指定這份報告寫給誰讀、書中怎麼稱呼主角，並在扉頁留下一段話。',
      ],
    },
    {
      title: '報告裡有什麼？',
      body: ['［佔位］命盤總覽、性格與天賦、人際與關係、學習與工作、成長方向，以及完整命盤圖附錄。'],
    },
    {
      title: '規格與品質',
      body: ['［佔位］數位版：PDF，約 N 頁，會員中心下載。', '［佔位］實體書：精裝，N × N 公分，約 N 頁，由合作印刷廠印製寄送。'],
    },
  ],
  features: [
    {
      title: '不只是一份報告',
      body: '［佔位］扉頁可以留下一段你想對主角說的話，讓這份報告成為一份能收藏的禮物。',
      image: '［佔位］扉頁題字照片',
    },
    {
      title: '加購精裝實體書',
      body: '［佔位］每份報告都是數位版；想要放在書架上或當成禮物，可以在預覽後加購精裝實體書。',
      image: '［佔位］實體書照片',
    },
  ],
  process: [
    { title: '填寫資料', body: '［佔位］約 3 分鐘，填寫主角的出生資料與讀者設定。' },
    { title: '預覽與下單', body: '［佔位］先看主角的命盤與樣張，需要的話再加購實體書。' },
    { title: '系統分析＋人工審稿', body: '［佔位］逐章分析後由編輯審稿、排版。' },
    { title: '交付', body: '［佔位］數位版在會員中心下載；實體書由印刷廠寄出。' },
  ],
  faq: [
    { q: '這份報告怎麼客製？', a: '［佔位］按下「開始客製我的報告」，依序回答幾個問題，完成後就能預覽。' },
    { q: '不知道出生時間可以買嗎？', a: '［佔位］需要確定的出生時間才能製作；我們不會替你推測時間。' },
    { q: '適合送給誰？', a: '［佔位］自己、孩子、伴侶、父母或朋友都可以。' },
    { q: '付款後可以修改資料或退款嗎？', a: '［佔位］報告依出生資料個別製作，屬客製化商品，付款後不受理取消或退款，例外情形依交易政策處理。' },
    { q: '數位版之後可以加購實體書嗎？', a: '［佔位］可以，加購方式與價格另行公布。' },
  ],
};

/** 目錄頁（/report）列出的所有報告；目前只有一種，之後在這裡新增 */
export const REPORT_PRODUCTS: ReportProduct[] = [REPORT_PRODUCT];

export const productBySlug = (slug: string) => REPORT_PRODUCTS.find((p) => p.slug === slug);

export const productHref = (p: ReportProduct) => `/report/${p.slug}`;

/** 目錄頁文案（版型參考 Wonderbly 的 All personalised books） */
export const REPORT_CATALOG = {
  title: '所有客製報告',
  subtitle: '［佔位］依出生資料逐章撰寫、經人工審稿的命理報告，寫給每一個重要的人。',
  promo: '［佔位］每份報告都可以先預覽，再決定是否加購精裝實體書',
  /** 「你想送給誰？」分類卡；目前只是導引，尚未依分類篩選 */
  audiences: [
    { label: '給自己', note: '［佔位］更了解自己' },
    { label: '給孩子', note: '［佔位］換個角度認識孩子' },
    { label: '給伴侶', note: '［佔位］一起讀懂彼此' },
    { label: '送給家人朋友', note: '［佔位］一份特別的禮物' },
  ],
  usps: ['［佔位］付款前先預覽', '［佔位］人工審稿', '［佔位］可加購精裝實體書', '［佔位］會員中心永久下載'],
  faq: [
    { q: '報告是怎麼製作的？', a: '［佔位］依主角的出生資料排盤，由紫微斗數系統逐章分析，再經編輯審稿、排版。' },
    { q: '多久可以收到？', a: '［佔位］數位版付款後約 N 個工作天完成；實體書另需印製與寄送時間。' },
    { q: '實體書的尺寸與規格？', a: '［佔位］精裝，N × N 公分，約 N 頁。' },
    { q: '要怎麼客製？', a: '［佔位］選一本報告，按下「開始客製」，依序回答幾個問題即可。' },
  ],
};

/** 報告目錄（預覽頁顯示；正式章節名稱上線前替換） */
export const REPORT_TOC: string[] = [
  '［佔位］扉頁',
  '［佔位］第一章　命盤總覽',
  '［佔位］第二章　性格與天賦',
  '［佔位］第三章　人際與關係',
  '［佔位］第四章　學習與工作',
  '［佔位］第五章　成長方向',
  '［佔位］附錄　命盤圖',
];

/**
 * 預覽頁的個人化樣張範本。可用代換字：
 * {call_name} 書中稱呼、{name} 主角姓名、{reader} 讀者（label）。
 * 只放範本文字，不放真實解讀；正式文案上線前替換。
 */
export const SAMPLE_PAGE_TEMPLATES: { title: string; body: string }[] = [
  {
    title: '［佔位］第一章　命盤總覽',
    body: '［佔位］{call_name}，這一章會從你的命宮開始，說明命盤裡最核心的幾顆星，以及它們如何描繪出你看世界的方式。',
  },
  {
    title: '［佔位］第二章　性格與天賦',
    body: '［佔位］每個人都有自己擅長的節奏。這一章寫給{reader}，談{call_name}在什麼情況下最能發揮、什麼時候需要多一點空間。',
  },
  {
    title: '［佔位］第五章　成長方向',
    body: '［佔位］最後一章不談命定，而是談選擇：{call_name}的命盤提供了哪些線索，可以陪著{name}走得更從容。',
  },
];

/**
 * 後端的兩個版本：digital（基本，每份報告預設）與 physical（數位版＋精裝實體書）。
 * 前台把 physical 呈現成「加購實體書」，加購價＝physical 售價 − digital 售價；
 * 實際收費仍以後端讀到的 physical 售價為準（extensions/report_orders/service.py）。
 */
export const REPORT_VARIANTS: ReportVariantInfo[] = [
  {
    variant: 'digital',
    productId: 'natal-report-digital',
    label: '數位版',
    summary: '［佔位］PDF 電子報告，完成後在會員中心下載。',
    features: ['［佔位］完整 PDF 報告', '［佔位］會員中心永久下載', '［佔位］日後可加購實體書'],
    deliveryNote: '［佔位］付款後約 N 個工作天完成',
  },
  {
    variant: 'physical',
    productId: 'natal-report-physical',
    label: '數位版＋精裝實體書',
    summary: '［佔位］精裝實體書，另含數位版 PDF。',
    features: ['［佔位］精裝印刷實體書', '［佔位］含數位版 PDF', '［佔位］由合作印刷廠寄送'],
    deliveryNote: '［佔位］付款後約 N 個工作天出貨',
  },
];

export const variantInfo = (v: ReportVariant) => REPORT_VARIANTS.find((x) => x.variant === v)!;

/** 加購實體書的說明（預覽頁的加購選項、商品頁） */
export const PHYSICAL_ADDON = {
  label: '加購精裝實體書',
  summary: '［佔位］精裝印刷，由合作印刷廠寄送；仍包含數位版。',
  features: ['［佔位］精裝印刷實體書', '［佔位］由合作印刷廠寄送', '［佔位］付款後約 N 個工作天出貨'],
};

/** 報告主角與購買者的關係 → account.users.relation_label（≤20 字，紫微 save-and-register 會檢查） */
export const RELATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'self', label: '我自己' },
  { value: 'son', label: '兒子' },
  { value: 'daughter', label: '女兒' },
  { value: 'father', label: '父親' },
  { value: 'mother', label: '母親' },
  { value: 'spouse', label: '配偶／伴侶' },
  { value: 'brother', label: '兄弟' },
  { value: 'sister', label: '姊妹' },
  { value: 'friend', label: '朋友' },
  { value: 'other', label: '其他' },
];

/** 這份報告寫給誰讀 → 紫微產線 VaultAudienceNode 的讀者設定 */
export const READER_OPTIONS: { value: string; label: string }[] = [
  { value: '命主本人', label: '報告主角本人' },
  { value: '父母', label: '主角的父母' },
  { value: '伴侶', label: '主角的伴侶' },
  { value: '子女', label: '主角的子女' },
  { value: '朋友', label: '主角的朋友' },
  { value: '主管或同事', label: '主角的主管或同事' },
  { value: '其他', label: '其他' },
];

export const DEDICATION_MAX = 200;
export const CALL_NAME_MAX = 20;

/** 交易政策版本；與後端 extensions/report_orders/service.py 的 POLICY_VERSION 一致，改版時兩邊一起改 */
export const POLICY_VERSION = '2026-10-03';
