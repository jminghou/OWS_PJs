# 親紫之間 - 紫微斗數命理網站

這是一個基於 Next.js 14+ 的現代化內容管理系統前端，專為親紫之間後端 Flask API 設計，提供完整的前台展示和後台管理功能，專注於紫微斗數命理分析內容。

## 專案特色

- 📱 **響應式設計** - 完美適配桌面、平板和手機
- ⚡ **高性能** - 使用 SSG/ISR 實現極致載入速度
- 🎨 **現代化 UI** - 使用 Tailwind CSS 打造精美界面
- 📝 **內容管理** - 支援一般文章和命盤分析兩種內容類型
- 🔐 **安全認證** - JWT 身份驗證和權限控制
- 🌟 **占星功能** - 整合舊有占星資料庫
- 📖 **Markdown 支援** - 完整的 Markdown 編輯和渲染

## 技術棧

- **框架**: Next.js 14+ (App Router)
- **語言**: TypeScript
- **樣式**: Tailwind CSS
- **狀態管理**: Zustand
- **HTTP 客戶端**: Axios
- **表單處理**: React Hook Form
- **Markdown**: React Markdown + Remark/Rehype
- **身份驗證**: JWT + jose

## 專案結構

```
/
├── src/
│   ├── app/                    # Next.js App Router 路由
│   │   ├── (public)/          # 公開網站頁面
│   │   │   ├── page.tsx       # 首頁
│   │   │   └── posts/         # 文章相關頁面
│   │   └── admin/             # 後台管理頁面
│   ├── components/            # 組件
│   │   ├── ui/               # 通用 UI 組件
│   │   ├── public/           # 公開網站組件
│   │   └── admin/            # 後台管理組件
│   ├── lib/                  # 工具函數和 API
│   ├── store/                # 狀態管理
│   └── types/                # TypeScript 類型定義
├── public/                   # 靜態資源
└── styles/                  # 全域樣式
```

## 開始使用

### 環境需求

- Node.js 18+
- npm 或 yarn 或 pnpm

### 安裝依賴

```bash
npm install
```

### 環境變數設定

複製環境變數範例檔案：

```bash
cp .env.local.example .env.local
```

編輯 `.env.local` 檔案，設定以下變數：

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Site Configuration
NEXT_PUBLIC_SITE_NAME=Orion Blog
```

### 開發模式

```bash
npm run dev
```

訪問 [http://localhost:3000](http://localhost:3000) 查看網站。

### 建置生產版本

```bash
npm run build
npm start
```

## 功能說明

### 公開網站功能

1. **首頁** (`/`)
   - 展示網站品牌形象
   - 顯示最新發布的精選內容
   - 快速導航到不同內容類型

2. **文章列表** (`/posts`)
   - 分頁顯示所有已發布內容
   - 支援按內容類型篩選（一般文章/命盤分析）
   - 搜尋功能

3. **文章詳情** (`/posts/[slug]`)
   - 完整的文章閱讀體驗
   - 根據內容類型條件渲染：
     - 一般文章：顯示 Markdown 內容
     - 命盤分析：顯示分析內容 + 結構化命盤數據
   - 留言系統
   - SEO 優化

### 後台管理功能

1. **身份驗證** (`/admin/login`)
   - 安全的登入系統
   - JWT Token 管理

2. **管理儀表板** (`/admin/dashboard`)
   - 內容統計概覽
   - 最近內容管理
   - 快速操作入口

3. **內容編輯器** (`/admin/editor`)
   - 條件化編輯表單
   - 支援兩種內容類型：
     - 一般文章：標題 + Markdown 編輯器
     - 命盤分析：標題 + 舊庫匯入 + 分析內容編輯器
   - 草稿/發布狀態管理

4. **舊庫整合**
   - 搜尋和選擇占星人物
   - 自動轉換命盤數據
   - 預覽功能

## API 整合

本專案與 Flask 後端完全分離，通過 RESTful API 進行數據交換：

- **內容 API**: `/api/contents/*`
- **認證 API**: `/api/auth/*`
- **分類標籤**: `/api/categories/*`, `/api/tags/*`
- **舊庫整合**: `/api/legacy/charts/*`

所有 API 請求都通過 `src/lib/api.ts` 統一管理，支援自動 Token 注入和錯誤處理。

## 部署說明

### Vercel 部署

1. 將專案推送到 GitHub
2. 在 Vercel 中匯入專案
3. 設定環境變數
4. 自動部署完成

### 其他平台

本專案可部署到任何支援 Next.js 的平台，如 Netlify、AWS Amplify 等。

## 開發指南

### 新增頁面

在 `src/app/` 目錄下按照 App Router 規範創建檔案。

### 新增組件

- 通用 UI 組件：`src/components/ui/`
- 公開網站組件：`src/components/public/`
- 後台管理組件：`src/components/admin/`

### 狀態管理

使用 Zustand 進行狀態管理，相關檔案在 `src/store/` 目錄。

### API 集成

在 `src/lib/api.ts` 中新增 API 方法，遵循現有的錯誤處理模式。

## 注意事項

1. 確保後端 Flask API 已正確配置 CORS
2. JWT Token 會自動儲存在 localStorage 中
3. 所有受保護的路由都會自動重導向到登入頁面
4. 圖片路徑會自動處理為完整 URL

## 技術支援

如有問題，請檢查：
1. 後端 API 是否正常運行
2. 環境變數是否正確設定
3. 網路連接是否正常
4. 瀏覽器控制台的錯誤訊息

---

## 📐 頁面版型管理指南

### 🎨 CSS 樣式系統

本專案使用 **Tailwind CSS** 作為主要樣式框架，提供一致的設計系統和高效的開發體驗。

#### 💫 主要色彩系統

```css
/* 品牌色彩 */
.text-brand-purple-500   /* 主品牌紫色 */
.text-brand-purple-600   /* 深紫色 */
.text-brand-purple-700   /* 更深紫色 */
.bg-brand-purple-500     /* 紫色背景 */

