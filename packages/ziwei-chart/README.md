# @ows/ziwei-chart

互動式紫微斗數命盤渲染引擎。framework-agnostic 純 TS 核心 ＋ React 綁定，供 OWS Polaris_Parent 前端（及未來其他載體）重用。

靜態出圖／下載／列印仍由後端 `p_e_artist`（P_Union）負責，本套件**不取代**它；兩者吃**同一份正規化命盤 JSON**（後端 `chart_to_artist_dict` 輸出），確保資料一致。

## 安裝

monorepo workspace，已列於根 `package.json` 與 `next.config.js` 的 `transpilePackages`。直接 import 即可。

## 使用

```tsx
import { ZiweiChart } from "@ows/ziwei-chart";

// chartJson 來自 POST /api/v1/astrology/calculate（帶 include_chart_json:true）回傳的 result.chart_json
<ZiweiChart chart={chartJson} />
```

### Props

| prop | 說明 | 預設 |
|---|---|---|
| `chart` | 正規化 chart_json（或已 `parseChart` 的 `ChartData`） | 必填 |
| `defaultAxisPalace` | 預設主軸宮位碼 | `"1"`（命宮） |
| `axisPalace` | 受控主軸宮位碼 | — |
| `layers` | 圖層開關（部分覆寫） | 見 `DEFAULT_LAYERS` |
| `theme` | 主題覆寫（深層合併進 `DEFAULT_THEME`） | — |
| `onPalaceClick` | 點宮位回呼 `(code) => void` | — |
| `showToolbar` | 顯示內建圖層開關列 | `true` |
| `showLegend` | 命盤下方顯示圖例（主星／輔星／四化） | `true` |

### 互動（v1）

- **點任一宮位 → 該宮變主軸**，三方四正參考線即時移動（CSS transition）。
- **資訊圖層開關**：三方四正 / 四化 / 小星（預設關）/ 流曜（有流盤資料才出現）。亮度、英文宮名仍可由 `layers` 開，但不在工具列。
- **定盤對照**：`<DefineChart charts={[{label, chart}, ...]} />` 並排相鄰時辰命盤。

### 定盤對照

```tsx
import { DefineChart } from "@ows/ziwei-chart";

<DefineChart
  charts={[
    { label: "前一時辰", chart: prevHourJson },
    { label: "本時辰",   chart: thisHourJson, current: true },
    { label: "後一時辰", chart: nextHourJson },
  ]}
  onSelect={(i) => {/* 採用此時辰 */}}
/>
```

## 純核心（無 React）

```ts
import { parseChart, GridLayout, computeSanfang, resolveTheme } from "@ows/ziwei-chart/core";
```

## 架構

```
src/
  core/      純 TS：constants / registry / theme / model / layout / sanfang
  react/     React 綁定：ZiweiChart / Palace / SanfangLines / StarIcon / Toolbar / DefineChart
  assets/    27+ 星曜 SVG（搬自 p_e_artist/assets/stars，由 @svgr 載入）
```

幾何與分類規則移植自 `P_Union/p_e_artist`（`charts/natal/layout.py`、`writers/svg_writer.py` 的 `_star_area`、`charts/natal/composer.py`、`theme.py`），**預設樣式＝書籍命盤（單盤 natal_default）**：宮位圖示、干支代號（`theme.layout.branchLabelStyle`：`code`＝A–J／01–12、`cn`＝中文）、四化紅色徽章貼星曜圖形下緣、副星 35px 補線寬、無小星文字、灰色三方四正虛線、中宮留白＋命盤 ID、下方圖例。

換星曜圖示時，把 SVG 與 `_bounds.json`（P_Union `p_e_artist/assets/gen_bounds.py` 量測）一起放進 `src/assets/stars/`，再跑 `npm run gen:stars`。

## 疊盤（大限／小限／流年）

傳入 `flow`（`/calculate` 帶流盤，或 `@ows/ziwei-engine` 的 `flow`）時，命盤上方出現疊盤切換：

- **三層各自開關**（大限綠／小限深藍／流年淺藍），全關＝本命單盤；開任一層即出現流年時間軸（預設今年），開大限時另列 12 個大限可跳轉。
- 版面＝書籍疊盤（PolarisUI `overlay_chart.py` → p_e_artist overlay）：本命星曜轉紅、表頭並排各層半寬宮位圖示、四化徽章依層序（本命→大限→小限→流年）貼星下、各層流曜以層色接在輔星網格，尺寸 60/34/16。
- **巢狀大限**（`nestedSihua`，預設開）：大限層關、小限或流年開時，仍帶所在大限的四化與流曜，但不畫大限宮名。
- 中宮顯示年份、虛歲、各層與配色說明（書籍的中宮內容卡原語）。
- 選層規則在 `core/overlay.ts`（`resolveOverlay`），可脫離 React 單獨使用；初始狀態用 `defaultOverlay`。
