/**
 * 客製命理報告的商品目錄（會員 v2）。
 *
 * 文案、交期皆為佔位內容（PLACEHOLDER），正式販售前替換。
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

export const REPORT_PRODUCT = {
  code: 'natal-report',
  name: '本命客製報告',
  tagline: '［佔位］一份只為一個人寫的命盤報告',
  intro: [
    '［佔位］依照報告主角的出生資料排出命盤，由親紫之間的紫微斗數系統逐章分析，再經編輯審稿完成。',
    '［佔位］內容涵蓋性格、天賦、人際與成長方向等主題；你可以指定這份報告要給誰讀、書中怎麼稱呼主角，並在扉頁留下一段話。',
  ],
  samplePages: ['［佔位］封面', '［佔位］目錄', '［佔位］內頁範例'],
  /** 商品頁「適合誰」 */
  forWhom: ['［佔位］想更了解自己的人', '［佔位］想用另一種方式認識孩子的父母', '［佔位］想送一份特別禮物給重要的人'],
  /** 商品頁「製作方式」：依序呈現 */
  process: [
    { title: '填寫資料', body: '［佔位］約 3 分鐘，填寫主角的出生資料與讀者設定。' },
    { title: '預覽與下單', body: '［佔位］先看主角的命盤與樣張，再選數位版或實體書。' },
    { title: '系統分析＋人工審稿', body: '［佔位］逐章分析後由編輯審稿、排版。' },
    { title: '交付', body: '［佔位］數位版在會員中心下載；實體書由印刷廠寄出。' },
  ],
  faq: [
    { q: '不知道出生時間可以買嗎？', a: '［佔位］需要確定的出生時間才能製作；我們不會替你推測時間。' },
    { q: '付款後可以修改資料或退款嗎？', a: '［佔位］報告依出生資料個別製作，屬客製化商品，付款後不受理取消或退款，例外情形依交易政策處理。' },
    { q: '數位版之後可以加購實體書嗎？', a: '［佔位］可以，加購方式與價格另行公布。' },
  ],
} as const;

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
    label: '實體書版',
    summary: '［佔位］精裝實體書，另含數位版 PDF。',
    features: ['［佔位］精裝印刷實體書', '［佔位］含數位版 PDF', '［佔位］由合作印刷廠寄送'],
    deliveryNote: '［佔位］付款後約 N 個工作天出貨',
  },
];

export const variantInfo = (v: ReportVariant) => REPORT_VARIANTS.find((x) => x.variant === v)!;

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
