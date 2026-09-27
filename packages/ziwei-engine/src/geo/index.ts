/**
 * 離線地點表：geo/geo_manager.py（GeographicDataManager）的對應物。
 *
 * Python 版只有 14 城離線座標，其餘每次上 Nominatim 查；本引擎把 geo-options 階層裡的
 * 每一城都在建置期查好，固定進 data/geo_cities.json（scripts/gen_ziwei_geo.py），
 * 執行期零網路。座標字串格式與 Python convert_to_astro_format 相同（'25n02, 121e33'）。
 */
import geoJson from "../data/geo_cities.json";

export interface GeoCity {
  continent: string; country: string; city: string;
  /** 'Taipei, Taiwan' */
  place_en: string;
  /** '25n02, 121e33' */
  coordinates: string;
  /** 'h8e' / 'h5w' */
  timezone: string;
}

const DATA = geoJson as unknown as {
  hierarchy: Record<string, Record<string, string[]>>;
  cities: Record<string, GeoCity>;
};

/** 洲 → 國家 → 城市（＝ GET /geo-options 的 hierarchy） */
export function geographicHierarchy(): Record<string, Record<string, string[]>> {
  return DATA.hierarchy;
}

/** 依中文城市＋國家查表；查不到回 null（呼叫端決定要不要退回鐘錶時） */
export function getGeoInfo(city: string, country: string): GeoCity | null {
  return DATA.cities[`${city.trim()}|${country.trim()}`] ?? null;
}

/** 所有城市（供搜尋／自動完成） */
export function allCities(): GeoCity[] {
  return Object.values(DATA.cities);
}

/** geo_manager.calculate_timezone：經度 → 'h8e'（自訂座標時用） */
export function calculateTimezone(lon: number): string {
  let off = Math.round(lon / 15);
  off = Math.max(-12, Math.min(14, off));
  if (off === 0) return "h0e";
  return off > 0 ? `h${off}e` : `h${Math.abs(off)}w`;
}

/** geo_manager.convert_to_astro_format：(25.033, 121.5654) → '25n02, 121e33'（分數截尾） */
export function toAstroFormat(lat: number, lon: number): string {
  const latAbs = Math.abs(lat), lonAbs = Math.abs(lon);
  const latDeg = Math.trunc(latAbs), lonDeg = Math.trunc(lonAbs);
  const latMin = Math.trunc((latAbs - latDeg) * 60), lonMin = Math.trunc((lonAbs - lonDeg) * 60);
  return `${latDeg}${lat >= 0 ? "n" : "s"}${String(latMin).padStart(2, "0")}, ${lonDeg}${lon >= 0 ? "e" : "w"}${String(lonMin).padStart(2, "0")}`;
}