/* 狀態色彩 */
.text-blue-600          /* 一般文章 */
.text-purple-600        /* 命盤分析 */
.text-green-600         /* 成功狀態 */
.text-red-600           /* 錯誤狀態 */
.text-amber-600         /* 警告狀態 */
```

#### 🎯 響應式斷點

```css
/* 手機 */
默認樣式               /* < 640px */

/* 平板 */
sm:class-name          /* ≥ 640px */
md:class-name          /* ≥ 768px */

/* 桌面 */
lg:class-name          /* ≥ 1024px */
xl:class-name          /* ≥ 1280px */
2xl:class-name         /* ≥ 1536px */
```

### 🏗️ 佈局架構系統

#### 1. 全站版型 (`src/app/layout.tsx`)

```typescript
// 全站共用結構
<html>
  <body>
    {children} // 頁面內容
  </body>
</html>
```

#### 2. 公開網站版型 (`src/app/(public)/layout.tsx`)

```typescript
// 公開網站結構
<>
  <PublicHeader />     // 導航欄
  <main>{children}</main>  // 頁面內容
  <PublicFooter />     // 頁腳
</>
```

#### 3. 管理後台版型 (`src/app/admin/layout.tsx`)

```typescript
// 後台管理結構
<AdminLayout>
  {children}           // 頁面內容
</AdminLayout>
```

### 📄 頁面模板系統

#### 🏠 首頁模板 (`src/app/(public)/page.tsx`)

**版型特色：**
- 英雄區塊（Hero Section）
- 雙區塊內容展示
- 響應式網格佈局

**關鍵組件：**
```typescript
// 內容區塊
<section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
  {/* 英雄區塊 */}
</section>

<section className="py-16">
  {/* 內容展示區 */}
</section>
```

#### 📝 文章詳情模板 (`src/app/(public)/posts/[slug]/page.tsx`)

**2欄式佈局系統：**

```typescript
// 主要結構
<div className="min-h-screen bg-gray-50">
  {/* 標題區域 - 全寬 */}
  <header className="bg-white border-b border-gray-200">
    {/* 標題、摘要、meta 資訊 */}
  </header>

  {/* 2欄式主體 */}
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* 左側欄 - 1/4 寬度 */}
      <aside className="lg:col-span-1">
        <SidebarContent />
      </aside>

      {/* 右主欄 - 3/4 寬度 */}
      <main className="lg:col-span-3">
        <article>{/* 文章內容 */}</article>
        <section>{/* 留言區 */}</section>
      </main>
    </div>
  </div>
</div>
```

**側欄內容管理：**

```typescript
// 智能側欄組件
function SidebarContent({ post, isHoroscopeAnalysis }) {
  if (isHoroscopeAnalysis) {
    return <HoroscopeSidebar post={post} />;  // 命盤專用側欄
  } else {
    return <ArticleSidebar post={post} />;    // 一般文章側欄
  }
}
```

#### 🎛️ 管理後台模板

**統一的管理佈局：**
```typescript
// AdminLayout 組件結構
<div className="min-h-screen bg-gray-100">
  <nav>{/* 側邊導航 */}</nav>
  <main className="ml-64">
    <header>{/* 頁面標題 */}</header>
    <div className="p-6">{children}</div>
  </main>
