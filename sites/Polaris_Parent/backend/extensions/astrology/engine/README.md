# 紫微斗數排盤引擎（vendored）

這個 `engine/` 目錄是從 **P_Union 正本**複製進來的排盤核心，供 Polaris_Parent 後端的
`astrology` extension 使用（`POST /api/v1/astrology/calculate`）。

> ⚠️ **vendored 子目錄是副本，不要直接改。** 正本在
> `D:\P_Polaris_Parent\1_run\P_Union`（`p01_count` / `p_e_artist` / …）。
> 直接改這些子目錄，下次跑同步腳本就會被覆蓋。
>
> 例外：本目錄的 `__init__.py`（對外介面 adapter）與 `README.md`（本檔）是**本專案自有**、
> 不從 P_Union 同步，publish 腳本不會動它們——要調整對外介面就改 `__init__.py`。

雲端（Railway）build 時**只看得到本 OWS repo**，看不到 P_Union——所以正本的修改
**不會自動上線**，一定要經過下面的同步 + 部署流程。

---

## 改命盤符號（或任何排盤邏輯）的三步驟

```
改正本  →  跑 publish  →  push OWS
```

### 1. 改正本
- 命盤星曜符號圖：`P_Union/p_e_artist/assets/stars/<星碼>.svg`
  （檔名必須等於星曜 3 碼代碼，例 `POL.svg`=紫微、`SUN.svg`=太陽；
  完整對照見 `P_Union/p_a_foundation/data/star_properties.csv` 的 `code,name`）
- 排盤計算邏輯：`P_Union/p01_count/...`

### 2. 跑同步腳本（把正本複製進本 repo）
```powershell
pwsh -File scripts/publish_ziwei_engine.ps1
```
腳本會重建整個 `engine/`、重套必要修補，並更新 `engine/VENDOR_VERSION.txt`（記錄來源 commit）。

### 3a. 本機測試
重啟後端即可（引擎與圖檔在進程內有快取，不重啟會沿用舊的）：
```powershell
flask --app "sites.Polaris_Parent.backend.app:app" run --port 5000
```
驗證：`GET /api/v1/astrology/health` 應回 `"engine_loaded": true`。

### 3b. 部署到線上
在 **OWS_PJs** repo：
```powershell
git add sites/Polaris_Parent/backend/extensions/astrology/engine
git commit -m "update ziwei star glyphs"
git push   # → Railway 自動 rebuild 上線
```

> **缺一不可**：少了 publish，OWS 不會有新圖；少了 push，雲端不會更新。

---

## 命盤符號 SVG 說明

- 位置：`engine/p_e_artist/assets/stars/*.svg`（29 個，檔名 = 星碼）。
- 用法：繪圖時每顆主星掛 `href="../assets/stars/<星碼>.svg"`，輸出時 `svg_writer`
  會把該檔**內嵌成巢狀 `<svg>`**（所以最終命盤自包含、可離線開、可下載 SVG/PNG）。
  找不到檔就 fallback 顯示文字代碼。目前只有**主星**用圖檔，副星為純文字。

### 設計替換圖的注意點
1. 保留 `<svg ... viewBox="…">` 外框（內嵌器讀 viewBox + 內部節點等比縮放）。
2. **避免 class／id 撞名**：內嵌後所有星圖的 `<style>` 會變成同一份 SVG 的全域樣式。
   現有檔多為單色 `.cls-1{fill:#050101}` 才沒衝突；做彩色/細緻圖請改用 inline `fill="…"`
   或獨一無二的 class/id 名（例如 `pol-1`）。
3. 想讓符號跟著主題上色，就別寫死 `fill`，留給 CSS class 控制。

---

## 目錄結構（vendored 內容）

| 路徑 | 來源 | 用途 |
|---|---|---|
| `p01_count/` | P_Union/p01_count | 排盤計算 `calculate_chart` |
| `p_e_artist/` | P_Union/p_e_artist | 十二宮方圖 SVG/HTML 繪圖（含 `assets/stars/`、`themes/`）|
| `solar/` | 02_scraper_updated/s3_solar_time.py | 真太陽時換算 |
| `geo/` | 04_ui_web/geo_manager.py | 地點→經緯度 / 級聯選項 |
| `p_a_foundation/`, `p_d_graph/` | （最小集）| 繪圖用的編碼↔名稱對照 |
| `convert/` | p_d_graph bridge/exporter | encoded_array → p_e_artist 格式 |
| `__init__.py` | （本專案）| 對外乾淨介面（calculate / render_natal_svg / get_geo_info …）|
| `VENDOR_VERSION.txt` | publish 腳本產生 | 記錄來源與同步時間 |

依賴（已列於 `sites/Polaris_Parent/backend/requirements.txt`）：`sxtwl`、`python-dateutil`、`requests`。
