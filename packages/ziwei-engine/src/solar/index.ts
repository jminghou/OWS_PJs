/**
 * 真太陽時：solar/s3_solar_time.py（SolarTimeCalculator）的對應物。
 *
 * 太陽時 = 鐘錶時 + (實際經度 − 時區中央經度) × 4 分 + 均時差（NOAA 演算法）。
 * 浮點運算順序照抄 Python；三角函數由各平台 libm 實作，理論上可能差 1 ulp，
 * 但只影響分鐘截斷的極端邊界（黃金檔 test/golden/solar.json 逐筆驗證）。
 */

export interface ClockTime { year: number; month: number; day: number; hour: number; minute: number }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_NUM: Record<string, number> = Object.fromEntries(MONTHS.map((m, i) => [m, i + 1]));

/** 'AWST h8e (is standard time)' / 'EST h5w' → [時區中央經度, 時差小時]（西經為負） */
export function parseTimezone(tz: string): [number, number] {
  if (!tz) return [0, 0];
  const m = tz.toLowerCase().match(/h(\d+(?:\.\d+)?)([we])/);
  if (!m) return [0, 0];
  const hours = parseFloat(m[1]);
  const lonOffset = hours * 15;
  return m[2] === "w" ? [-lonOffset, -hours] : [lonOffset, hours];
}

/** 'Taipei, Taiwan, 25n02, 121e33' → [lat, lon]（度＋分/60；南緯西經為負） */
export function parseCoordinates(place: string): [number, number] {
  if (!place) return [0, 0];
  let lat = 0, lon = 0;
  for (const raw of place.split(",")) {
    const part = raw.trim().toLowerCase();
    const la = part.match(/^(\d+)([ns])(\d+)?/);
    if (la) {
      lat = parseInt(la[1], 10) + (la[3] ? parseInt(la[3], 10) : 0) / 60.0;
      if (la[2] === "s") lat = -lat;
      continue;
    }
    const lo = part.match(/^(\d+)([we])(\d+)?/);
    if (lo) {
      lon = parseInt(lo[1], 10) + (lo[3] ? parseInt(lo[3], 10) : 0) / 60.0;
      if (lo[2] === "w") lon = -lon;
    }
  }
  return [lat, lon];
}

/** '25 December 2000 at 21:35(= 9:35 PM )' → ClockTime */
export function parseBornOn(s: string): ClockTime | null {
  const clean = s.replace(/\(.*?\)/g, "").trim();
  const m = clean.match(/^(\d+)\s+(\w+)\s+(\d+)\s+at\s+(\d+):(\d+)/);
  if (!m) return null;
  return { day: +m[1], month: MONTH_NUM[m[2]] ?? 1, year: +m[3], hour: +m[4], minute: +m[5] };
}

/** engine.build_clock_time_str：'17 November 1980 at 10:00' */
export function buildClockTimeStr(y: number, mo: number, d: number, h: number, mi: number): string {
  return `${d} ${MONTHS[mo - 1]} ${y} at ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/** engine.parse_time_str：'17 November 1980 at 10:00' → ClockTime */
export function parseTimeStr(s: string): ClockTime {
  const [datePart, timePart] = s.split(" at ");
  const [day, monthName, year] = datePart.split(" ");
  const [hour, minute] = timePart.split(":");
  return { year: +year, month: MONTH_NUM[monthName] ?? 1, day: +day, hour: +hour, minute: +minute };
}

const RAD = Math.PI / 180.0;
const DEG = 180.0 / Math.PI;

/** NOAA 均時差（分鐘）。與 Python _noaa_equation_of_time 逐步相同。 */
export function noaaEquationOfTime(year: number, month: number, day: number, hour: number, minute: number): number {
  const t = Date.UTC(year, month - 1, day, hour, minute);
  const epoch = Date.UTC(1900, 0, 1, 12, 0);
  const daysSinceEpoch = ((t - epoch) / 1000) / 86400.0;
  const julianDay = daysSinceEpoch + 2415020.5;
  const jc = (julianDay - 2451545.0) / 36525.0;
  const geomMeanLongSun = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const geomMeanAnomSun = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const eccent = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const sunEqOfCtr =
    Math.sin(geomMeanAnomSun * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * geomMeanAnomSun * RAD) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * geomMeanAnomSun * RAD) * 0.000289;
  void (geomMeanLongSun + sunEqOfCtr); // sun_true_long：Python 算了但未使用
  const omega = 125.04 - 1934.136 * jc;
  const meanObliq = 23 + (26 + ((21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813)))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(omega * RAD);
  const vary = Math.tan((obliqCorr / 2) * RAD) ** 2;
  const eot = 4 * ((
    vary * Math.sin(2 * (geomMeanLongSun * RAD)) -
    2 * eccent * Math.sin(geomMeanAnomSun * RAD) +
    4 * eccent * vary * Math.sin(geomMeanAnomSun * RAD) * Math.cos(2 * (geomMeanLongSun * RAD)) -
    0.5 * vary * vary * Math.sin(4 * (geomMeanLongSun * RAD)) -
    1.25 * eccent * eccent * Math.sin(2 * (geomMeanAnomSun * RAD))
  ) * DEG);
  return Number.isFinite(eot) ? eot : 0.0;
}

/**
 * 核心換算：鐘錶時 → 太陽時。
 * @param lon 出生地經度（東經正）
 * @param tzLon 時區中央經度（h8e → 120）
 */
export function clockToSolar(clock: ClockTime, lon: number, tzLon: number): ClockTime {
  const lonDiffMinutes = (lon - tzLon) * 4;
  const eot = noaaEquationOfTime(clock.year, clock.month, clock.day, clock.hour, clock.minute);
  const totalOffset = lonDiffMinutes + eot;
  // timedelta(minutes=float) 精度到微秒（四捨五入）；再截到分鐘
  const micro = Math.round(totalOffset * 60 * 1e6);
  const base = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute);
  const t = new Date(base + Math.floor(micro / 1000));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes() };
}

/**
 * engine.compute_solar_time 的字串版：('17 November 1980 at 10:00', 'Taipei, Taiwan, 25n02, 121e33', 'h8e')
 * → '17 November 1980 at 09:56'；輸入不合法回 null。
 */
export function computeSolarTimeStr(clockStr: string, placeWithCoords: string, timezone: string): string | null {
  const clock = parseBornOn(clockStr);
  if (!clock) return null;
  const [tzLon] = parseTimezone(timezone);
  const [, lon] = parseCoordinates(placeWithCoords);
  const s = clockToSolar(clock, lon, tzLon);
  return buildClockTimeStr(s.year, s.month, s.day, s.hour, s.minute);
}
