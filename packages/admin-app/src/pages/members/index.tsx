'use client';

/**
 * 會員管理：讀者端帳號（role＝member／user）的名冊，為大量會員設計。
 *
 * - 搜尋、篩選、排序、分頁全在伺服器端（GET /members），一頁 20／50／100 筆。
 * - 條件寫在網址上：重新整理、上一頁、把網址貼給同事都會回到同一個畫面。
 * - 欄位與篩選有一部分由選用模組登記（登入方式、信箱驗證、訂單數…），後端回什麼就畫什麼。
 * - 後台人員（管理員、編輯）在「作者管理」，不在這裡。
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  memberApi,
  useAuthStore,
  userApi,
  type MemberListResponse,
  type MemberQuery,
  type MemberRow,
  type MemberSort,
} from '@ows/platform-api';
import { AdminActionMenu, AdminEmptyState, AdminLoadingSkeleton, AdminPagination } from '@ows/ui/admin';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, Users, X } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import ExtraValue from './_components/ExtraValue';
import MemberAvatar from './_components/MemberAvatar';
import MemberDetailSheet from './_components/MemberDetailSheet';
import { formatDate, formatRelative, nf } from './_components/format';

const PER_PAGE = [20, 50, 100] as const;
const CORE_KEYS = ['q', 'status', 'joined', 'sort', 'order', 'page', 'per_page'];

const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'active', label: '啟用中' },
  { value: 'disabled', label: '已停用' },
];
const JOINED_OPTIONS = [
  { value: '', label: '不限註冊時間' },
  { value: '7d', label: '近 7 天註冊' },
  { value: '30d', label: '近 30 天註冊' },
  { value: '90d', label: '近 90 天註冊' },
  { value: '365d', label: '近一年註冊' },
];
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'created_at:desc', label: '最新註冊' },
  { value: 'created_at:asc', label: '最早註冊' },
  { value: 'last_login:desc', label: '最近登入' },
  { value: 'last_login:asc', label: '最久沒登入' },
  { value: 'username:asc', label: '帳號 A→Z' },
];

const selectCls =
  'w-full sm:w-auto rounded-md border border-border bg-card px-2.5 py-2 md:py-1.5 text-sm text-foreground ' +
  'focus:outline-none focus:ring-1 focus:ring-admin-accent-500';
const btnGhost =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 md:py-1.5 text-sm text-foreground ' +
  'transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">啟用</span>
  ) : (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200">停用</span>
  );
}

function MembersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canManage = useAuthStore((s) => s.user?.permissions?.includes('users.update') ?? false);

  // ── 網址即狀態 ───────────────────────────────────────────────────────
  const query: MemberQuery = useMemo(() => {
    const out: MemberQuery = {};
    searchParams.forEach((v, k) => { if (v) out[k] = v; });
    return out;
  }, [searchParams]);
  const page = Math.max(Number(query.page) || 1, 1);
  const perPage = PER_PAGE.includes(Number(query.per_page) as 20) ? Number(query.per_page) : 20;
  const sort = (query.sort as MemberSort) || 'created_at';
  const order = (query.order as string) || (sort === 'username' ? 'asc' : 'desc');

  const setQuery = useCallback((patch: MemberQuery, { keepPage = false } = {}) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === null) next.delete(k);
      else next.set(k, String(v));
    });
    if (!keepPage) next.delete('page'); // 換條件就回第一頁
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // 搜尋框：輸入即時顯示，停 300ms 才寫進網址（＝才查詢）
  const [searchText, setSearchText] = useState(String(query.q || ''));
  useEffect(() => { setSearchText(String(query.q || '')); }, [query.q]);
  useEffect(() => {
    if (searchText.trim() === String(query.q || '')) return;
    const t = setTimeout(() => setQuery({ q: searchText.trim() }), 300);
    return () => clearTimeout(t);
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 載入 ─────────────────────────────────────────────────────────────
  const [data, setData] = useState<MemberListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await memberApi.list({ ...query, page, per_page: perPage });
      if (seq === requestSeq.current) setData(res); // 只採用最後一次請求，避免慢的舊結果蓋掉新的
    } catch (err) {
      if (seq === requestSeq.current) setError((err as Error).message || '載入會員失敗');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [query, page, perPage]);

  useEffect(() => { load(); }, [load]);

  // ── 操作 ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const toggleStatus = async (m: MemberRow) => {
    if (m.is_active && !confirm(`停用 ${m.email}？\n\n停用後這位會員無法登入，訂單與資料都會保留，之後可以重新啟用。`)) return;
    setBusyId(m.id);
    try {
      const res = await userApi.toggleStatus(m.id);
      const updated = { ...m, is_active: res.is_active };
      setData((d) => d && { ...d, members: d.members.map((x) => (x.id === m.id ? updated : x)) });
      setSelected((s) => (s && s.id === m.id ? updated : s));
      setNotice({ type: 'success', text: `${m.email} 已${res.is_active ? '重新啟用' : '停用'}` });
    } catch (err) {
      setNotice({ type: 'error', text: (err as Error).message || '操作失敗' });
    } finally {
      setBusyId(null);
    }
  };

  const copyEmail = async (m: MemberRow) => {
    try {
      await navigator.clipboard.writeText(m.email);
      setNotice({ type: 'success', text: `已複製 ${m.email}` });
    } catch {
      setNotice({ type: 'error', text: '無法存取剪貼簿' });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setNotice(null);
    try {
      await memberApi.downloadCsv({ ...query });
    } catch (err) {
      setNotice({ type: 'error', text: (err as Error).message });
    } finally {
      setExporting(false);
    }
  };

  // ── 衍生值 ───────────────────────────────────────────────────────────
  const columns = data?.columns ?? [];
  const filters = data?.filters ?? [];
  const activeFilterCount = Object.keys(query).filter((k) => !['sort', 'order', 'page', 'per_page'].includes(k)).length;
  const total = data?.pagination.total ?? 0;
  const from = total ? (page - 1) * perPage + 1 : 0;
  const to = Math.min(page * perPage, total);

  const clearFilters = () => {
    setSearchText('');
    const keep: MemberQuery = {};
    ['sort', 'order', 'per_page'].forEach((k) => { if (query[k]) keep[k] = query[k]; });
    const qs = new URLSearchParams(keep as Record<string, string>).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const sortBy = (key: MemberSort) => {
    if (sort === key) setQuery({ sort: key, order: order === 'asc' ? 'desc' : 'asc' }, { keepPage: false });
    else setQuery({ sort: key, order: key === 'username' ? 'asc' : 'desc' });
  };

  const SortHeader = ({ k, label }: { k: MemberSort; label: string }) => {
    const Icon = sort !== k ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => sortBy(k)}
        className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${sort === k ? 'text-foreground' : ''}`}
        aria-sort={sort === k ? (order === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  };

  const summary = data?.summary;
  const stats: { label: string; value?: number; onClick?: () => void; active?: boolean }[] = [
    { label: '會員總數', value: summary?.total, onClick: clearFilters, active: activeFilterCount === 0 },
    { label: '啟用中', value: summary?.active, onClick: () => setQuery({ status: 'active' }), active: query.status === 'active' && activeFilterCount === 1 },
    { label: '近 7 天新增', value: summary?.new_7d, onClick: () => setQuery({ joined: '7d' }), active: query.joined === '7d' && activeFilterCount === 1 },
    { label: '近 30 天新增', value: summary?.new_30d, onClick: () => setQuery({ joined: '30d' }), active: query.joined === '30d' && activeFilterCount === 1 },
  ];

  const rowActions = (m: MemberRow) => [
    { label: '查看資料', onClick: () => setSelected(m) },
    { label: '複製 Email', onClick: () => copyEmail(m) },
    {
      label: m.is_active ? '停用會員' : '重新啟用',
      onClick: () => toggleStatus(m),
      danger: m.is_active,
      hidden: !canManage,
      disabled: busyId === m.id,
    },
  ];

  const memberName = (m: MemberRow) => m.display_name || m.email || m.username;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
        {/* 標題 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">會員管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">前台註冊的會員。後台人員（管理員、編輯）請到「作者管理」。</p>
          </div>
          {canManage && (
            <button type="button" onClick={handleExport} disabled={exporting || !total} className={btnGhost}>
              <Download className="h-4 w-4" />
              {exporting ? '匯出中…' : activeFilterCount ? `匯出符合條件的 ${nf.format(total)} 位` : '匯出 CSV'}
            </button>
          )}
        </div>

        {/* 摘要：點了就套用對應篩選 */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {stats.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              aria-pressed={s.active}
              className={`rounded-lg border px-3 py-2.5 md:px-4 md:py-3 text-left transition-colors ${
                s.active ? 'border-admin-accent-500 bg-admin-accent-50 dark:bg-admin-accent-800/30' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 text-lg md:text-xl font-semibold tabular-nums text-foreground">
                {s.value === undefined ? '—' : nf.format(s.value)}
              </div>
            </button>
          ))}
        </div>

        {/* 搜尋與篩選 */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜尋 Email 或帳號"
              aria-label="搜尋 Email 或帳號"
              className="w-full rounded-md border border-border bg-card py-2 md:py-1.5 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-admin-accent-500"
            />
            {searchText && (
              <button type="button" onClick={() => setSearchText('')} aria-label="清除搜尋"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <select aria-label="狀態" value={String(query.status || '')} onChange={(e) => setQuery({ status: e.target.value })} className={selectCls}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select aria-label="註冊時間" value={String(query.joined || '')} onChange={(e) => setQuery({ joined: e.target.value })} className={selectCls}>
              {JOINED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {filters.map((f) => (
              <select key={f.key} aria-label={f.label} value={String(query[f.key] || '')}
                      onChange={(e) => setQuery({ [f.key]: e.target.value })} className={selectCls}>
                <option value="">{f.label}：不限</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{f.label}：{o.label}</option>)}
              </select>
            ))}
            {/* 手機沒有表頭可點，排序改用選單 */}
            <select aria-label="排序" value={`${sort}:${order}`} className={`${selectCls} md:hidden`}
                    onChange={(e) => { const [s, o] = e.target.value.split(':'); setQuery({ sort: s, order: o }); }}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} className="text-sm text-admin-accent-600 hover:underline px-1 py-2">
              清除條件
            </button>
          )}
        </div>

        {notice && (
          <div
            role={notice.type === 'error' ? 'alert' : 'status'}
            className={`mt-4 flex items-start justify-between gap-3 rounded-md border px-4 py-2 text-sm ${
              notice.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="關閉訊息" className="-m-1 p-1 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}　<button type="button" onClick={load} className="underline">重試</button>
          </div>
        )}

        {/* 名單 */}
        <div className="mt-4">
          {loading && !data ? (
            <AdminLoadingSkeleton variant="table" count={10} />
          ) : !data?.members.length ? (
            <AdminEmptyState
              icon={<Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />}
              title={activeFilterCount ? '沒有符合條件的會員' : '還沒有會員'}
              description={activeFilterCount ? '試試放寬篩選條件，或清除條件。' : '前台有人註冊後，會出現在這裡。'}
            />
          ) : (
            <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
              {/* 手機：一位會員一張卡 */}
              <ul className="md:hidden space-y-2">
                {data.members.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => setSelected(m)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <MemberAvatar src={m.avatar} name={memberName(m)} size={36} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground break-all">{memberName(m)}</span>
                          {m.display_name && <span className="block text-xs text-muted-foreground break-all">{m.email}</span>}
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <StatusBadge active={m.is_active} />
                            {columns.map((c) => (
                              <span key={c.key} className="inline-flex items-center gap-1">
                                {c.label}<ExtraValue kind={c.kind} value={m.extras[c.key]} />
                              </span>
                            ))}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            註冊 {formatDate(m.created_at)} · 登入 {formatRelative(m.last_login)}
                          </span>
                        </span>
                      </button>
                      <AdminActionMenu items={rowActions(m)} title={m.email} />
                    </div>
                  </li>
                ))}
              </ul>

              {/* 桌機：表格 */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3"><SortHeader k="username" label="會員" /></th>
                      {columns.map((c) => <th key={c.key} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">{c.label}</th>)}
                      <th scope="col" className="px-4 py-3 whitespace-nowrap"><SortHeader k="created_at" label="註冊時間" /></th>
                      <th scope="col" className="px-4 py-3 whitespace-nowrap"><SortHeader k="last_login" label="最近登入" /></th>
                      <th scope="col" className="px-4 py-3 font-medium">狀態</th>
                      <th scope="col" className="px-2 py-3"><span className="sr-only">操作</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.members.map((m) => (
                      <tr key={m.id} className={`hover:bg-muted/50 ${m.is_active ? '' : 'text-muted-foreground'}`}>
                        <td className="px-4 py-2.5 max-w-[320px]">
                          <button type="button" onClick={() => setSelected(m)} className="flex items-center gap-3 text-left min-w-0 w-full group">
                            <MemberAvatar src={m.avatar} name={memberName(m)} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground group-hover:text-admin-accent-600">{memberName(m)}</span>
                              {m.display_name && <span className="block truncate text-xs text-muted-foreground">{m.email}</span>}
                            </span>
                          </button>
                        </td>
                        {columns.map((c) => (
                          <td key={c.key} className="px-4 py-2.5 whitespace-nowrap"><ExtraValue kind={c.kind} value={m.extras[c.key]} /></td>
                        ))}
                        <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatDate(m.created_at)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" title={m.last_login ? formatDate(m.last_login) : undefined}>
                          {formatRelative(m.last_login)}
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge active={m.is_active} /></td>
                        <td className="px-2 py-2.5 text-right"><AdminActionMenu items={rowActions(m)} title={m.email} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分頁 */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">第 {nf.format(from)}–{nf.format(to)} 位，共 {nf.format(total)} 位</span>
                  <select aria-label="每頁筆數" value={perPage} onChange={(e) => setQuery({ per_page: e.target.value })} className={selectCls}>
                    {PER_PAGE.map((n) => <option key={n} value={n}>每頁 {n} 位</option>)}
                  </select>
                </div>
                {data.pagination.pages > 1 && (
                  <AdminPagination
                    pagination={{ ...data.pagination, has_prev: page > 1, has_next: page < data.pagination.pages }}
                    currentPage={page}
                    onPageChange={(p) => { setQuery({ page: p }, { keepPage: true }); window.scrollTo({ top: 0 }); }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <MemberDetailSheet
        member={selected}
        columns={columns}
        canManage={canManage}
        busy={busyId !== null && busyId === selected?.id}
        onClose={() => setSelected(null)}
        onToggleStatus={toggleStatus}
      />
    </AdminLayout>
  );
}

export default function MembersPage() {
  // useSearchParams 需要 Suspense 邊界（Next.js App Router 預渲染要求）
  return (
    <Suspense fallback={null}>
      <MembersPageContent />
    </Suspense>
  );
}
