# 親紫之間 Polaris Parent — 品牌視覺規範（給 LLM 的實作規格）

> 版本 v3 · 2026-10-05
> 適用範圍：`sites/Polaris_Parent/frontend` 的公開網站（不含後台 admin）。
> 技術：Next.js（App Router）+ Tailwind CSS。
> 本文件是設計的**唯一依據**。遇到本文件沒寫到的情況，從現有規則推得出答案就照推；推不出來就**不要自創**，在 PR / 回覆裡標註「規範未定義」。

---

## 0. 給 LLM 的工作守則（先讀）

1. **只使用本文件定義的色彩、字體、圓角、間距、陰影變數**。不寫任意 hex、不寫 `rounded-[13px]` 這類任意值。
2. **淘汰舊色**：`brand-purple-*` 和 `warm-*` 已停用，新程式碼禁止使用；修改舊元件時一併換成新色。
3. 實作前先檢查第 9 章的「驗收清單」，完成後逐條自查。
4. 文案語氣：溫暖、陪伴、不下定論。不寫「命中註定」「算命」「準到可怕」這類用語。
5. 不要用 emoji 當圖示；圖示使用 Lucide（`lucide-react`），線寬 2，圓角端點。

---

## 1. 品牌核心

- 一句話：**以紫微斗數為線索，陪你重新讀懂他。**
- 受眾：25–45 歲重視教養的父母，以母親為主。
- 三個性格關鍵字 → 對應的視覺決策：
  - **溫暖**：暖白底（`paper`）、圓潤造型、柔和陰影。
  - **好奇**：藍、粉兩色當「跳色」，只出現在需要注意的地方。
  - **不下定論**：不用紫色、星空、八卦、水晶球、神祕漸層等算命視覺套路。

---

## 2. Logo

檔案（放在 `public/brand/`）：

| 檔名 | 用途 |
| --- | --- |
| `logo-qinzi-brand.svg` | 全彩（左藍 #0967E7、右粉 #FF0084）。預設版本 |
| `logo-qinzi-white.svg` | 全白反白，用在品牌藍底 |
| `logo-qinzi-ink.svg` | 單色墨 #1F2333，用在品牌粉底、輔助色底、單色印刷 |

### 2.1 組合版本
- **A 橫式（標準）**：圖形在左、中文字標「親紫之間」在右，字標用 `font-heading`、`color: ink`、`letter-spacing: .06em`。可加英文副標「POLARIS PARENT」（`font-latin`、12px、`letter-spacing: .2em`、`color: muted`）。用在頁首、頁尾、電子報抬頭。
- **B 直式**：圖形在上、字標置中在下。用在報告封面、正方形版位。
- **C 單圖形**：只有兩隻青蛙。用在 favicon、社群頭像。

### 2.2 背景對應
| 背景 | 使用的 Logo |
| --- | --- |
| 白 / 暖白 / 墨 `#1F2333` | 全彩 |
| 品牌藍 `#0967E7` | 反白 |
| 品牌粉 `#FF0084`、輔助色淡底 | 單色墨 |
| 照片 | 只能放在照片的大片乾淨區域；不行就改放在白色膠囊底上 |

### 2.3 規則
- 安全距離：四周至少留**一個青蛙眼睛的寬度**（約為圖形高度的 1/4）。
- 最小尺寸：橫式組合 ≥ 120px 寬；單圖形 ≥ 32px；favicon 例外，可用 16px。
- **禁止**：對調左右兩色、拉伸壓扁、旋轉、換色或套 filter、加陰影外框發光、拆開兩隻青蛙單獨使用、放在雜亂背景上。
- 程式寫法：`<Image src="/brand/logo-qinzi-brand.svg" alt="親紫之間" />`，一律保持原始長寬比（只設 width 或只設 height）。

---

## 3. 色彩

### 3.1 品牌色（跳色）
兩個品牌色**不是大面積主色**，而是「跳色」：只出現在使用者該注意的地方。

