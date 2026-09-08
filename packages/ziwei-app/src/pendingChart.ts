/**
 * 「剛排的命盤」跨頁暫存（sessionStorage）。
 * 訪客在排盤頁按「加入會員」CTA → 暫存生辰 → 前往 /login 合一頁；
 * 註冊（隨 /astrology/register 一併歸戶）或登入（補打 save-and-register）後清除。
 */
import type { RegisterChartPayload } from './api/astrology';

const KEY = 'polaris_pending_chart';

export function stashPendingChart(chart: RegisterChartPayload): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(chart));
  } catch {
    /* sessionStorage 不可用（隱私模式等）時略過，不擋導頁 */
  }
}

export function loadPendingChart(): RegisterChartPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (
      typeof obj?.year !== 'number' ||
      typeof obj?.month !== 'number' ||
      typeof obj?.day !== 'number' ||
      typeof obj?.hour !== 'number' ||
      typeof obj?.gender !== 'string'
    ) {
      return null;
    }
    return obj as RegisterChartPayload;
  } catch {
    return null;
  }
}

export function clearPendingChart(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
