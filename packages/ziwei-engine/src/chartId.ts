/**
 * 命盤 ID：core/id_generator.py 的對應物。
 * 格式 YYYYMMDD(8) + 性別碼(1: 男1 女2) + 姓名 sha256 前 8 hex mod 1e9 (9) = 18 位。
 * 超過 2^53，一律以字串回傳（API 也是字串）。
 */
import { sha256 } from "js-sha256";

export function hashNameToInt(name: string): number {
  if (!name) throw new Error("姓名不能為空");
  const hex = sha256(name); // js-sha256 以 UTF-8 編碼字串
  return parseInt(hex.slice(0, 8), 16) % 1_000_000_000;
}

/**
 * @param birthDate "YYYY-MM-DD" 或 "YYYY,MM-DD"
 * @param gender 男/女/M/F
 * @param originalName 原名（空值丟錯，排盤層以「未命名」代入）
 */
export function generateChartId(birthDate: string, gender: string, originalName: string): string {
  if (!birthDate || !gender || !originalName) throw new Error("出生日期、性別、原名都不能為空");
  const m = birthDate.replace(",", "-").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error(`日期格式錯誤: ${birthDate}，應為 YYYY-MM-DD 或 YYYY,MM-DD`);
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`日期格式錯誤: ${birthDate}`);
  const g = gender.trim();
  let genderCode: number;
  if (g === "男" || g.toUpperCase() === "M") genderCode = 1;
  else if (g === "女" || g.toUpperCase() === "F") genderCode = 2;
  else throw new Error(`性別錯誤: ${gender}，應為 '男'、'女'、'M' 或 'F'`);
  const dateVal = `${y}${String(mo).padStart(2, "0")}${String(d).padStart(2, "0")}`;
  const hash = String(hashNameToInt(originalName)).padStart(9, "0");
  return `${dateVal}${genderCode}${hash}`;
}

export function parseChartId(chartId: string): { birthDate: string; genderCode: "m" | "f"; nameHash: string } {
  if (!/^\d{18}$/.test(chartId)) throw new Error(`無效的 chart_id 格式: ${chartId}`);
  const g = chartId[8];
  if (g !== "1" && g !== "2") throw new Error(`無效的 chart_id 格式: ${chartId}`);
  return {
    birthDate: `${chartId.slice(0, 4)}-${chartId.slice(4, 6)}-${chartId.slice(6, 8)}`,
    genderCode: g === "1" ? "m" : "f",
    nameHash: chartId.slice(9),
  };
}
