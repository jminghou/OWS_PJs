/**
 * 平台後台的九個內建選單項目（資料，不含站台專屬）。
 *
 * 兩種外殼都從這裡讀：rail 直接排成一列；labeled 由站台決定放進哪個群組
 * （例如 Polaris 把它們收進可收合的「平台後台」）。
 */
import type { AdminNavItem } from './config';

const icon = (d: string) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
  </svg>
);

export const PLATFORM_NAV: AdminNavItem[] = [
  {
    label: '儀表板', href: '/admin/dashboard',
    icon: icon('M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0'),
  },
  {
    label: '文章管理', href: '/admin/articles', module: 'content', permission: 'contents.read',
    icon: icon('M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'),
  },
  {
    label: '分類標籤', href: '/admin/categories', module: 'content', permission: 'contents.read',
    icon: icon('M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'),
  },
  {
    label: '媒體庫', href: '/admin/media', module: 'media', permission: 'media.read',
    icon: icon('M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'),
  },
  {
    label: '首頁設定', href: '/admin/homepage', module: 'content', permission: 'contents.update',
    icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'),
  },
  {
    label: '作者管理', href: '/admin/authors', module: 'authors', permission: 'users.read',
    icon: icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z'),
  },
  {
    label: '匿名提問', href: '/admin/submissions', module: 'submissions', permission: 'submissions.read',
    icon: icon('M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
  },
  {
    label: '語系設定', href: '/admin/settings', module: 'settings', permission: 'settings.read',
    icon: icon('M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129'),
  },
  {
    label: '權限管理', href: '/admin/roles', module: 'rbac', permission: 'users.update',
    icon: icon('M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'),
  },
];
