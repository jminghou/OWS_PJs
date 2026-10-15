import { resolveBirthTime } from '@ows/ziwei-engine';
import type { ReportDraft } from './draft';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 確認頁要告訴客人的時間調整（與建單時後端 birthplace.resolve 同義）：
 * 一般時間遇夏令時會扣掉時差；真太陽時顯示校正後的時間。資料不完整或算不出來回 null。
 */
export function birthTimeNote(d: ReportDraft): string | null {
  const [year, month, day] = d.birth.date.split('-').map(Number);
  const [hour, minute] = d.birth.time.split(':').map(Number);
  if (!year || Number.isNaN(hour) || !d.place.city || !d.place.country) return null;
  try {
    const b = resolveBirthTime({ year, month, day, hour, minute, timeType: d.birth.time_type,
                                 place: { city: d.place.city, country: d.place.country } });
    const r = b.resolved;
    const dateChanged = r.year !== year || r.month !== month || r.day !== day;
    const at = `${dateChanged ? `${r.year}-${pad(r.month)}-${pad(r.day)} ` : ''}${pad(r.hour)}:${pad(r.minute)}`;
    if (b.time_type === 'solar_time') return `依出生地校正為真太陽時 ${at} 排盤`;
    if (b.dst_minutes) return `出生當天當地實施夏令時，已扣除 ${b.dst_minutes / 60} 小時，以 ${at} 排盤`;
    return null;
  } catch {
    return null;
  }
}
