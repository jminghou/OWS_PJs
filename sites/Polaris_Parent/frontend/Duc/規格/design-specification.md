# 親紫之間 - 視覺設計規格書

> 文件版本：v1.0
> 更新日期：2026-02-01
> 專案類型：部落格 + 電商 + 諮詢服務網站

---

## 1. 專案概覽

### 1.1 專案資訊

| 項目 | 說明 |
|------|------|
| **專案名稱** | 親紫之間（Qin Zi Blog） |
| **專案類型** | 多語言部落格 + 電商 + 諮詢服務 |
| **技術框架** | Next.js 14+ (App Router) + Tailwind CSS |
| **目標受眾** | 對紫微斗數育兒分析有興趣的家長 |
| **設計風格** | 現代、溫馨、專業、親和 |
| **支援語言** | zh-TW（繁體中文）、zh-CN（簡體中文）、en（英文）、ja（日文） |

### 1.2 目標裝置與斷點

| 裝置 | 斷點 | 優先級 |
|------|------|--------|
| **手機** | 320px - 767px | 高 |
| **平板** | 768px - 1023px | 中 |
| **桌面** | 1024px - 1439px | 高 |
| **寬螢幕** | 1440px+ | 中 |

---

## 2. 設計系統規格

### 2.1 色彩系統

#### 品牌主色 (Brand Purple)

| 色階 | HEX | RGB | 用途 |
|------|-----|-----|------|
| 50 | `#faf7ff` | 250, 247, 255 | 極淺背景 |
| 100 | `#f3edff` | 243, 237, 255 | 淺背景、標籤背景 |
| 200 | `#e8ddff` | 232, 221, 255 | 分隔線、邊框 |
| 300 | `#d7c3ff` | 215, 195, 255 | 裝飾元素 |
| 400 | `#be9eff` | 190, 158, 255 | 次要強調 |
| 500 | `#a371ff` | 163, 113, 255 | 預設品牌色 |
| **600** | `#8b5cf6` | 139, 92, 246 | **主要 CTA、連結** |
| **700** | `#7c3aed` | 124, 58, 237 | **懸停狀態** |
| 800 | `#6d28d9` | 109, 40, 217 | 深色文字 |
| 900 | `#5b21b6` | 91, 33, 182 | 極深強調 |
| 950 | `#3b0764` | 59, 7, 100 | 最深色 |

#### 溫暖色系 (Warm)

| 色階 | HEX | 用途 |
|------|-----|------|
| 50 | `#fdfcf8` | 個人故事背景 |
| 100 | `#faf8f0` | 次要區塊背景 |
| 200 | `#f5f0e0` | 卡片背景 |

#### 語意色彩

| 類型 | HEX | 用途 |
|------|-----|------|
| **成功** | `#22c55e` (green-500) | 成功訊息、確認 |
| **警告** | `#eab308` (yellow-500) | 警告訊息、預覽模式 |
| **錯誤** | `#ef4444` (red-500) | 錯誤訊息、刪除 |
| **資訊** | `#3b82f6` (blue-500) | 連結、資訊提示 |

#### 中性色

| 類型 | HEX | 用途 |
|------|-----|------|
| **文字主色** | `#111827` (gray-900) | 標題、重要文字 |
| **文字次色** | `#4b5563` (gray-600) | 內文、描述 |
| **文字淡色** | `#9ca3af` (gray-400) | 次要資訊、時間戳 |
| **背景主色** | `#ffffff` | 主要背景 |
| **背景次色** | `#f9fafb` (gray-50) | 區塊背景 |
| **邊框色** | `#e5e7eb` (gray-200) | 邊框、分隔線 |

### 2.2 字型系統

#### 字型家族

| 類型 | 字型 | 來源 | 用途 |
|------|------|------|------|
| **主要字型** | Inter | Google Fonts | 全站主要字型 |
| **系統後備** | system-ui, sans-serif | 系統 | 後備字型 |

#### 字型大小 (Type Scale)