**青蛙藍 Frog Blue `#0967E7`**：負責**行動**，用在主要按鈕、連結、選中狀態、資訊提示，以及標題裡的重點字。

| step | hex | 用途 |
| --- | --- | --- |
| 50 | `#EEF5FF` | 標籤底、資訊提示底、選中底 |
| 100 | `#DCEAFF` | focus 外圈 |
| 200 | `#B5D3FF` | 插畫、裝飾 |
| 300 | `#7FB2FB` | 插畫 |
| 400 | `#3D8AF2` | 漸層亮端 |
| **500** | **`#0967E7`** | **品牌本色** |
| 600 | `#0753BD` | hover（平塗元素） |
| 700 | `#064196` | pressed |
| 800 | `#08326F` | 淡藍底上的文字 |
| 900 | `#0B2349` | 極深文字 |

**青蛙粉 Frog Pink `#FF0084`**：負責**情感上的重點**，用在新文章、優惠、電子報、裝飾點綴，以及標題裡的重點字。

| step | hex | 用途 |
| --- | --- | --- |
| 50 | `#FFF0F7` | 標籤底、電子報區塊底 |
| 100 | `#FFDCEC` | 淡底 |
| 200 | `#FFB3D6` | 文字螢光筆標記、插畫 |
| 300 | `#FF7AB8` | 裝飾 |
| 400 | `#FF3D9B` | 漸層亮端 |
| **500** | **`#FF0084`** | **品牌本色** |
| 600 | `#D6006F` | **粉色小字一律用這個** |
| 700 | `#A8005A` | pressed |
| 800 | `#7A0743` | 淡粉底上的文字 |
| 900 | `#4D0A2D` | 極深文字 |

### 3.2 基礎色（佔畫面絕大部分）
| token | hex | 用途 |
| --- | --- | --- |
| `ink` | `#1F2333` | 標題、字標、深色區塊、頁尾底 |
| `text` | `#4B5063` | 段落內文 |
| `muted` | `#6B7084` | 日期、註解、placeholder |
| `line-strong` | `#C6C9D4` | 輸入框邊框 |
| `line` | `#E3E5EE` | 分隔線、卡片邊 |
| `tint` | `#F3F1EC` | 交替區塊底 |
| `paper` | `#FCFAF6` | **頁面底色**（body） |
| `surface` | `#FFFFFF` | 卡片、表單、頁首 |

### 3.3 輔助色（只用在插畫、圖示、標籤，禁止用在按鈕和連結上）
| token | 100 | 500 | 800 | 用途 |
| --- | --- | --- | --- | --- |
| `star` 星光黃 | `#FFF4D6` | `#FFC23D` | `#8A5A00` | 星曜圖示、評分、「熱門」 |
| `leaf` 荷葉綠 | `#DCF5EA` | `#21B07A` | `#0F6646` | 年齡段標籤、成長主題 |

### 3.4 語意色（系統回饋專用）
| 狀態 | 主色 | 底 | 字 |
| --- | --- | --- | --- |
| success | `#1F9D68` | `#DCF5EA` | `#0F6646` |
| warning | `#E09B00` | `#FFF4D6` | `#8A5A00` |
| error | `#E0482A` | `#FDEBE6` | `#9C2A14` |
| info | `#0967E7` | `#EEF5FF` | `#08326F` |

> 錯誤色刻意偏橘紅，跟品牌粉拉開距離。**禁止用品牌粉表示錯誤。**

### 3.5 面積比例
`paper / surface` 70% · `ink / text` 20% · 藍 約 6% · 粉 約 4%。
- 一屏之中，粉色面積不超過藍色的一半。
- 藍、粉**不可直接相鄰**，中間必須隔著白、暖白或墨。

