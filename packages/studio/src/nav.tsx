import type { AdminNavGroup, AdminNavItem } from '@ows/admin-app';
import { InboxBadge } from './components/InboxBadge';

const icon = (d: string) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
  </svg>
);

const today: AdminNavItem = {
  href: '/admin/studio/today', label: '今天', permission: 'studio.read', divider: true,
  icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'),
};
const projects: AdminNavItem = {
  href: '/admin/studio/projects', label: '內容專案', permission: 'studio.read',
  icon: icon('M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'),
};
const workspace: AdminNavItem = {
  href: '/admin/studio/workspace', label: '寫作工作區', permission: 'studio.read',
  icon: icon('M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'),
};
const publishing: AdminNavItem = {
  href: '/admin/studio/publishing', label: '發布中心', permission: 'studio.read',
  icon: icon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'),
};
const cards: AdminNavItem = {
  href: '/admin/studio/cards', label: '知識卡片', permission: 'studio.read',
  icon: icon('M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'),
};
const inbox: AdminNavItem = {
  href: '/admin/studio/inbox', label: '收集箱', permission: 'studio.read', badge: <InboxBadge />,
  icon: icon('M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'),
};
const tags: AdminNavItem = {
  href: '/admin/studio/tags', label: '標籤', permission: 'studio.read',
  icon: icon('M7 7h.01M7 3h5a2 2 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z'),
};

/**
 * labeled 外殼用：兩個群組（工作／資料庫）。
 *   configureAdminApp({ shell: 'labeled', navGroups: [...studioNavGroups, { label: '平台後台', items: [...PLATFORM_NAV, ...] }] })
 */
export const studioNavGroups: AdminNavGroup[] = [
  { label: '工作', items: [today, projects, workspace, publishing] },
  { label: '資料庫', items: [cards, inbox, tags] },
];

/** rail 外殼用：平鋪六項（第一項帶 divider 畫分隔線）。 */
export const studioNav: AdminNavItem[] = [today, inbox, projects, cards, publishing, tags];
