/**
 * 外部平台代客建單的顯示用清單（後端 report_orders/proxy.py）。
 * 平台代碼由後台「外部訂單查證」建立渠道時決定；這裡只負責顯示名稱，不認得的代碼原樣顯示。
 */

export const CHANNEL_LABELS: Record<string, string> = {
  direct: '直接接單',
  etsy: 'Etsy',
  pinkoi: 'Pinkoi',
  xiaohongshu: '小紅書',
  xhs: '小紅書',
  rednote: '小紅書',
};

export const channelLabel = (code: string | null | undefined) => (code ? CHANNEL_LABELS[code] ?? code : '—');

/** 成品語系（紫微產線一律中文製作，最後一個節點翻譯成這個語系）；可另填其他 BCP 47 代碼 */
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '簡體中文' },
  { value: 'en', label: '英文' },
  { value: 'nb', label: '挪威文（Bokmål）' },
  { value: 'sv', label: '瑞典文' },
  { value: 'da', label: '丹麥文' },
  { value: 'de', label: '德文' },
  { value: 'fr', label: '法文' },
  { value: 'nl', label: '荷蘭文' },
  { value: 'es', label: '西班牙文' },
  { value: 'it', label: '義大利文' },
  { value: 'ja', label: '日文' },
];

export const languageLabel = (code: string | null | undefined) =>
  LANGUAGE_OPTIONS.find((l) => l.value === code)?.label ?? code ?? '—';

/** 後端錯誤鍵 → 欄位名稱（錯誤摘要用） */
export const PROXY_FIELD_LABELS: Record<string, string> = {
  channel_id: '平台',
  external_order_id: '平台訂單編號',
  currency: '幣別',
  amount: '成交金額',
  language: '成品語系',
  customer: '客人',
  customer_id: '客人',
  'customer.display_name': '客人名稱',
  variant: '版本',
  subject_name: '主角姓名',
  gender: '性別',
  birth_date: '出生日期',
  birth_time: '出生時間',
  time_type: '時間類型',
  place: '出生地',
  relation_label: '關係',
  reader: '讀者',
  call_name: '書中稱呼',
  dedication: '題字',
  recipient_name: '收件人',
  recipient_phone: '收件電話',
  postal_code: '郵遞區號',
  address: '收件地址',
  country: '國家',
  spec_key: '規格',
  sources: '資料來源',
};

export const fieldLabel = (key: string) =>
  PROXY_FIELD_LABELS[key] ?? (key.startsWith('sources.') ? `資料來源第 ${Number(key.split('.')[1]) + 1} 筆` : key);