| 名稱 | 桌面 | 手機 | 行高 | 用途 |
|------|------|------|------|------|
| H1 | 48px (3rem) | 36px (2.25rem) | 1.2 | 頁面主標題 |
| H2 | 36px (2.25rem) | 28px (1.75rem) | 1.2 | 區塊標題 |
| H3 | 28px (1.75rem) | 24px (1.5rem) | 1.3 | 子區塊標題 |
| H4 | 24px (1.5rem) | 20px (1.25rem) | 1.3 | 卡片標題 |
| Body | 16px (1rem) | 16px (1rem) | 1.6 | 內文 |
| Small | 14px (0.875rem) | 14px (0.875rem) | 1.5 | 輔助文字 |
| Caption | 12px (0.75rem) | 12px (0.75rem) | 1.5 | 標籤、時間 |

#### 字重

| 名稱 | 數值 | 用途 |
|------|------|------|
| Regular | 400 | 內文 |
| Medium | 500 | 按鈕、導航 |
| Semibold | 600 | 卡片標題 |
| Bold | 700 | 頁面標題 |

### 2.3 間距系統

**基礎單位：8px (0.5rem)**

| 名稱 | 數值 | 用途 |
|------|------|------|
| XS | 4px (0.25rem) | 元素內部微間距 |
| S | 8px (0.5rem) | 緊密間距 |
| M | 16px (1rem) | 標準間距 |
| L | 24px (1.5rem) | 區塊內間距 |
| XL | 32px (2rem) | 區塊間距 |
| 2XL | 48px (3rem) | 大區塊間距 |
| 3XL | 64px (4rem) | 頁面區塊間距 |
| 4XL | 96px (6rem) | 主要區塊間距 |

### 2.4 圓角系統

| 名稱 | 數值 | 用途 |
|------|------|------|
| None | 0px | 無圓角 |
| SM | 4px | 標籤、小按鈕 |
| MD | 8px (0.5rem) | 按鈕、輸入框 |
| LG | 12px | 卡片 |
| XL | 16px | 大卡片、對話框 |
| 2XL | 24px | 特殊裝飾區塊 |
| Full | 9999px | 圓形按鈕、頭像 |

### 2.5 陰影系統

| 名稱 | CSS | 用途 |
|------|-----|------|
| **SM** | `0 1px 2px 0 rgba(0,0,0,0.05)` | 卡片預設 |
| **MD** | `0 4px 6px -1px rgba(0,0,0,0.1)` | 卡片懸停、下拉選單 |
| **LG** | `0 10px 15px -3px rgba(0,0,0,0.1)` | 彈出框、對話框 |
| **XL** | `0 20px 25px -5px rgba(0,0,0,0.1)` | 大型彈窗 |

---

## 3. 頁面結構與路由

### 3.1 頁面清單

| 頁面 | 路由 | 類型 | 說明 |
|------|------|------|------|
| 首頁 | `/` | 公開 | 含 Hero、關於預覽、文章輪播、Banner、產品區 |
| 關於我們 | `/about` | 公開 | 品牌故事、理念、使命 |
| 親紫專欄（文章列表） | `/posts` | 公開 | 文章列表、篩選、分頁 |
| 文章詳情 | `/posts/[slug]` | 公開 | 文章內文、作者、標籤 |
| 文章列表（Articles） | `/articles` | 公開 | 另一種文章展示 |
| 服務與產品 | `/products` | 公開 | 產品列表 |
| 產品詳情 | `/products/[product_id]` | 公開 | 產品詳細介紹、購買 |
| 聯絡我們 | `/contact` | 公開 | 聯絡表單 |
| 訂單完成 | `/order/completed` | 公開 | 訂單成功頁 |
| 訂單失敗 | `/order/failed` | 公開 | 訂單失敗頁 |
| 後台首頁 | `/admin` | 需登入 | 管理儀表板 |
| 後台登入 | `/admin/login` | 公開 | 管理員登入 |
| 文章管理 | `/admin/posts` | 需登入 | 文章 CRUD |
| 文章編輯器 | `/admin/editor/[id]` | 需登入 | Tiptap 富文本編輯 |
| 分類管理 | `/admin/categories` | 需登入 | 分類 CRUD |
| 作者管理 | `/admin/authors` | 需登入 | 作者管理 |
| 產品管理 | `/admin/products` | 需登入 | 產品 CRUD |
| 媒體庫 | `/admin/media` | 需登入 | 圖片上傳管理 |
| 首頁設定 | `/admin/homepage` | 需登入 | Hero 輪播管理 |
| 系統設定 | `/admin/settings` | 需登入 | 網站設定 |
| 表單提交 | `/admin/submissions` | 需登入 | 聯絡表單管理 |

### 3.2 多語言路由

