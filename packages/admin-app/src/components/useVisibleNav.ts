'use client';

import { useAuthStore } from '@ows/platform-api';
import { isModuleEnabled } from '../config';
import type { AdminNavGroup, AdminNavItem } from '../config';

/**
 * 三層過濾（兩種外殼共用）：
 *   1. 模組：站台沒啟用的平台模組整組不顯示（無 module 的項目永遠顯示）
 *   2. 權限：無 permission 的項目永遠顯示；有的需使用者具備該權限
 */
export function useNavFilter() {
  const { user } = useAuthStore();
  const userPermissions = user?.permissions ?? [];
  return (item: AdminNavItem) =>
    (!item.module || isModuleEnabled(item.module)) &&
    (!item.permission || userPermissions.includes(item.permission));
}

export function useVisibleItems(items: AdminNavItem[]): AdminNavItem[] {
  const keep = useNavFilter();
  return items.filter(keep);
}

export function useVisibleGroups(groups: AdminNavGroup[]): AdminNavGroup[] {
  const keep = useNavFilter();
  return groups
    .map((g) => ({ ...g, items: g.items.filter(keep) }))
    .filter((g) => g.items.length > 0);
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}