### 3.6 對比（WCAG 2.1 AA）
| 組合 | 對比 | 規則 |
| --- | --- | --- |
| ink on white | 15.8:1 | 任何尺寸 |
| text on white | 8.1:1 | 任何尺寸 |
| muted on white | 4.9:1 | 任何尺寸，但不要用在主要內容 |
| white on blue-500 | 5.1:1 | 任何尺寸 |
| blue-500 on white | 5.1:1 | 連結可用 |
| ink on pink-500 | 4.2:1 | **只限 16px 粗體以上**（按鈕文字 OK） |
| pink-500 on white | 3.8:1 | **只限 24px 以上的標題重點字** |
| pink-600 on white | 5.1:1 | 粉色小字一律用這個 |
| white on pink-500 | 3.7:1 | **禁止**：粉底上的文字一律用 ink |

---

## 4. 字體

| 角色 | 字體 | 字重 | 用在 |
| --- | --- | --- | --- |
| `font-heading` | **粉圓 Huninn**（Google Fonts），備援 Zen Maru Gothic | 只有 400 | 所有 h1–h4、卡片標題、引言、Logo 字標 |
| `font-body` | **思源黑體 Noto Sans TC**，備援微軟正黑體 | 400 / 500 / 700 | 段落、按鈕、表單、導覽、標籤 |
| `font-latin` | **Archivo** | 400 / 600 / 800 | 價格、日期、編號、英文小標 |

- **粉圓只有一種字重，禁止對標題加 `font-bold`**（瀏覽器會假粗體，很醜）。
- 現有設定的拉丁字 Inter 停用，改用 Archivo；中文改為 Noto Sans TC 優先。
- 載入方式：`next/font/google`，`Huninn`、`Noto_Sans_TC`、`Archivo`，`display: 'swap'`，分別掛到 CSS 變數 `--font-huninn`、`--font-noto`、`--font-archivo`。

### 4.1 字級（桌面 / 手機）
| 名稱 | 桌面 | 手機 | 行高 | 字體 |
| --- | --- | --- | --- | --- |
| display | 56px | 40px | 1.25 | heading |
| h1 | 44px | 32px | 1.3 | heading |
| h2 | 34px | 26px | 1.35 | heading |
| h3 | 26px | 22px | 1.4 | heading |
| h4（卡片標題） | 20px | 18px | 1.45 | heading |
| lead（導言） | 19px | 17px | 1.8 | body 400，color text |
| body | 17px | 16px | 1.85 | body 400，color text |
| small | 14px | 14px | 1.7 | body |
| caption | 13px | 12px | 1.6 | body，color muted |

手機斷點以 `md`（768px）為界：`text-[26px] md:text-[34px]` 這種寫法改用第 8 章定義的 `text-h2` 等 utility。

### 4.2 排版規則
- 標題本體用 `ink`。**每個標題最多一處跳色**，長度 2–6 個字，用 `<span class="text-blue-500">` 或 `text-pink-500`（≥24px 才能用 pink-500）。同一個標題不可同時出現藍和粉。
- 文章內文最大寬度 `max-w-[640px]`（每行約 28–36 個全形字）。
- 段落間距 1em；標題上方空白是下方的 2 倍。
- 一律使用全形標點，引號用「」『』。
- 中文和英文、數字之間加半形空格；數字用 `font-latin`。
- 內文靠左對齊，禁止左右對齊（justify）。只有短的大標可以置中。
- 所有標題和段落加 `text-wrap: pretty`（Tailwind：`[text-wrap:pretty]`）。

### 4.3 文章內頁（`@tailwindcss/typography`）
`prose` 需覆寫成：h2/h3 用 `font-heading`、`font-normal`、`color ink`；連結 `blue-500`，hover 變 `pink-600`，底線 offset 3px；`blockquote` 改成 `bg-blue-50 text-blue-800 rounded-[20px] px-6 py-5 font-heading not-italic border-0`；`mark` 用 `background: linear-gradient(transparent 60%, #FFB3D6 60%)`。

---

## 5. 形狀、間距、陰影

造型從 Logo 青蛙的圓胖輪廓延伸：**沒有尖角**，外框越大圓角越大，內層的圓角比外層小一階。