- 預設語言（zh-TW）：`/about`, `/posts`, `/products`
- 其他語言：`/[locale]/about`, `/[locale]/posts`, `/[locale]/products`
- 支援語言：`zh-TW`, `zh-CN`, `en`, `ja`

---

## 4. 視覺素材規格

### 4.1 Hero 區域素材

| 素材名稱 | 用途 | 尺寸規格 | 格式 | 備註 |
|----------|------|----------|------|------|
| `hero-slide-01` | 首頁 Hero 輪播 1 | 1920×1080px (16:9) | JPG/WebP | 建議 3-5 張輪播 |
| `hero-slide-02` | 首頁 Hero 輪播 2 | 1920×1080px (16:9) | JPG/WebP | |
| `hero-slide-03` | 首頁 Hero 輪播 3 | 1920×1080px (16:9) | JPG/WebP | |
| `hero-slide-mobile-01` | 手機版 Hero | 750×1334px (9:16) | JPG/WebP | 選配 |
| `hero-slide-tablet-01` | 平板版 Hero | 1024×768px (4:3) | JPG/WebP | 選配 |

**Hero 圖片設計指南：**
- 主題：親子互動、溫馨家庭、星空、紫色調氛圍
- 焦點位置：中央偏上，確保文字覆蓋後仍可識別
- 色調：偏暖或紫色系，與品牌色呼應
- 避免過於繁忙的背景，確保文字可讀性

### 4.2 文章圖片素材

| 素材類型 | 用途 | 尺寸規格 | 格式 | 命名規範 |
|----------|------|----------|------|----------|
| **精選圖片 (Featured)** | 文章詳情頁 Hero | 1200×675px (16:9) | JPG/WebP | `featured-{slug}.jpg` |
| **封面圖片 (Cover)** | 文章列表卡片 | 800×800px (1:1) | JPG/WebP | `cover-{slug}.jpg` |
| **內文圖片** | 文章內容插圖 | 最大 1200px 寬 | JPG/PNG/WebP | `content-{slug}-{n}.jpg` |

**文章圖片設計指南：**
- 精選圖片：適合寬幅展示，焦點在中央
- 封面圖片：適合正方形裁切，主題明確
- 建議提供 WebP 格式以優化效能

### 4.3 產品圖片素材

| 素材類型 | 用途 | 尺寸規格 | 格式 | 命名規範 |
|----------|------|----------|------|----------|
| **產品主圖** | 產品卡片、詳情頁 | 800×800px (1:1) | JPG/WebP | `product-{id}-main.jpg` |
| **產品詳情圖** | 產品詳情說明 | 1200×675px (16:9) | JPG/WebP | `product-{id}-detail.jpg` |
| **產品縮圖** | 列表快速預覽 | 400×400px (1:1) | JPG/WebP | `product-{id}-thumb.jpg` |

### 4.4 關於頁面素材

| 素材名稱 | 用途 | 尺寸規格 | 格式 | 備註 |
|----------|------|----------|------|------|
| `about-hero` | 關於頁面 Hero（選配） | 1920×600px | JPG/WebP | 品牌形象圖 |
| `about-founder` | 創辦人照片（選配） | 600×600px (1:1) | JPG/WebP | 專業形象照 |
| `about-illustration` | 品牌插圖 | 800×600px | SVG/PNG | 品牌理念視覺化 |

### 4.5 首頁區塊背景（選配）

| 素材名稱 | 用途 | 尺寸規格 | 格式 |
|----------|------|----------|------|
| `bg-about-preview` | 關於預覽區塊背景 | 紋理/漸層 | SVG/PNG |
| `bg-features` | 產品區塊背景 | 紋理/漸層 | SVG/PNG |
| `bg-articles` | 文章區塊背景 | 純色或紋理 | CSS/SVG |

---

## 5. 圖示規格

### 5.1 功能圖示（Feature Icons）

| 圖示名稱 | 用途 | 尺寸 | 格式 | 顏色 |
|----------|------|------|------|------|
| `icon-report` | 命盤報告服務 | 64×64px | SVG | brand-purple-600 |
| `icon-consult` | 一對一諮詢服務 | 64×64px | SVG | brand-purple-600 |
| `icon-course` | 線上課程服務 | 64×64px | SVG | brand-purple-600 |

**功能圖示設計指南：**
- 線條粗細：2px stroke
- 風格：線條風格 (Outline)
- 顏色：使用單色，支援動態著色
- 提供 SVG 格式以支援任意縮放

