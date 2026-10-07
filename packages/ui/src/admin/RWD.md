# 後台 RWD 規範（手機版）

後台的新頁面與改版都照這份做。斷點用 Tailwind 預設：`< md (768px)` 是手機版型，`md–lg` 是平板，`≥ lg` 是桌機（桌機外觀不因手機版而改變）。

## 共用元件（`@ows/ui/admin`）

| 元件 | 什麼時候用 |
|---|---|
| `AdminListLayout` | 左清單＋右內容。傳 `mobileView`（`'list' \| 'detail'`）＋`onMobileBack` → 手機一次只顯示一邊；不傳 → 手機把側欄收成抽屜（適合「區塊導覽」型側欄，搭配 `mobileListLabel`、`closeDrawerOn`）。 |
| `AdminSheet` | 對話框。桌機置中，手機全螢幕（`mobile="full"`）或底部抽屜（`mobile="bottom"`）。有 `title`／`footer` slot、Esc 關閉。 |
| `AdminActionMenu` | 「⋯」列操作選單，取代 hover 才出現的按鈕。手機開成底部 ActionSheet。 |
| `AdminStickyFooter` | 長表單底部固定的儲存列（含 iOS safe-area）。 |
| `AdminResponsiveTable` | 欄位 ≥ 5 的表格：桌機 `<table>`，手機改成一筆一張卡（`renderCard`）。 |
| `useIsMobile` / `useIsBelowLg` / `useIsTouch`（`@ows/ui` hooks） | 只有非用 JS 不可時才用；版面切換優先用 Tailwind 斷點。 |

Studio 的 `StudioSplit` 是 `AdminListLayout` 的包裝，傳 `hasSelection`／`onMobileBack`。

## 規則

1. **操作永遠點得到**：不要只靠 hover 顯示按鈕。全域 CSS 已在觸控裝置把 `.group .group-hover:opacity-100` 改成常駐（`globals.css` 的 `.ows-admin` 區塊），但新寫的列操作請直接用 `AdminActionMenu`。也不要只靠右鍵（`onContextMenu`）。
2. **觸控目標 ≥ 40–44px**：icon 按鈕手機用 `p-2.5 -m-1.5 md:p-1 md:m-0` 這類寫法，視覺不變、點擊區放大。
3. **表單單欄**：`grid-cols-2/3` 一律寫成 `grid-cols-1 sm:grid-cols-2`；固定寬（`w-40`、`w-48`、`w-72`）改 `w-full sm:w-40`。兩個 `datetime-local` 不要在手機並排。
4. **側欄／面板不可固定寬度並排**：固定寬的左右欄在 `< lg` 要變抽屜或全螢幕覆蓋層（參考 Studio 工作台）。
5. **高度**：外殼用 `h-dvh`；頁面內用 `h-full min-h-0`／`flex-1 min-h-0`，不要再寫 `calc(100vh-…)`。
6. **工具列**：容器加 `flex-wrap`；手機只留 1–2 個主要動作，其他收進「⋯」。
7. **拖曳排序一定要有按鈕替代**（↑↓）；用 dnd-kit 時加 `TouchSensor`（delay 200ms）並給把手 `touch-none`。
8. **輸入框字級**：手機上 `.ows-admin` 內的 input／select／textarea 已統一 16px（避免 iOS 聚焦時放大畫面），不要用 `!text-xs` 之類去蓋掉。
9. **浮動選單**要夾在畫面內（`Math.min(left, innerWidth - 寬度)`），寬度用 `max-w-[calc(100vw-1.5rem)]`。

## 驗收

在 375×812、768×1024、1440×900 三種寬度看過：無水平捲軸、每個按鈕看得到且點得到、桌機版型沒變。
