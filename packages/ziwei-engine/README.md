# @ows/ziwei-engine

紫微斗數排盤引擎，純 TypeScript、零 React、零 Node 專屬 API。瀏覽器、React Native、Node 三處可跑，
是 Python 引擎（P_Union `p01_count` / `p_d_graph_v3`，vendored 於 Polaris_Parent 後端）的一對一移植。

目標輸出契約就是 `@ows/ziwei-chart` 吃的 `RawChartJson` 與 `FlowData`，以及 `@ows/ziwei-app`
`astrology.ts` 的 `StarEnergyPayload` / `PalaceReadingsPayload`。**正確性由黃金檔逐張比對保證**：
Python 引擎是真相來源，本套件的每一層都和它的輸出逐碼、逐位元相等。

## 用法

```ts
import { calculateChart, buildV3Views } from "@ows/ziwei-engine";

const r = calculateChart({ year: 1980, month: 11, day: 17, hour: 10, minute: 0, gender: "男", name: "測試" });
r.chart_json          // → <ZiweiChart chart={r.chart_json} />
r.flow                // → parseFlow(r.flow)：大限 12 ／ 流年 120 ／ 小限 120
r.chart.chart_id      // 18 位字串，與 DB / API 相同
r.encoding            // 快速條件編碼（natal / decade / small_limit / year_flow）

// 真太陽時：離線地點表（geo-options 的每一城都查好了）
calculateChart({ ..., timeType: "solar_time", place: { city: "台北", country: "台灣" } });

// 星場能量卡與十二宮讀數（瀑布圖／熱力圖／弦圖／桑基）
const { star_energy, readings } = buildV3Views(r.encoding.natal_chart_encoding[0].encoded_array);
```

## 分層（對應 Python 子套件）

| 目錄 | 對應 | 內容 |
|---|---|---|
| `src/lunar/` | `p01_count/core/sxtwl_utils.py` | 農曆、干支、節氣（底層 lunar-typescript ＋ sxtwl 覆寫表） |
| `src/natal/` | `palace/*`、`stars/*`、`core/encoder.py` | 命身宮、十二宮、五虎遁宮干、五行局、安星、亮度、生年四化、本命編碼 v2.3 |
| `src/flow/` | `flow/*`、`core/encoder_flow.py`、site `flow_contract.py` | 大限／流年／小限資料、流盤編碼（含巢狀大限流曜與 T 四化 token）、FlowData 契約 |
| `src/convert/` | `convert/*` | encoded_array → chart_json（解碼、宮位地支環、宮干） |
| `src/starfield/` | `p_d_graph_v3/*` | 86 維星場、空劫衰減、影響矩陣、取樣鏡頭、四化場、能量卡與讀數視圖 |
| `src/solar/` | `solar/s3_solar_time.py` | NOAA 均時差真太陽時 |
| `src/geo/` | `geo/geo_manager.py` | 離線地點表（`data/geo_cities.json`） |
| `src/chartId.ts` | `core/id_generator.py` | sha256 命盤 ID |

## 黃金檔與測試

```
# 1. 由 Python 引擎產黃金檔（Python 改動安星規則後必跑）
venv\Scripts\python.exe scripts\gen_ziwei_golden.py        # lunar.csv ＋ 312 張盤（charts/*.json.gz）
venv\Scripts\python.exe scripts\gen_ziwei_geo.py           # geo_cities.json ＋ solar.json（Nominatim，約 6 分鐘）
node packages\ziwei-engine\scripts\gen-lunar-overrides.mjs # 重算農曆覆寫表

# 2. 跑 TS 測試
npm run test --workspace=@ows/ziwei-engine
```

| 測試 | 比對內容 |
|---|---|
| `lunar.test.ts` | 1900–2100 每一天（73,414 天）農曆年月日／閏月／月日干支／節氣／星期，往返轉換 |
| `natal.test.ts` | 312 張盤的曆法數據、基本資料、chart_id、本命 encoded_array 逐碼、chart_json 深比對 |
| `flow.test.ts` | 大限 12 筆全等；小限／流年 120 筆取樣全等 ＋ 全量 sha256 全等；FlowData 同 |
| `starfield.test.ts` | star_energy 與 readings 深比對（每個數字經 Python round 對齊） |
| `solar.test.ts` | 每城 × 5 個時刻的真太陽時與 Python 快照全等 |

## 已查明的差異（刻意保留）

- **2057 年九月（30 天）**：朔在 9-29 子夜前後，sxtwl 判初一為 9-28、lunar-typescript 為 9-29。
  DB 七萬張盤以 sxtwl 為準，引擎用 `src/lunar/overrides.json` 對齊。
- **1917-12-07、1927-09-08 的月干支**：節氣落在次日 00:00 後一分鐘內，sxtwl 提前一天換月干。
  月干支不進排盤，只在測試放行，不覆寫。
- `getMonthGzByYearGz` 沿用 Python 公式（非傳統五虎遁），宮干另由 `calculatePalaceGz` 實作。

## 兩邊不分岔的防線

Python 引擎每次改動後：重跑 `gen_ziwei_golden.py` → 跑 TS 測試。紅了就是 TS 沒跟上。
建議把這兩步接進 `scripts/publish_ziwei_engine.ps1`。