### 5.2 UI 圖示

| 圖示名稱 | 用途 | 尺寸 | 來源 |
|----------|------|------|------|
| `icon-menu` | 行動版選單 | 24×24px | 內建 SVG |
| `icon-close` | 關閉按鈕 | 24×24px | 內建 SVG |
| `icon-arrow-right` | 箭頭、連結指示 | 20×20px | 內建 SVG |
| `icon-arrow-down` | 向下箭頭 | 20×20px | 內建 SVG |
| `icon-check` | 勾選、確認 | 16×16px | 內建 SVG |
| `icon-search` | 搜尋 | 20×20px | 內建 SVG |
| `icon-loading` | 載入中 | 16×16px | 內建 SVG (動畫) |

### 5.3 社群圖示

| 圖示名稱 | 用途 | 尺寸 | 格式 |
|----------|------|------|------|
| `icon-github` | GitHub 連結 | 20×20px | SVG |
| `icon-twitter` | Twitter/X 連結 | 20×20px | SVG |
| `icon-facebook` | Facebook 連結 | 20×20px | SVG |
| `icon-instagram` | Instagram 連結 | 20×20px | SVG |
| `icon-line` | LINE 連結（台灣市場） | 20×20px | SVG |

---

## 6. Logo 規格

### 6.1 Logo 變體

| 變體 | 用途 | 最小尺寸 | 格式 |
|------|------|----------|------|
| `logo-primary` | 主要 Logo（全彩） | 120px 寬 | SVG, PNG@2x |
| `logo-white` | 深色背景用 | 120px 寬 | SVG, PNG@2x |
| `logo-icon` | Favicon、小空間 | 32px | SVG, PNG@2x |
| `logo-horizontal` | 頁首、寬橫幅 | 160px 寬 | SVG, PNG@2x |

### 6.2 Logo 使用規範

- **安全間距**：Logo 高度的 1x 作為最小安全間距
- **最小尺寸**：橫式 120px 寬，圖示 32px
- **背景限制**：避免放置於色彩過於複雜的背景上
- **勿變形**：保持原始比例，不得拉伸或壓縮

### 6.3 Favicon 尺寸

| 尺寸 | 用途 | 格式 |
|------|------|------|
| 16×16px | 瀏覽器標籤 | ICO, PNG |
| 32×32px | 瀏覽器標籤 (Retina) | PNG |
| 180×180px | Apple Touch Icon | PNG |
| 192×192px | Android Chrome | PNG |
| 512×512px | PWA Icon | PNG |

---

## 7. 元件設計規格

### 7.1 按鈕 (Button)

#### Primary Button

```
背景色：brand-purple-600 (#8b5cf6)
懸停色：brand-purple-700 (#7c3aed)
文字色：white
字型：16px, font-weight 500
內距：12px 24px (M), 16px 32px (L)
圓角：8px
陰影：shadow-lg (hover: shadow-xl)
```

#### Secondary Button

```
背景色：brand-purple-100
懸停色：brand-purple-200
文字色：brand-purple-800
字型：16px, font-weight 500
內距：12px 24px
圓角：8px
```

#### Outline Button

```
邊框：1px solid gray-300
背景色：transparent
懸停背景：gray-50
文字色：gray-700
```

#### Ghost Button

```
背景色：transparent
懸停背景：gray-100
文字色：gray-700
```

#### 按鈕狀態

| 狀態 | 視覺效果 |
|------|----------|
| Default | 標準樣式 |
| Hover | 背景加深、陰影增強、scale(1.05) |
| Active | 背景更深 |
| Disabled | opacity 50%、cursor-not-allowed |
| Loading | 顯示旋轉 spinner |

### 7.2 卡片 (Card)

#### 文章卡片

```
容器：
- 背景：white
- 圓角：8px (rounded-lg)
- 邊框：1px solid gray-200
- 陰影：shadow-sm → shadow-md (hover)
- overflow：hidden

圖片區：
- 比例：1:1 (aspect-square)
- object-fit：cover

內容區：
- 內距：24px (p-6)
- 標題：20px, font-weight 600, line-clamp-2
- 摘要：14px, gray-600, line-clamp-3
```

#### 產品/功能卡片

