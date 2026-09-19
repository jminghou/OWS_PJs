'use client';

/**
 * 後台路由外殼。實作在 @ows/admin-app —— 這裡只注入站台專屬設定。
 *
 * 本站啟用：平台全部模組 + 電商（@ows/commerce）+ Studio（@ows/studio）。
 * 後端對應 COMMERCE_ENABLED=true、STUDIO_ENABLED=true。不掛任何排盤。
 */

import { AdminShell, configureAdminApp, ALL_MODULES, PLATFORM_NAV } from '@ows/admin-app';
import { commerceNav } from '@ows/commerce';
import { studioNavGroups, StudioSearchBar, QuickCollectButton } from '@ows/studio';
import { getImageUrl, getGcsImageUrl } from '@/lib/utils';

configureAdminApp({
  siteName: '職場媽媽崩潰啥？',
  modules: ALL_MODULES,
  getImageUrl,
  getGcsImageUrl,
  shell: 'labeled',
  homePath: '/admin/studio/today',
  globalSearch: <StudioSearchBar />,
  quickAction: <QuickCollectButton />,
  navGroups: [
    // Studio：內容專案／收集箱／知識卡片／寫作工作區／發布中心
    ...studioNavGroups,
    // 平台後台（文章、媒體、電商…）：預設收合，需要時展開
    {
      label: '網站管理',
      collapsible: true,
      defaultCollapsed: true,
      items: [...PLATFORM_NAV.filter(item => item.href !== '/admin/articles'), commerceNav],
    },
  ],
  // rail 外殼的相容清單（shell 改回 'rail' 時仍可用）
  extraNav: [commerceNav],
});

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
