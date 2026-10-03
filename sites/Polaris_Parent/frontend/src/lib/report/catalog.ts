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
} as const;

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
