/**
 * 會員名冊 API（後台「會員管理」）—— 對應 core/backend_engine/blueprints/api/members.py
 *   GET /members              伺服器端搜尋、篩選、排序、分頁；附摘要與欄位／篩選定義
 *   GET /members/export.csv   依目前條件匯出（需 users.update）
 * 停用／啟用沿用 userApi.toggleStatus。
 */
import { API_URL, request } from './client';

export type MemberColumnKind = 'number' | 'boolean' | 'badges' | 'text';

export interface MemberColumnDef {
  key: string;
  label: string;
  kind: MemberColumnKind;
}

export interface MemberFilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface MemberRow {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  avatar: string | null;
  role: string;
  is_active: boolean;
  password_set: boolean;
  created_at: string | null;
  last_login: string | null;
  /** 模組登記的欄位值，鍵對應 columns[].key */
  extras: Record<string, unknown>;
}

export interface MemberSummary {
  total: number;
  active: number;
  new_7d: number;
  new_30d: number;
}

export interface MemberListResponse {
  members: MemberRow[];
  pagination: { page: number; pages: number; total: number; per_page: number };
  summary: MemberSummary;
  columns: MemberColumnDef[];
  filters: MemberFilterDef[];
}

export type MemberSort = 'created_at' | 'last_login' | 'username';

/** core 篩選（q、status、joined、sort、order、page、per_page）＋模組篩選（鍵名由 filters 定義）。 */
export type MemberQuery = Record<string, string | number | undefined>;

const EXPORT_PATH = '/members/export.csv';

function toQueryString(params: MemberQuery): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const memberApi = {
  list: (params: MemberQuery) => request<MemberListResponse>('/members', { params }),

  /** 依目前條件下載 CSV（不帶 page／per_page）。 */
  downloadCsv: async (params: MemberQuery): Promise<void> => {
    const { page: _p, per_page: _pp, ...rest } = params;
    const url = `${API_URL}${EXPORT_PATH}${toQueryString(rest)}`;
    let response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (response.status === 401) {
      // access token 過期：借 request() 既有的 refresh 流程換一次 token 再重試
      await memberApi.list({ per_page: 20 });
      response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    }
    if (!response.ok) {
      throw new Error(response.status === 403 ? '沒有匯出會員資料的權限' : `匯出失敗（${response.status}）`);
    }
    const filename = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'members.csv';
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  },
};
