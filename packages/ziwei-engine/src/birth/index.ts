/**
 * 出生時間換算：後端 extensions/astrology/birthplace.py 的逐條對應物。
 *
 * 每城的 IANA 時區來自離線地點表（data/geo_cities.json 的 tz），出生當下的 UTC 時差用
 * Intl（瀏覽器／Node 內建 ICU 時區資料，含夏令時與歷史時區）求得，與 Python zoneinfo 一致；
 * test/golden/solar.json（Python 產生）逐筆比對保證兩邊同義。
 *
 *   solar_time  依當下實際 UTC 時差（含夏令時）＋經度＋均時差換算真太陽時
 *   clock_time  有出生地時扣掉當下的夏令時差；沒給出生地維持照填的時間
 *
 * 查不到出生地或換算失敗一律拋錯，絕不退回鐘錶時間（舊版會靜默排出錯盤）。
 */
import { getGeoInfo } from "../geo";
import { buildClockTimeStr, computeSolarTimeStr, parseTimeStr, type ClockTime } from "../solar";

export type TimeType = "clock_time" | "solar_time";

export interface BirthTimeInput extends ClockTime {
  timeType?: TimeType;
  place?: { city: string; country: string };
}

export interface BirthTime {
  clock: ClockTime;
  resolved: ClockTime;
  time_type: TimeType;
  /** 真太陽時字串（'17 November 1980 at 10:21'）；clock_time 為 null */
  solar_time: string | null;
  /** '台北, 台灣'；沒給出生地為 '' */
  birthplace: string;
  tz: string | null;
  utc_offset_minutes: number | null;
  /** 出生當下的夏令時差（分）；clock_time 會從輸入扣掉這段 */
  dst_minutes: number;
}

export class BirthplaceError extends Error {}

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** 某個 UTC 瞬間在 tz 的 UTC 時差（秒） */
function offsetAtInstant(tz: string, utcMs: number): number {
  const p: Record<string, string> = {};
  for (const part of formatter(tz).formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - Math.floor(utcMs / 1000) * 1000) / 1000);
}

/**
 * 當地牆上時間的 UTC 時差（秒），語意同 Python ZoneInfo.utcoffset(fold=0)：
 * 重疊時段取較早那次（跳轉前的時差）、不存在的時段也取跳轉前的時差。
 */
export function wallOffsetSeconds(tz: string, c: ClockTime): number {
  const wall = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute);
  const before = offsetAtInstant(tz, wall - DAY_MS);
  const after = offsetAtInstant(tz, wall + DAY_MS);
  if (offsetAtInstant(tz, wall - before * 1000) === before) return before;
  if (offsetAtInstant(tz, wall - after * 1000) === after) return after;
  return before;
}

const noon = (year: number, month: number): ClockTime => ({ year, month, day: 15, hour: 12, minute: 0 });

/** 夏令時差（分）＝當下時差 − 當年 1/15 與 7/15 正午時差較小者 */
export function dstMinutes(tz: string, c: ClockTime): number {
  const standard = Math.min(wallOffsetSeconds(tz, noon(c.year, 1)), wallOffsetSeconds(tz, noon(c.year, 7)));
  return Math.max(0, Math.floor((wallOffsetSeconds(tz, c) - standard) / 60));
}

/** UTC 時差（秒）→ 真太陽時計算用的時區字串：'h8e'、'h5.5e'、'h3w' */
export function offsetToken(offsetSeconds: number): string {
  const text = (Math.abs(offsetSeconds) / 3600).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return `h${text}${offsetSeconds < 0 ? "w" : "e"}`;
}

function shiftMinutes(c: ClockTime, minutes: number): ClockTime {
  const d = new Date(Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute) + minutes * 60_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
           hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

export function resolveBirthTime(input: BirthTimeInput): BirthTime {
  const clock: ClockTime = { year: input.year, month: input.month, day: input.day,
                             hour: input.hour, minute: input.minute ?? 0 };
  const timeType: TimeType = input.timeType ?? "clock_time";
  const city = (input.place?.city ?? "").trim();
  const country = (input.place?.country ?? "").trim();
  const hasPlace = Boolean(city && country);

  if (timeType === "solar_time" && !hasPlace) throw new BirthplaceError("使用真太陽時需選擇出生的國家與城市");
  if (!hasPlace) {
    return { clock, resolved: clock, time_type: timeType, solar_time: null, birthplace: "",
             tz: null, utc_offset_minutes: null, dst_minutes: 0 };
  }
  const geo = getGeoInfo(city, country);
  if (!geo?.tz) throw new BirthplaceError(`找不到出生地「${city}, ${country}」，請從選單重新選擇`);
  const offset = wallOffsetSeconds(geo.tz, clock);
  const base = { clock, time_type: timeType, birthplace: `${city}, ${country}`, tz: geo.tz,
                 utc_offset_minutes: Math.floor(offset / 60), dst_minutes: dstMinutes(geo.tz, clock) };

  if (timeType === "solar_time") {
    const clockStr = buildClockTimeStr(clock.year, clock.month, clock.day, clock.hour, clock.minute);
    const solar = computeSolarTimeStr(clockStr, `${geo.place_en}, ${geo.coordinates}`, offsetToken(offset));
    if (!solar) throw new BirthplaceError(`無法依出生地「${city}, ${country}」換算真太陽時`);
    return { ...base, resolved: parseTimeStr(solar), solar_time: solar };
  }
  return { ...base, resolved: base.dst_minutes ? shiftMinutes(clock, -base.dst_minutes) : clock, solar_time: null };
}