```
容器：
- 背景：white
- 圓角：12px (rounded-xl)
- 內距：32px (p-8)
- 陰影：shadow-sm → shadow-md (hover)

圖示區：
- 容器：56×56px, bg-brand-purple-100, rounded-xl
- 圖示：28×28px, brand-purple-600

標題：20px, font-weight 600
描述：16px, gray-600, leading-relaxed
```

### 7.3 表單元素 (Form Elements)

#### Input

```
高度：40px (h-10)
內距：8px 12px (px-3 py-2)
邊框：1px solid gray-200
圓角：6px
字型：14px

狀態：
- Focus：ring-2 ring-brand-purple-600
- Error：border-red-500
- Disabled：opacity 50%, cursor-not-allowed
```

#### Textarea

```
最小高度：120px
內距：12px
其他同 Input
```

#### Checkbox / Radio

```
尺寸：24×24px
邊框：2px solid gray-300
圓角：Checkbox 4px, Radio 50%
選中色：brand-purple-600
```

### 7.4 導航 (Navigation)

#### Header

```
高度：64px (h-16)
背景：white
邊框底：1px solid gray-200
陰影：shadow-sm
定位：fixed top-0, z-50

Logo區：
- 字型：24px, font-bold, brand-purple-700

導航連結：
- 字型：14px, font-medium
- 顏色：gray-900 → brand-purple-600 (hover)
- 內距：12px 16px
```

#### Mobile Menu

```
背景：white
邊框：border-t
內距：8px 12px
連結字型：16px, font-medium
```

#### Footer

```
背景：gray-800
文字色：white / gray-300
內距：48px 縱向
分隔線：border-gray-700
```

---

## 8. 響應式設計規格

### 8.1 容器寬度

| 斷點 | 最大寬度 | 側邊距 |
|------|----------|--------|
| 手機 | 100% | 16px |
| 平板 | 100% | 24px |
| 桌面 | 1280px (max-w-7xl) | 32px |
| 寬螢幕 | 1280px | 自動置中 |

### 8.2 網格系統

| 區塊 | 手機 | 平板 | 桌面 |
|------|------|------|------|
| 文章列表 | 1 欄 | 2 欄 | 3 欄 |
| 產品列表 | 1 欄 | 2 欄 | 3 欄 |
| 功能區塊 | 1 欄 | 2 欄 | 3 欄 |
| Footer | 堆疊 | 2 欄 | 4 欄 |

### 8.3 Hero 區塊響應式

| 斷點 | 高度 | 標題大小 | 副標題大小 |
|------|------|----------|------------|
| 手機 | calc(100vh - 64px), min 500px | 36px | 18px |
| 平板 | calc(100vh - 64px), min 640px | 48px | 20px |
| 桌面 | calc(100vh - 64px) | 60px | 24px |

---

## 9. 素材清單與命名規範

### 9.1 檔案組織架構

```
/public
  /images
    /hero
      - hero-slide-01.jpg
      - hero-slide-01.webp
      - hero-slide-02.jpg
      - hero-slide-02.webp
      - hero-slide-03.jpg
      - hero-slide-03.webp
    /about
      - about-hero.jpg
      - about-founder.jpg
      - about-illustration.svg
    /icons
      /features
        - icon-report.svg
        - icon-consult.svg
        - icon-course.svg
      /social
        - icon-github.svg
        - icon-twitter.svg
        - icon-facebook.svg
        - icon-line.svg
    /logos
      - logo-primary.svg
      - logo-primary@2x.png
      - logo-white.svg
      - logo-white@2x.png
      - logo-icon.svg
    /patterns
      - pattern-dots.svg
      - pattern-gradient.svg
  /favicon
    - favicon.ico
    - favicon-16x16.png
    - favicon-32x32.png
    - apple-touch-icon.png
    - android-chrome-192x192.png
    - android-chrome-512x512.png
```

### 9.2 命名規範

| 類型 | 格式 | 範例 |
|------|------|------|
| Hero 圖片 | `hero-[位置]-[編號].[格式]` | `hero-slide-01.jpg` |
| 文章封面 | `cover-[slug].[格式]` | `cover-understanding-your-child.jpg` |
| 文章精選圖 | `featured-[slug].[格式]` | `featured-understanding-your-child.jpg` |
| 產品圖片 | `product-[id]-[類型].[格式]` | `product-001-main.jpg` |
| 圖示 | `icon-[類別]-[名稱].svg` | `icon-feature-report.svg` |
| Logo | `logo-[變體].[格式]` | `logo-primary.svg` |
| 背景 | `bg-[區塊]-[描述].[格式]` | `bg-hero-gradient.svg` |