### 5.1 圓角
| token | 值 | 用途 |
| --- | --- | --- |
| `rounded-xl2` | 40px | 大區塊、Hero 容器 |
| `rounded-card` | 32px | 卡片（現有的 `--radius-banner` 也改成 32px） |
| `rounded-inner` | 20px | 卡片內的圖片、提示框、內層容器 |
| `rounded-sm2` | 12px | 小型元件、checkbox 外框（checkbox 本體 7px） |
| `rounded-full` | 9999px | 按鈕、標籤、導覽項目、膠囊輸入框 |
| 輸入框 | 16px | 一般文字輸入框 |

**禁止直角**（`rounded-none`），只有表格內部的格線可以是直的。

### 5.2 間距（8px 基準）
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`（對應 Tailwind `1 2 3 4 6 8 12 16 24`）。
- 圖示與文字 4–8；標籤之間 8；卡片之間 16（手機）/ 24（桌面）。
- 卡片內距 24（手機）/ 32（桌面）。
- 區塊上下間距 64（手機）/ 96（桌面）。

### 5.3 陰影（帶藍色調，很輕）
| token | 值 | 用途 |
| --- | --- | --- |
| `shadow-sm` | `0 2px 6px rgba(9,40,100,.06)` | 卡片預設（可省略） |
| `shadow-md` | `0 10px 30px rgba(9,40,100,.10)` | 卡片 hover |
| `shadow-lg` | `0 24px 60px rgba(9,40,100,.16)` | 彈窗、下拉選單 |

分層**優先用底色**（白卡片放在暖白底上），陰影只用來表現 hover 和浮層。

### 5.4 網格
- 內容最大寬度 1200px，左右留白 24px（手機 16px）。
- 桌面 12 欄、平板 8 欄、手機 4 欄；欄距 24px（手機 16px）。

---

## 6. UI 元件

### 6.1 按鈕
所有按鈕：膠囊形（`rounded-full`）、`font-body font-bold`、**無邊框、無底部厚邊**、文字不折行（`whitespace-nowrap`）。漸層一律 **135° 斜向，在 45–55% 之間明顯轉深**。

| 變體 | 背景 | 文字 | 用途 |
| --- | --- | --- | --- |
| `primary` 主要 | `linear-gradient(135deg,#5AA0FF 0%,#2A7CF3 45%,#0967E7 55%,#0546A8 100%)` | white | 最重要的行動。**每屏最多一個** |
| `accent` 強調 | `linear-gradient(135deg,#FF6BB5 0%,#FF2D97 45%,#FF0084 55%,#E6007A 100%)` | **ink**（禁止白字） | 情感型行動：訂閱電子報、限時優惠 |
| `secondary` 次要 | `linear-gradient(135deg,#565D7A 0%,#3A3F58 45%,#1F2333 55%,#0E1120 100%)` | white | 一般行動：閱讀全文 |
| `soft` 柔和 | `linear-gradient(135deg,#FFFFFF 0%,#F6F3EC 45%,#E9E4D8 55%,#DDD6C6 100%)` | ink | 輔助行動：了解我們、逛逛專欄 |
| `link` 文字連結 | 透明 | blue-500，hover pink-600 | 「繼續閱讀 →」 |

狀態：
- hover：`filter: brightness(1.08)`（secondary 1.15、accent 1.06、soft 0.97）＋ `shadow-md`
- pressed（`:active`）：`filter: brightness(.9)`
- focus-visible：`box-shadow: 0 0 0 4px #DCEAFF`（`ring-4 ring-blue-100`），不要用瀏覽器預設外框
- disabled：背景 `line` `#E3E5EE`、文字 `muted`，**移除漸層**，`cursor-not-allowed`
- transition：`filter, box-shadow 150ms ease-out`

尺寸：
| size | 高度 | 左右內距 | 字級 |
| --- | --- | --- | --- |
| L | 56px | 30px | 17px |
| M（預設） | 48px | 24px | 15px |
| S | 36px | 16px | 14px |

手機上可點擊範圍至少 44px（S 尺寸在手機上要加大點擊區）。尾端箭頭用 Lucide `ArrowRight` 16px，`gap-2`。

### 6.2 標籤 Tag
膠囊、`text-[13px] px-3 py-1.5`、無邊框。依語意選顏色，**一張卡片最多兩個標籤**：
| 語意 | class |
| --- | --- |
| 分類（命宮、親子溝通、親紫專欄） | `bg-blue-50 text-blue-800` |
| 狀態（新文章、限時） | `bg-pink-50 text-pink-800` |
| 年齡段（學齡前、國小） | `bg-leaf-100 text-leaf-800` |
| 熱度（★ 熱門） | `bg-star-100 text-star-800` |
| 篩選、未選中 | `bg-white border-[1.5px] border-line-strong text-ink` |
| 篩選、選中 | `bg-blue-500 text-white font-bold` |

### 6.3 表單
- 文字輸入框：`rounded-2xl`（16px）、`border-[1.5px] border-line-strong`、`px-[18px] py-[13px]`、`text-base text-ink`、placeholder `muted`。
- focus：`border-blue-500` ＋ `ring-4 ring-blue-100`。
- error：`border-error bg-error-bg`，下方說明 `text-[13px] text-error-fg`。
- label：`text-sm font-medium text-ink`，與輸入框間距 6px。
- 單選（例：男孩 / 女孩）用膠囊按鈕組；選中狀態 `bg-blue-500 text-white`。
- checkbox：22px、`rounded-[7px]`、勾選時 `bg-blue-500` 加白色勾。
- 膠囊式單行輸入框（電子報）：外層 `bg-white rounded-full p-[5px] flex`，內含無邊框 input 加右側 S/M 按鈕。

### 6.4 提示框 Alert
`rounded-[20px] px-[18px] py-[14px] text-sm leading-relaxed flex gap-3`，底和字依 3.4 語意色。開頭用 Lucide 圖示：`CheckCircle2` / `AlertTriangle` / `XCircle` / `Info`。

### 6.5 卡片
共通：`rounded-card`，無邊框，白卡片放在暖白底上。

- **文章卡**：白底、`overflow-hidden`；圖片放在卡片內，`m-3 rounded-[24px]`，比例 16:10 或 1:1；內容 `px-6 pt-4 pb-6 flex flex-col gap-2.5`，依序是標籤＋日期（caption、Archivo）、標題（h4、heading、最多 2 行 `line-clamp-2`）、摘要（small、text、最多 2 行）、文字連結「繼續閱讀 →」。hover 時 `shadow-md`、圖片 `scale-[1.03]`（transition 300ms）。
- **報告卡（商品）**：`bg-ink text-white p-7`；頂部可放 accent 小標籤「最多人選」（`bg-pink-500 text-ink`）；標題 heading 24px；說明 `#D5D7E0`；勾選清單；底部價格（Archivo 800、30px）＋ primary 按鈕。**一頁最多一張墨底報告卡**，其他方案用白卡。
- **電子報卡**：`bg-pink-50 p-7`；可放單圖形 Logo 72px；標題 heading 24px；膠囊輸入框搭配 accent 按鈕。

### 6.6 導覽列 Header
- `bg-white`、`border-b border-line`、高度 72px，sticky top 時加 `shadow-sm`。
- 左：橫式 Logo（圖形 58px ＋ 字標 heading 19px）。
- 右：導覽項目是膠囊 `px-3.5 py-2 text-[15px] font-medium text-ink rounded-full`，hover `bg-tint`；**目前頁面** `bg-blue-50 text-blue-800`。
- 最右邊 CTA「立即排盤」：primary 按鈕 S 尺寸。
- 項目順序固定：首頁 · 關於我們 · 購買報告 · 親紫專欄 · 電子報 ·［立即排盤］
- 手機（< md）：收成漢堡選單（Lucide `Menu`），展開成全螢幕白底面板，項目 18px、間距 8px，CTA 放在最下方並改成 L 尺寸、滿版寬。

### 6.7 頁尾 Footer
`bg-ink text-[#D5D7E0] py-10`；左側全彩 Logo（墨底可用全彩）＋品牌一句話；右側分欄連結，欄標題白色粗體；底部 copyright 用 Archivo 12px、`#A9ADBD`。

---

## 7. 版面與頁面

### 7.1 區塊節奏
頁首（surface）→ Hero（paper）→ 內容區塊在 surface / paper / tint 之間交替 → 頁尾（ink）。
**禁止**：區塊背景用漸層、整塊品牌藍或品牌粉當大面積背景（電子報卡的 pink-50 淡底除外）。

### 7.2 Hero（首頁首屏）
兩欄（≥ md）／單欄（手機，圖在下）。
- 左欄：小標籤（pink 狀態色，例「紫微斗數 × 親子教養」）→ display 標題（重點字 1 處跳藍）→ lead 段落（`max-w-[460px]`）→ 按鈕組（primary ＋ soft，`gap-3`）。
- 右欄：圖片 `rounded-[48px]`，高 400px（手機 280px），`object-cover`。

### 7.3 各頁重點
| 頁面 | 結構重點 |
| --- | --- |
| 首頁 | Hero → 服務介紹（3 欄白卡）→ 最新專欄（文章卡 3 欄）→ 報告方案（報告卡）→ 電子報卡 |
| 關於我們 | h1 ＋ lead → 理念（引言 blockquote 樣式）→ 團隊（圓角照片＋姓名，照片 `rounded-[32px]`） |
| 購買報告 | 方案比較（最多 3 張卡，主推用墨底報告卡）→ 流程步驟（數字用 Archivo 800 + blue-500）→ FAQ（手風琴，每項白卡 `rounded-[20px]`） |
| 親紫專欄 | 篩選標籤列（6.2 篩選樣式）→ 文章卡網格（桌面 3 欄 / 平板 2 / 手機 1）→ 載入更多（soft 按鈕） |
| 文章內頁 | 標籤＋日期 → h1 → 封面圖 `rounded-[32px]` → prose（4.3）→ 文末電子報卡 → 相關文章 |
| 電子報 | Hero 變體：左 h1 ＋說明，右大型電子報卡；下方往期列表 |

### 7.4 圖片
- 一律圓角，依所在層級：卡片內 24px、獨立大圖 32–48px。
- 風格：溫暖、自然光、真實的親子互動。**禁止**星空、塔羅、水晶球、霓虹、紫色調濾鏡。
- 圖片不加邊框、不加陰影。

### 7.5 動態
- 時間 150–300ms，`ease-out`。
- 只用在 hover、展開收合、頁面進場淡入（`opacity` ＋ `translateY(8px)`）。
- 必須尊重 `prefers-reduced-motion: reduce`（關閉位移動畫）。

---

## 8. 實作變數

### 8.1 `src/app/globals.css`（加在 `:root`）
```css
:root {
  /* 品牌色 */
  --blue-50:#eef5ff; --blue-100:#dceaff; --blue-200:#b5d3ff; --blue-300:#7fb2fb; --blue-400:#3d8af2;
  --blue-500:#0967e7; --blue-600:#0753bd; --blue-700:#064196; --blue-800:#08326f; --blue-900:#0b2349;
  --pink-50:#fff0f7; --pink-100:#ffdcec; --pink-200:#ffb3d6; --pink-300:#ff7ab8; --pink-400:#ff3d9b;
  --pink-500:#ff0084; --pink-600:#d6006f; --pink-700:#a8005a; --pink-800:#7a0743; --pink-900:#4d0a2d;
  /* 基礎色 */
  --ink:#1f2333; --text:#4b5063; --muted:#6b7084; --line-strong:#c6c9d4; --line:#e3e5ee;
  --tint:#f3f1ec; --paper:#fcfaf6; --surface:#ffffff;
  /* 輔助色 */
  --star-100:#fff4d6; --star-500:#ffc23d; --star-800:#8a5a00;
  --leaf-100:#dcf5ea; --leaf-500:#21b07a; --leaf-800:#0f6646;
  /* 語意色 */
  --success:#1f9d68; --success-bg:#dcf5ea; --success-fg:#0f6646;
  --warning:#e09b00; --warning-bg:#fff4d6; --warning-fg:#8a5a00;
  --error:#e0482a;   --error-bg:#fdebe6;   --error-fg:#9c2a14;
  /* 按鈕漸層 */
  --btn-primary:linear-gradient(135deg,#5aa0ff 0%,#2a7cf3 45%,#0967e7 55%,#0546a8 100%);
  --btn-accent:linear-gradient(135deg,#ff6bb5 0%,#ff2d97 45%,#ff0084 55%,#e6007a 100%);
  --btn-secondary:linear-gradient(135deg,#565d7a 0%,#3a3f58 45%,#1f2333 55%,#0e1120 100%);
  --btn-soft:linear-gradient(135deg,#ffffff 0%,#f6f3ec 45%,#e9e4d8 55%,#ddd6c6 100%);
  /* 形狀 */
  --radius-banner:32px;
  --shadow-sm:0 2px 6px rgba(9,40,100,.06);
  --shadow-md:0 10px 30px rgba(9,40,100,.10);
  --shadow-lg:0 24px 60px rgba(9,40,100,.16);
}
body { background: var(--paper); color: var(--ink); font-family: var(--font-noto), "Microsoft JhengHei", system-ui, sans-serif; }
a { color: var(--blue-500); text-underline-offset: 3px; }
a:hover { color: var(--pink-600); }
::selection { background: var(--blue-100); color: var(--ink); }
```
> 注意：既有的 shadcn 變數（`--primary` 等）是 HSL 格式，後台仍在使用，**不要刪除**。公開網站的元件改用上面的新變數。

### 8.2 `tailwind.config.ts`（加進 `theme.extend`）
```ts
fontFamily: {
  heading: ['var(--font-huninn)', '"Zen Maru Gothic"', 'sans-serif'],
  body: ['var(--font-noto)', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
  latin: ['var(--font-archivo)', 'sans-serif'],
},
colors: {
  blue: { 50:'#eef5ff',100:'#dceaff',200:'#b5d3ff',300:'#7fb2fb',400:'#3d8af2',500:'#0967e7',600:'#0753bd',700:'#064196',800:'#08326f',900:'#0b2349' },
  pink: { 50:'#fff0f7',100:'#ffdcec',200:'#ffb3d6',300:'#ff7ab8',400:'#ff3d9b',500:'#ff0084',600:'#d6006f',700:'#a8005a',800:'#7a0743',900:'#4d0a2d' },
  ink:'#1f2333', text:'#4b5063', muted:'#6b7084',
  line:{ DEFAULT:'#e3e5ee', strong:'#c6c9d4' },
  tint:'#f3f1ec', paper:'#fcfaf6', surface:'#ffffff',
  star:{ 100:'#fff4d6', 500:'#ffc23d', 800:'#8a5a00' },
  leaf:{ 100:'#dcf5ea', 500:'#21b07a', 800:'#0f6646' },
  success:{ DEFAULT:'#1f9d68', bg:'#dcf5ea', fg:'#0f6646' },
  warning:{ DEFAULT:'#e09b00', bg:'#fff4d6', fg:'#8a5a00' },
  error:{ DEFAULT:'#e0482a', bg:'#fdebe6', fg:'#9c2a14' },
},
backgroundImage: {
  'btn-primary':'var(--btn-primary)', 'btn-accent':'var(--btn-accent)',
  'btn-secondary':'var(--btn-secondary)', 'btn-soft':'var(--btn-soft)',
},
borderRadius: { xl2:'40px', card:'32px', inner:'20px', sm2:'12px' },
boxShadow: {
  sm:'0 2px 6px rgba(9,40,100,.06)',
  md:'0 10px 30px rgba(9,40,100,.10)',
  lg:'0 24px 60px rgba(9,40,100,.16)',
},
fontSize: {
  display:['56px',{ lineHeight:'1.25' }], h1:['44px',{ lineHeight:'1.3' }],
  h2:['34px',{ lineHeight:'1.35' }], h3:['26px',{ lineHeight:'1.4' }], h4:['20px',{ lineHeight:'1.45' }],
  lead:['19px',{ lineHeight:'1.8' }], body:['17px',{ lineHeight:'1.85' }],
  small:['14px',{ lineHeight:'1.7' }], caption:['13px',{ lineHeight:'1.6' }],
},
maxWidth: { content:'1200px', prose:'640px' },
```
> 注意：覆寫 `blue` / `pink` 會取代 Tailwind 預設色階，這是刻意的，用來避免誤用預設藍。`brand-purple`、`warm` 先保留定義讓舊頁面不壞，但標記為 deprecated，逐頁移除。
> 手機字級：`text-[40px] md:text-display`、`text-[32px] md:text-h1`、`text-[26px] md:text-h2`、`text-[22px] md:text-h3`、`text-[18px] md:text-h4`。

### 8.3 按鈕元件參考（`src/components/ui/BrandButton.tsx`）
```tsx
import { cva, type VariantProps } from 'class-variance-authority'

export const brandButton = cva(
  'inline-flex items-center gap-2 whitespace-nowrap rounded-full font-body font-bold border-0 ' +
  'transition-[filter,box-shadow] duration-150 ease-out hover:shadow-md active:brightness-90 ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ' +
  'disabled:bg-none disabled:bg-line disabled:text-muted disabled:shadow-none disabled:cursor-not-allowed disabled:brightness-100',
  {
    variants: {
      variant: {
        primary:   'bg-btn-primary text-white hover:brightness-[1.08]',
        accent:    'bg-btn-accent text-ink hover:brightness-[1.06]',
        secondary: 'bg-btn-secondary text-white hover:brightness-[1.15]',
        soft:      'bg-btn-soft text-ink hover:brightness-[.97]',
      },
      size: {
        L: 'h-14 px-[30px] text-[17px]',
        M: 'h-12 px-6 text-[15px]',
        S: 'h-9 px-4 text-[14px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'M' },
  }
)
export type BrandButtonProps = VariantProps<typeof brandButton>
```
（若專案沒有 `class-variance-authority`，改用簡單的 variant 物件對照表，輸出的 class 相同。）

---

## 9. 驗收清單（每次交付前逐條自查）

- [ ] 沒有使用 `brand-purple-*`、`warm-*`、任意 hex 或 Tailwind 預設色。
- [ ] 每屏最多一個 primary 按鈕；粉色面積小於藍色的一半。
- [ ] 藍、粉沒有直接相鄰。
- [ ] 所有標題都用 `font-heading` 而且沒有加粗；標題跳色最多一處、最多 6 個字。
- [ ] 粉底上的文字是 ink；粉色小字用 pink-600。
- [ ] 沒有直角的卡片、按鈕或圖片。
- [ ] 漸層只出現在按鈕上。
- [ ] 輔助色（黃、綠）沒有用在按鈕或連結上；錯誤狀態沒有用品牌粉。
- [ ] Logo 沒有變形、換色、加效果，安全距離足夠，背景對應正確。
- [ ] 內文對比 ≥ 4.5:1；所有互動元素都有 hover、active、focus-visible、disabled 四種狀態。
- [ ] 手機點擊範圍 ≥ 44px；在 375px 寬度下沒有橫向捲軸，按鈕文字沒有折行。
- [ ] 有處理 `prefers-reduced-motion`。
- [ ] 文案沒有「算命」「命中註定」這類用語，也沒有 emoji 圖示。
