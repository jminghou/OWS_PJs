'use client';

/**
 * 後台路由外殼。實作在 @ows/admin-app —— 這裡只注入站台專屬設定。
 *
 * 本站啟用：平台全部模組 + 電商（@ows/commerce，後端 COMMERCE_ENABLED=true）。
 * 不掛 Studio、不掛任何排盤。
 */

import { AdminShell, configureAdminApp, ALL_MODULES, PLATFORM_NAV } from '@ows/admin-app';
import { commerceNav } from '@ows/commerce';
import { getImageUrl, getGcsImageUrl } from '@/lib/utils';

configureAdminApp({
  siteName: 'Happy Wu',
  modules: ALL_MODULES,
  getImageUrl,
  getGcsImageUrl,
  shell: 'labeled',
  navGroups: [
    {
      label: '平台後台',
      items: [...PLATFORM_NAV, commerceNav],
    },
  ],
  // rail 外殼的相容清單（shell 改回 'rail' 時仍可用）
  extraNav: [commerceNav],
});

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
