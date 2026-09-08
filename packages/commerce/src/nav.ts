import type { AdminNavItem } from '@ows/admin-app';

/** 掛進站台 configureAdminApp 的 extraNav，後台側邊欄就會出現「產品管理」。 */
export const commerceNav: AdminNavItem = {
  href: '/admin/products',
  label: '產品管理',
  permission: 'products.read',
};