</div>
```

### 🧩 組件模組管理

#### 📦 組件架構

```
src/components/
├── ui/                     # 基礎 UI 組件
│   ├── Button.tsx         # 按鈕組件
│   ├── Input.tsx          # 輸入框組件
│   ├── Card.tsx           # 卡片組件
│   └── ...
├── public/                # 公開網站組件
│   ├── PublicHeader.tsx   # 公開網站導航
│   ├── PublicFooter.tsx   # 公開網站頁腳
│   ├── PostCard.tsx       # 文章卡片
│   └── ...
└── admin/                 # 管理後台組件
    ├── AdminLayout.tsx    # 後台佈局
    ├── Sidebar.tsx        # 側邊欄
    └── ...
```

#### 🎨 組件樣式模式

**1. 基礎 UI 組件樣式模式：**

```typescript
// Button.tsx 樣式變體
const variants = {
  primary: "bg-purple-600 text-white hover:bg-purple-700",
  secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
  outline: "border border-gray-300 text-gray-700 hover:bg-gray-50"
};
```

**2. 佈局組件樣式模式：**

```typescript
// Card.tsx 樣式
className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"

// 卡片標題
className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3"

// 卡片內容
className="p-4"
```

### 🔧 如何增減模組

#### ➕ 新增頁面

1. **新增公開頁面：**
```bash
# 創建新頁面
src/app/(public)/新頁面名稱/page.tsx
```

2. **新增管理頁面：**
```bash
# 創建新管理頁面
src/app/admin/新頁面名稱/page.tsx
```

#### ➕ 新增組件

1. **新增 UI 組件：**
```typescript
// src/components/ui/NewComponent.tsx
interface NewComponentProps {
  // 定義 props
}

export default function NewComponent({ ...props }: NewComponentProps) {
  return (
    <div className="自定義樣式">
      {/* 組件內容 */}
    </div>
  );
}
```

2. **新增業務組件：**
```typescript
// src/components/public/NewFeature.tsx 或
// src/components/admin/NewFeature.tsx
```

#### ➕ 新增樣式變體

1. **修改 Tailwind 配置：**
```typescript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        'brand-new-color': {
          500: '#your-color-code',
        }
      }
    }
  }
}
```

2. **新增自定義樣式：**
```css
/* src/app/globals.css */
@layer components {
  .custom-component-style {
    @apply bg-white rounded-lg shadow-sm border;
  }
}
```

### 🎭 側欄模組管理

#### 📝 一般文章側欄模組

**組件位置：** `ArticleSidebar`

**包含模組：**
1. **文章資訊卡片** - 作者、時間、分類
2. **文章目錄** - 自動生成導航
3. **相關文章** - 推薦系統

**新增模組方法：**
```typescript
// 在 ArticleSidebar 組件中新增
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
    <span className="w-3 h-3 bg-新顏色-500 rounded-full mr-2"></span>
    新模組標題
  </h3>
  <div className="space-y-3">
    {/* 新模組內容 */}
  </div>
</div>
```

#### 🔮 命盤分析側欄模組

**組件位置：** `HoroscopeSidebar`

**包含模組：**
1. **命盤資料卡片** - 結構化命盤資訊
2. **分析目錄** - 導航連結
3. **相關推薦** - 相關命盤分析

**自定義命盤資料顯示：**
```typescript
// 在 ChartDataSidebar 組件中修改
const fieldLabels: Record<string, string> = {
  // 新增自定義欄位標籤
  new_field: '新欄位中文名稱',
};
```

### 🎨 主題自定義

#### 🌈 色彩主題

**修改主題色：**
```typescript
// tailwind.config.ts
extend: {
  colors: {
    'brand-purple': {
      50: '#f8f7ff',
      500: '#8b5cf6',  // 主品牌色
      600: '#7c3aed',
      700: '#6d28d9',
    }
  }
}
```

#### 📐 間距系統

**自定義間距：**
```typescript
// tailwind.config.ts
extend: {
  spacing: {
    '18': '4.5rem',
    '88': '22rem',
  }
}
```

### 🔄 版型切換方案

#### 📱 響應式適應

**桌面版（2欄）：**
```css
<div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
```

**移動版（單欄）：**
```css
<div className="space-y-6 lg:space-y-0">
```

#### 🎯 條件渲染

**根據文章類型切換版型：**
```typescript
{isHoroscopeAnalysis ? (
  <HoroscopeLayout />
) : (
  <ArticleLayout />
)}
```

### 📋 最佳實踐

1. **🎨 保持一致性**：使用統一的色彩和間距系統
2. **📱 移動優先**：先設計移動版，再適配桌面版
3. **♿ 無障礙**：確保良好的對比度和鍵盤導航
4. **⚡ 性能優化**：避免過度複雜的樣式計算
5. **🔧 模組化**：保持組件小而專一，易於維護

---

## 授權

本專案採用 MIT 授權條款。