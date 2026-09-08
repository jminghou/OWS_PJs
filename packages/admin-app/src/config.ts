/**
 * 站台設定注入點。
 *
 * ## 為什麼需要這個檔案
 *
 * 後台的頁面本身是通用的，但有幾件事**每個站台不一樣**，套件不可能自己知道：
 *
 *   - 圖片 URL 的變體命名規則。實測 Polaris 用後綴（`name_thumbnail.jpg`）、
 *     Claire 用前綴（`thumbnail_name.jpg`），兩邊都對，就是不一樣。
 *   - 站名、主色。
 *   - 站台自己的後台頁面（Polaris 有 coupons / order-reviews / product-types，
 *     那些是領域功能，不進共用套件，但要出現在側邊選單）。
 *
 * 這些用**模組層級設定**注入，而不是 React context —— getImageUrl 這種純函式
 * 在 19 個地方被呼叫，為了它把整棵樹包一層 provider、每個呼叫點加一個 hook，
 * 是不划算的。設定在站台的 admin layout 匯入時就完成，之後全套件共用。
 *
 * ## 用法（站台的 app/admin/layout.tsx）
 *
 *     import { configureAdminApp } from '@ows/admin-app';
 *     import { getImageUrl, getGcsImageUrl } from '@/lib/utils';
 *
 *     configureAdminApp({
 *       siteName: 'Polaris Parent',
 *       getImageUrl,
 *       getGcsImageUrl,
 *       extraNav: [{ href: '/admin/coupons', label: '折扣碼' }],
 *     });
 */

import type { ReactNode } from 'react';

export interface AdminNavItem {
  href: string;
  label: string;
  /** 需要哪個權限才顯示（對應 core RBAC 的 permission code）。 */
  permission?: string;
  /** 側邊欄圖示（24×24 的 SVG 元素）。不給就用通用圖示。 */
  icon?: ReactNode;
}

/**
 * 後台的平台模組。每一項對應一組頁面與側邊欄項目。
 *
 * 站台用 `modules` 決定要開哪些。（產品管理自 P-commerce 起是選用套件 @ows/commerce，
 * 由站台 extraNav 掛入，不在此清單。）純部落格站台不需要的模組，
 * 關掉它不只是拿掉選單，AdminShell 也會把該模組的路徑導回儀表板，
 * 使用者不會靠猜網址走進一個這個站沒有的功能。
 *
 * 注意這只是前端的顯示與路由控制：core 後端的對應 API 與資料表仍然存在
 * （電商目前住在 core 而非可選套件，見 docs 的討論）。要真正拿掉後端能力，
 * 得把它抽成 packages/commerce —— 那是另一件事。
 */
export const ADMIN_MODULES = {
  content: { label: '內容', paths: ['/admin/articles', '/admin/categories', '/admin/homepage', '/admin/editor', '/admin/posts'] },
  media: { label: '媒體庫', paths: ['/admin/media'] },
  authors: { label: '作者', paths: ['/admin/authors'] },
  submissions: { label: '投稿', paths: ['/admin/submissions'] },
  settings: { label: '設定', paths: ['/admin/settings'] },
  rbac: { label: '權限', paths: ['/admin/roles'] },
} as const;

export type AdminModule = keyof typeof ADMIN_MODULES;

export const ALL_MODULES = Object.keys(ADMIN_MODULES) as AdminModule[];

export interface AdminAppConfig {
  /** 後台標題列顯示的站名。 */
  siteName: string;

  /**
   * 啟用的平台模組。預設全開。
   * 儀表板與登入頁不在此列 —— 它們不是可選的。
   */
  modules: AdminModule[];

  /**
   * 把後端回傳的圖片路徑轉成可顯示的 URL。
   * variant 為 thumbnail / small / medium / large 之一時回傳對應變體。
   *
   * 必須由站台提供 —— 變體檔名規則各站不同（前綴 vs 後綴）。
   */
  getImageUrl: (imagePath?: string, variant?: string) => string;

  /** 同上，但處理已經是 GCS 絕對網址的情況。 */
  getGcsImageUrl: (imagePath: string, variant?: string) => string;

  /** 站台專屬的後台頁面，附加在共用選單之後。 */
  extraNav?: AdminNavItem[];
}

/**
 * 預設值刻意只做「最保守、不會誤導」的事：
 * 圖片直接原樣回傳、不猜變體命名。站台沒設定時後台仍可運作，
 * 只是圖片不會走變體 —— 比猜錯規則導致 404 好。
 */
const DEFAULT_CONFIG: AdminAppConfig = {
  siteName: 'Admin',
  modules: ALL_MODULES,
  getImageUrl: (imagePath?: string) => imagePath || '/placeholder.jpg',
  getGcsImageUrl: (imagePath: string) => imagePath || '/placeholder.jpg',
  extraNav: [],
};

let config: AdminAppConfig = DEFAULT_CONFIG;

/** 站台在 admin layout 匯入時呼叫一次。 */
export function configureAdminApp(options: Partial<AdminAppConfig>): void {
  config = { ...config, ...options };
}

/** 套件內部取用設定。 */
export function getAdminConfig(): AdminAppConfig {
  return config;
}

/** 便利轉呼叫，讓搬進來的元件維持原本的 import 形狀。 */
export function getImageUrl(imagePath?: string, variant?: string): string {
  return config.getImageUrl(imagePath, variant);
}

export function getGcsImageUrl(imagePath: string, variant?: string): string {
  return config.getGcsImageUrl(imagePath, variant);
}


/** 某個平台模組是否啟用。 */
export function isModuleEnabled(module: AdminModule): boolean {
  return config.modules.includes(module);
}

/**
 * 某個後台路徑是否屬於已停用的模組。
 * 不屬於任何模組的路徑（儀表板、登入、站台自己的 extraNav 頁面）一律放行。
 */
export function isPathDisabled(pathname: string): boolean {
  for (const [key, spec] of Object.entries(ADMIN_MODULES)) {
    if (config.modules.includes(key as AdminModule)) continue;
    if (spec.paths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return true;
    }
  }
  return false;
}