### 9.3 圖片優化指南

| 類型 | 格式建議 | 品質 | 最大檔案大小 |
|------|----------|------|--------------|
| Hero | WebP + JPG 後備 | 85% | 200KB |
| 文章圖片 | WebP + JPG 後備 | 85% | 150KB |
| 產品圖片 | WebP + JPG 後備 | 85% | 100KB |
| 圖示 | SVG | N/A | 10KB |
| Logo | SVG | N/A | 20KB |

---

## 10. 完整素材清單

### 10.1 必要素材

| # | 素材名稱 | 尺寸 | 格式 | 優先級 | 備註 |
|---|----------|------|------|--------|------|
| 1 | Hero 輪播圖 ×3-5 | 1920×1080px | JPG/WebP | 高 | 首頁主視覺 |
| 2 | Logo 主要版本 | 向量 | SVG | 高 | 頁首、品牌識別 |
| 3 | Logo 白色版本 | 向量 | SVG | 高 | 深色背景用 |
| 4 | Logo 圖示版本 | 向量 | SVG | 高 | Favicon |
| 5 | Favicon 系列 | 16-512px | PNG/ICO | 高 | 瀏覽器圖示 |
| 6 | 功能圖示 ×3 | 64×64px | SVG | 中 | 服務區塊 |
| 7 | 社群圖示 ×4-5 | 20×20px | SVG | 中 | Footer 連結 |
| 8 | OG Image | 1200×630px | JPG | 中 | 社群分享預覽 |
| 9 | Twitter Card | 1200×675px | JPG | 低 | Twitter 分享 |

### 10.2 建議素材（選配）

| # | 素材名稱 | 尺寸 | 格式 | 用途 |
|---|----------|------|------|------|
| 1 | 關於頁面 Hero | 1920×600px | JPG/WebP | 關於頁面視覺 |
| 2 | 創辦人照片 | 600×600px | JPG | 關於頁面 |
| 3 | 品牌插圖 | 800×600px | SVG/PNG | 品牌理念視覺化 |
| 4 | 文章預設封面 | 800×800px | JPG | 無圖文章預設 |
| 5 | 產品預設圖 | 800×800px | JPG | 無圖產品預設 |
| 6 | 404 插圖 | 600×400px | SVG | 找不到頁面 |
| 7 | 空狀態插圖 | 400×300px | SVG | 無內容時顯示 |
| 8 | 載入動畫 | - | Lottie/CSS | 頁面載入 |

---

## 11. 交付檢查清單

### 11.1 設計交付物

- [ ] 所有 Hero 輪播圖（3-5 張）
- [ ] Logo 所有變體（主要、白色、圖示）
- [ ] Favicon 系列（所有尺寸）
- [ ] 功能圖示（3 個）
- [ ] 社群圖示（4-5 個）
- [ ] OG Image 社群分享圖

### 11.2 品質檢查

- [ ] 所有圖片符合指定尺寸
- [ ] 圖片已優化（WebP + JPG 後備）
- [ ] SVG 已清理優化
- [ ] 檔案命名符合規範
- [ ] 色彩模式為 sRGB
- [ ] 圖片在各斷點測試正常

### 11.3 檔案格式檢查

- [ ] Hero 圖片：JPG + WebP
- [ ] 圖示：SVG（支援動態著色）
- [ ] Logo：SVG + PNG@2x
- [ ] Favicon：PNG + ICO

---

## 12. 附錄

### 12.1 設計工具推薦

- **UI 設計**：Figma
- **圖片優化**：Squoosh、TinyPNG
- **SVG 優化**：SVGO、SVGOMG
- **圖示庫參考**：Heroicons、Lucide Icons

### 12.2 相關連結

- Tailwind CSS 文件：https://tailwindcss.com/docs
- Next.js Image 優化：https://nextjs.org/docs/app/building-your-application/optimizing/images
- Web.dev 圖片指南：https://web.dev/learn/images/

### 12.3 版本歷史

| 版本 | 日期 | 變更說明 |
|------|------|----------|
| v1.0 | 2026-02-01 | 初版建立 |

---

*本規格書由 web-design-spec-generator skill 根據專案程式碼分析自動生成*
