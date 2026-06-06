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

### 互動（v1）

- **點任一宮位 → 該宮變主軸**，三方四正參考線即時移動（CSS transition）。
- **資訊圖層開關**：三方四正 / 四化 / 小星 / 亮度 / 英文宮名。
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

幾何與分類規則移植自 `P_Union/p_e_artist`（`charts/natal/layout.py`、`writers/svg_writer.py`、`charts/natal/composer.py`、`theme.py`），力求與靜態 SVG 視覺對等。

## v2（未實作）

大限 / 流年 / 小限切換與流年四化：需後端把 flow 層也序列化成同一 schema 的疊加圖層（`engine/convert/` 擴充），前端 core 再加「作用層」狀態。
