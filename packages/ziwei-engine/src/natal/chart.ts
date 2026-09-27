/**
 * 本命盤組裝：function/rawdata.py get_all_data、function/lunar.py get_complete_lunar_info、
 * core/chart_calculator.py calculate_chart（本命部分）的對應物。
 *
 * 輸出物件沿用 Python 的中文鍵（曆法數據／命盤數據／宮位資料／星曜資料／星曜亮度／四化資料／
 * 基本資料／chart_id），讓黃金檔可以直接深比對，也讓編碼器一對一移植。
 */
import { generateChartId } from "../chartId";
import { BRANCHES, STEMS, calculateLunarDate, lunarToSolar } from "../lunar";
import { getPalaceInfo, organizePalaceInfo, type PalaceData, type PalaceInfo } from "./palaces";
import { getStarsInfo, type FourTransInfo, type StarsBrightness, type StarsInfo } from "./stars";
import { mod } from "./tables";

export interface NatalInput {
  year: number; month: number; day: number; hour: number; minute?: number;
  gender: "男" | "女";
  name?: string;
  birthplace?: string;
  /** 沿用 Python 預設 "solar_time"；API 端傳 "clock_time"。只進基本資料，不影響計算。 */
  timeType?: "solar_time" | "clock_time";
  /** 輸入為農曆時設 "lunar"，year/month/day 視為農曆並先轉西曆 */
  calendarType?: "solar" | "lunar";
  isLeapMonth?: boolean;
}

export interface CalendarData {
  太陽時間: string; 鐘錶時間: string; 農曆出生日期: string; 閏年: "是" | "否";
  出生時辰: string; 出生年干: string; 出生年支: string; 生年干支: string; 星期: string;
}

export interface ChartMeta {
  生肖: string; 星座: string; 陰陽: string; 身宮: string; 命主: string; 身主: string; 五行局: string;
}

export interface BasicInfo {
  命盤主: string; 原名: string; 中文名: string; 出生名: string; 性別: string;
  出生地: string; 經緯度: string; 時區: string; 時間類型: string;
}

export interface NatalChart {
  曆法數據: CalendarData;
  命盤數據: ChartMeta;
  宮位資料: PalaceData;
  星曜資料: StarsInfo;
  星曜亮度: StarsBrightness;
  四化資料: FourTransInfo;
  基本資料: BasicInfo;
  chart_id: string;
  /** 內部：流盤層需要的原始宮位資訊與曆法數字（不進 JSON 契約） */
  _palaceInfo: PalaceInfo;
  _lunar: { year: number; month: number; day: number; hourBranch: string; yearStem: string; yearBranch: string };
  _solar: [number, number, number, number, number];
}

const ZODIAC = ["鼠", "牛", "虎", "兔", "龍", "蛇", "馬", "羊", "猴", "雞", "狗", "豬"];
const LUNAR_MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

export function convertDayToChinese(day: number): string {
  if (day <= 10) return `初${CN_NUM[day]}`;
  if (day < 20) return `十${CN_NUM[day - 10]}`;
  if (day === 20) return "二十";
  if (day < 30) return `二十${CN_NUM[day - 20]}`;
  return "三十";
}

/** rawdata.convert_lunar_date_to_chinese：年干支由農曆年直接推（公元 4 年甲子），閏月不標。 */
export function lunarDateToChinese(ly: number, lm: number, ld: number): string {
  const off = ly - 4;
  const gz = STEMS[mod(off, 10)] + BRANCHES[mod(off, 12)];
  return `${gz}年${LUNAR_MONTH_NAMES[lm - 1]}月${convertDayToChinese(ld)}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
export const formatTimeString = (y: number, m: number, d: number, h: number, mi: number) =>
  `${y},${pad2(m)}-${pad2(d)},${pad2(h)}:${pad2(mi)}`;

export function buildNatalChart(input: NatalInput): NatalChart {
  let { year, month, day } = input;
  const hour = input.hour;
  const minute = input.minute ?? 0;
  if (input.calendarType === "lunar") {
    const s = lunarToSolar(year, month, day, !!input.isLeapMonth);
    ({ year, month, day } = s);
  }
  const gender = input.gender;
  const name = input.name || "未命名";

  const lunar = calculateLunarDate([year, month, day, hour, minute], gender);
  const [ly, lm, ld, lh] = lunar.lunarDate;
  const hourBranch = BRANCHES[lh];
  const yearGz = lunar.yearGz;
  const yearStem = yearGz[0];
  const yearBranch = yearGz[1];

  const palaceInfo = getPalaceInfo(lm, hourBranch, yearGz);
  const palaceData = organizePalaceInfo(palaceInfo);
  const [stars, brightness, fourTrans] = getStarsInfo(
    palaceInfo.五行局, ld, lm, hourBranch, yearStem, yearBranch, palaceInfo,
  );

  const timeStr = formatTimeString(year, month, day, hour, minute);
  const calendar: CalendarData = {
    太陽時間: timeStr,
    鐘錶時間: timeStr, // 無「原始出生日期／時間」時沿用計算時間（API 路徑即如此）
    農曆出生日期: lunarDateToChinese(ly, lm, ld),
    閏年: lunar.isLeapMonth,
    出生時辰: `${hourBranch}時`,
    出生年干: yearStem,
    出生年支: yearBranch,
    生年干支: yearGz,
    星期: lunar.weekDay,
  };
  const meta: ChartMeta = {
    生肖: ZODIAC[BRANCHES.indexOf(yearBranch)],
    星座: lunar.constellation,
    陰陽: lunar.yinYangGender,
    身宮: palaceInfo.身宮,
    命主: palaceInfo.命主,
    身主: palaceInfo.身主,
    五行局: palaceInfo.五行局,
  };
  const basic: BasicInfo = {
    命盤主: name, 原名: "", 中文名: "", 出生名: "", 性別: gender,
    出生地: input.birthplace || "", 經緯度: "", 時區: "", 時間類型: "",
  };
  const chartId = generateChartId(`${year}-${pad2(month)}-${pad2(day)}`, gender, name);

  return {
    曆法數據: calendar,
    命盤數據: meta,
    宮位資料: palaceData,
    星曜資料: stars,
    星曜亮度: brightness,
    四化資料: fourTrans,
    基本資料: basic,
    chart_id: chartId,
    _palaceInfo: palaceInfo,
    _lunar: { year: ly, month: lm, day: ld, hourBranch, yearStem, yearBranch },
    _solar: [year, month, day, hour, minute],
  };
}
