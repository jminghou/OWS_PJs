import type { AdminNavItem } from '@ows/admin-app';
import { Mail } from 'lucide-react';

/** 掛進站台 configureAdminApp 的 navGroups / extraNav，後台側邊欄就會出現「電子報訂閱」。 */
export const newsletterNav: AdminNavItem = {
  href: '/admin/newsletter',
  label: '電子報訂閱',
  permission: 'newsletter.read',
  icon: <Mail className="w-6 h-6" />,
};
