/**
 * @ows/admin-app —— OWS 後台管理介面
 *
 * 整套後台頁面（文章、作者、分類、媒體庫、商品、首頁、設定、投稿、權限、
 * 儀表板、登入）以**頁面元件**的形式匯出，站台用一行 re-export 掛上路由：
 *
 *     // sites/<站台>/frontend/src/app/admin/articles/page.tsx
 *     export { default } from '@ows/admin-app/pages/articles';
 *
 * 站台之間的差異（站名、圖片 URL 規則、站台專屬選單）走 configureAdminApp
 * 注入，見 ./config.ts。站台自己的後台頁面照常寫在自己的 app/admin/ 下，
 * 掛進 extraNav 就會出現在側邊選單。
 *
 * 這個套件**不含任何領域知識** —— Polaris 的折扣碼 / 訂單審核 / 商品類型
 * 三個後台頁面留在站台，因為它們打的是站台擴充的 API。
 */

export { configureAdminApp, getAdminConfig, isModuleEnabled, isPathDisabled, ADMIN_MODULES, ALL_MODULES } from './config';
export type { AdminAppConfig, AdminNavItem, AdminModule } from './config';

export { default as AdminShell } from './pages/AdminShell';
export { default as AdminLayout } from './components/AdminLayout';
