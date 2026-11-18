/** 後端可能回 naive UTC（無時區）或帶時區的 ISO；統一當 UTC 解讀後轉成瀏覽器當地時間。 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined): string {
  const d = parseServerDate(value);
  return d ? d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
}

export function formatDateTime(value: string | null | undefined): string {
  const d = parseServerDate(value);
  return d ? d.toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

/** 「3 天前」這種相對時間；超過一年改顯示日期。 */
export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  const d = parseServerDate(value);
  if (!d) return '從未';
  const sec = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (sec < 60) return '剛剛';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} 天前`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month} 個月前`;
  return formatDate(value);
}

export const nf = new Intl.NumberFormat('zh-TW');
