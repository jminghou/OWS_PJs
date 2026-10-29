/**
 * 頁面模組 API client（產品管理「模組管理」）
 * 對應後端 sites/Polaris_Parent/backend/extensions/page_modules
 *   GET    /api/v1/admin/page-modules                       （products.read）
 *   GET    /api/v1/admin/page-modules/:id                   （products.read）
 *   POST   /api/v1/admin/page-modules                       （page_modules.manage；新增／duplicate_of／copy_from）
 *   POST   /api/v1/admin/page-modules/bulk                  （page_modules.manage；從現有內容建立）
 *   PUT    /api/v1/admin/page-modules/:id                   （page_modules.manage）
 *   POST   /api/v1/admin/page-modules/:id/translation-confirm
 *   DELETE /api/v1/admin/page-modules/:id
 * 前台讀取在 lib/report/modules.ts 的 fetchModules（GET /api/v1/page-modules，公開）。
 */
import { request } from '@ows/platform-api/client';
import type { ModuleType } from '@/lib/report/modules';

export interface ModuleTranslation {
  source_id: number;
  source_language: string;
  confirmed: boolean;
  synced_at: string | null;
  source_updated_at: string | null;
  stale: boolean;
}

export interface PageModuleVersion {
  id: number;
  module_key: string;
  language: string;
  type: ModuleType;
  name: string;
  is_active: boolean;
  original_id: number | null;
  translation: ModuleTranslation | null;
  updated_at: string | null;
}

export interface PageModuleDetail extends PageModuleVersion {
  data: Record<string, any>;
}

export interface ModuleUsage {
  kind: 'product' | 'catalog';
  id: number;
  product_id?: string;
  language: string;
  name: string;
  slot: string;
  is_active: boolean;
}

/** 改用模組的頁面（一種語言一筆）與各位置選的模組；依出版品檢視時用 */
export interface ModulePage {
  kind: 'product' | 'catalog';
  id: number;
  product_id?: string;
  language: string;
  name: string;
  is_active: boolean;
  refs: Record<string, string>;
}

export interface PageModuleGroup {
  module_key: string;
  type: ModuleType;
  name: string;
  root_id: number;
  versions: PageModuleVersion[];
  used_by: ModuleUsage[];
}

export interface BulkModule {
  module_key: string;
  type: ModuleType;
  name: string;
  language: string;
  data: Record<string, unknown>;
}

const json = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const pageModuleApi = {
  list: () => request<{ modules: PageModuleGroup[]; pages: ModulePage[] }>('/admin/page-modules', { cache: 'no-store' }),
  get: (id: number) => request<{ module: PageModuleDetail; used_by: ModuleUsage[] }>(`/admin/page-modules/${id}`, { cache: 'no-store' }),
  create: (body: { type: ModuleType; name: string; data?: Record<string, unknown> }) =>
    request<{ module: PageModuleDetail }>('/admin/page-modules', json('POST', body)),
  duplicate: (id: number, name: string) =>
    request<{ module: PageModuleDetail }>('/admin/page-modules', json('POST', { duplicate_of: id, name })),
  addLanguage: (copyFrom: number, language: string) =>
    request<{ module: PageModuleDetail }>('/admin/page-modules', json('POST', { copy_from: copyFrom, language })),
  bulk: (modules: BulkModule[]) =>
    request<{ created: string[]; skipped: string[] }>('/admin/page-modules/bulk', json('POST', { modules })),
  update: (id: number, body: { name?: string; data?: Record<string, unknown>; is_active?: boolean }) =>
    request<{ module: PageModuleDetail; used_by: ModuleUsage[] }>(`/admin/page-modules/${id}`, json('PUT', body)),
  confirmTranslation: (id: number) =>
    request<{ module: PageModuleDetail }>(`/admin/page-modules/${id}/translation-confirm`, json('POST')),
  remove: (id: number) => request<{ success: boolean }>(`/admin/page-modules/${id}`, json('DELETE')),
};
