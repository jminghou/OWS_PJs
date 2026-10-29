'use client';

/**
 * 產品管理 › 模組管理（2026-10-28）：商品頁與報告目錄頁的內容區塊。
 * 每個模組有後台名稱、類型與各語言版本；商品在產品管理的「頁面模組」分頁用選單選用（components/admin/ReportModulesTab.tsx）。
 * 規則（後端 extensions/page_modules）：語言版本從原文複製、確認後才能啟用；上架中頁面正在用的版本不能停用，被引用的不能刪除。
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Copy, Plus, Save, Trash2 } from 'lucide-react';
import { AdminLayout } from '@ows/admin-app';
import { AdminListLayout } from '@ows/ui/admin';
import Input from '@ows/ui/ui/Input';
import { pageModuleApi, type ModulePage, type ModuleUsage, type PageModuleDetail, type PageModuleGroup } from '@/lib/api/pageModules';
import { SALES_LANGUAGES } from '@/lib/report/locale';
import {
  CATALOG_MODULE_KEY,
  CATALOG_SLOTS,
  MODULE_TYPES,
  PRODUCT_SLOTS,
  emptyModuleData,
  moduleTypeInfo,
  type ModuleType,
} from '@/lib/report/modules';
import { IMPORT_SUMMARY, importReportModules } from '@/lib/report/moduleImport';
import { ModuleDataEditor, fieldCls, labelCls } from '@/components/admin/modules/ModuleDataEditor';
import { moduleAvailability } from '@/components/admin/ReportModulesTab';
import ModuleBrowser from '@/components/admin/modules/ModuleBrowser';

const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50';
const primaryBtn = `${btn} bg-admin-accent-600 text-white hover:bg-admin-accent-700`;
const ghostBtn = `${btn} border border-border text-foreground hover:bg-muted`;
const langShort = (code: string) => SALES_LANGUAGES.find((l) => l.code === code)?.short ?? code;
const slotLabel = (u: ModuleUsage) =>
  (u.kind === 'catalog' ? CATALOG_SLOTS : PRODUCT_SLOTS).find((s) => s.slot === u.slot)?.label ?? u.slot;

type Selection = { key: string; language: string } | null;

function CatalogPageEditor({ data, onChange, groups, language }: {
  data: Record<string, any>; onChange: (d: Record<string, any>) => void; groups: PageModuleGroup[]; language: string;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...data, ...patch });
  return (
    <div className="space-y-4">
      {([['promo', '頂端橫幅'], ['title', '標題'], ['subtitle', '副標']] as const).map(([k, label]) => (
        <div key={k}>
          <label className={labelCls}>{label}</label>
          <Input value={data[k] ?? ''} onChange={(e) => set({ [k]: e.target.value })} placeholder="留空不顯示" />
        </div>
      ))}
      {CATALOG_SLOTS.map(({ slot, type, label }) => (
        <div key={slot}>
          <label className={labelCls}>{label}（選用模組）</label>
          <select className={fieldCls} value={data[slot] ?? ''} onChange={(e) => set({ [slot]: e.target.value })}>
            <option value="">不顯示</option>
            {groups.filter((g) => g.type === type).map((g) => {
              const a = moduleAvailability(g, language);
              return <option key={g.module_key} value={g.module_key}>{g.name}{a.note ? `（${a.note}）` : ''}</option>;
            })}
          </select>
        </div>
      ))}
    </div>
  );
}

export default function PageModulesAdmin() {
  const [groups, setGroups] = useState<PageModuleGroup[] | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [detail, setDetail] = useState<PageModuleDetail | null>(null);
  const [usedBy, setUsedBy] = useState<ModuleUsage[]>([]);
  const [name, setName] = useState('');
  const [data, setData] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pages, setPages] = useState<ModulePage[]>([]);
  const [deepLink, setDeepLink] = useState<Selection>(null);
  const [creating, setCreating] = useState<{ type: ModuleType; name: string } | null>(null);

  const reload = useCallback(async () => {
    const r = await pageModuleApi.list();
    setGroups(r.modules);
    setPages(r.pages ?? []);
    return r.modules;
  }, []);

  useEffect(() => {
    reload().catch((e) => setMessage({ tone: 'error', text: e.message || '讀取失敗' }));
    // 從產品管理「編輯模組」連過來：?key=…&lang=…
    const q = new URLSearchParams(window.location.search);
    if (q.get('key')) {
      const link = { key: q.get('key')!, language: q.get('lang') || 'zh-TW' };
      setSelection(link);
      setDeepLink(link);
    }
  }, [reload]);

  const group = groups?.find((g) => g.module_key === selection?.key) ?? null;
  const version = group?.versions.find((v) => v.language === selection?.language) ?? null;

  // 選到某個語言版本：讀完整內容
  useEffect(() => {
    setDetail(null);
    setDirty(false);
    if (!version) return;
    pageModuleApi.get(version.id).then((r) => {
      setDetail(r.module);
      setUsedBy(r.used_by);
      setName(r.module.name);
      setData(r.module.data ?? {});
    }).catch((e) => setMessage({ tone: 'error', text: e.message }));
  }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (next: Selection) => {
    if (dirty && !confirm('目前的修改還沒儲存，要離開嗎？')) return;
    setMessage(null);
    setSelection(next);
  };

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ tone: 'ok', text: ok });
    } catch (e: any) {
      setMessage({ tone: 'error', text: e.message || '操作失敗' });
    } finally {
      setBusy(false);
    }
  };

  const refreshDetail = async (id: number) => {
    const r = await pageModuleApi.get(id);
    setDetail(r.module);
    setUsedBy(r.used_by);
    setName(r.module.name);
    setData(r.module.data ?? {});
    setDirty(false);
  };

  const save = () => detail && run(async () => {
    await pageModuleApi.update(detail.id, { name, data });
    await reload();
    await refreshDetail(detail.id);
  }, '已儲存。用到這個模組的頁面約 10 分鐘內更新（重新整理前台頁面即可看到）。');

  const toggleActive = () => detail && run(async () => {
    if (dirty) await pageModuleApi.update(detail.id, { name, data });
    await pageModuleApi.update(detail.id, { is_active: !detail.is_active });
    await reload();
    await refreshDetail(detail.id);
  }, detail.is_active ? '已停用' : '已啟用');

  const addLanguage = (language: string) => group && run(async () => {
    await pageModuleApi.addLanguage(group.root_id, language);
    await reload();
    setSelection({ key: group.module_key, language });
  }, `已建立${langShort(language)}版草稿：改寫成${langShort(language)}後，按「確認內容已完成」再啟用。`);

  const confirmTranslation = () => detail && run(async () => {
    if (dirty) await pageModuleApi.update(detail.id, { name, data });
    await pageModuleApi.confirmTranslation(detail.id);
    await reload();
    await refreshDetail(detail.id);
  }, '已確認');

  const duplicate = () => {
    if (!detail) return;
    const n = prompt('新模組的名稱', `${detail.name}（複製）`);
    if (!n?.trim()) return;
    run(async () => {
      const r = await pageModuleApi.duplicate(group!.root_id, n.trim());
      await reload();
      setSelection({ key: r.module.module_key, language: 'zh-TW' });
    }, '已複製成新模組（繁中）。要用在商品上，到出版商品的「頁面模組」分頁選它。');
  };

  const remove = () => {
    if (!detail) return;
    if (!confirm(`刪除「${detail.name}」的${langShort(detail.language)}版本？刪除後無法復原。`)) return;
    run(async () => {
      await pageModuleApi.remove(detail.id);
      const next = await reload();
      const g = next.find((x) => x.module_key === detail.module_key);
      setSelection(g ? { key: g.module_key, language: g.versions[0].language } : null);
    }, '已刪除');
  };

  const create = () => creating && run(async () => {
    const r = await pageModuleApi.create({ type: creating.type, name: creating.name.trim(), data: emptyModuleData(creating.type) });
    setCreating(null);
    await reload();
    setSelection({ key: r.module.module_key, language: 'zh-TW' });
  }, '已建立');

  const runImport = () => {
    if (!confirm(`把${IMPORT_SUMMARY}轉成模組，並幫報告商品的各語言版本選好？\n已經存在的模組會略過，前台看起來不會改變。`)) return;
    run(async () => {
      const r = await importReportModules();
      await reload();
      setMessage({ tone: 'ok', text: `完成：建立 ${r.created} 個模組版本（略過 ${r.skipped} 個已存在的），${r.products} 個商品改用模組。` });
    });
  };

  const catalog = groups?.find((g) => g.module_key === CATALOG_MODULE_KEY);

  const sidebar = (
    <div className="space-y-3 p-3">
      <button type="button" className={`${primaryBtn} w-full justify-center`} onClick={() => setCreating({ type: 'faq', name: '' })}>
        <Plus className="h-4 w-4" /> 新增模組
      </button>
      {groups && (
        <ModuleBrowser
          groups={groups}
          pages={pages}
          selectedKey={selection?.key ?? null}
          deepLink={deepLink}
          onSelect={(key, language) => select({ key, language })}
          onLanguageChange={(language) => { if (selection && selection.language !== language) select({ key: selection.key, language }); }}
        />
      )}
    </div>
  );

  const info = detail ? moduleTypeInfo(detail.type) : undefined;
  const t = detail?.translation;

  return (
    <AdminLayout>
      <AdminListLayout
        sidebar={sidebar}
        sidebarWidth={300}
        mobileView={selection || creating ? 'detail' : 'list'}
        onMobileBack={() => { setCreating(null); select(null); }}
        mobileTitle={detail?.name ?? '模組管理'}
      >
        <div className="mx-auto max-w-3xl space-y-5">
          {message && (
            <p className={`rounded-lg px-4 py-3 text-sm ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>
          )}

          {groups && !catalog && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-medium">第一次使用：把現有內容轉成模組</p>
              <p className="text-xs leading-relaxed">
                會把{IMPORT_SUMMARY}轉成模組，並幫報告商品的各語言版本選好。繁中照目前前台顯示的內容轉換，前台看起來不會改變；
                其他語言只轉你在後台改寫過的段落，缺的模組會在那個語言的商品上架時列出來。
              </p>
              <button type="button" className={`${btn} bg-amber-600 text-white hover:bg-amber-700`} disabled={busy} onClick={runImport}>
                從現有內容建立模組
              </button>
            </div>
          )}

          {creating && (
            <section className="space-y-4 rounded-lg border border-border p-5">
              <h2 className="text-base font-semibold text-foreground">新增模組</h2>
              <div>
                <label className={labelCls}>類型</label>
                <select className={fieldCls} value={creating.type} onChange={(e) => setCreating({ ...creating, type: e.target.value as ModuleType })}>
                  {MODULE_TYPES.map((x) => <option key={x.type} value={x.type}>{x.label}：{x.where}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>模組名稱（只在後台顯示）</label>
                <Input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="例如：規格與品質（精裝版通用）" />
              </div>
              <p className="text-xs text-muted-foreground">新模組先建立繁中版本；其他語言建立後再用語言列加上。</p>
              <div className="flex gap-2">
                <button type="button" className={primaryBtn} disabled={busy || !creating.name.trim()} onClick={create}>建立</button>
                <button type="button" className={ghostBtn} onClick={() => setCreating(null)}>取消</button>
              </div>
            </section>
          )}

          {!creating && !selection && groups && catalog && (
            <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">從左邊選一個模組編輯，或按「新增模組」。</p>
          )}

          {!creating && group && (
            <>
              <header className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{group.type === 'catalog_page' ? '頁面設定' : moduleTypeInfo(group.type)?.label}</span>
                  <span>代碼 <code>{group.module_key}</code></span>
                </div>
                {/* 語言列：實心＝啟用中、空心＝停用中、虛線＝還沒建立 */}
                <div className="flex flex-wrap gap-2">
                  {SALES_LANGUAGES.map((l) => {
                    const v = group.versions.find((x) => x.language === l.code);
                    const current = selection?.language === l.code;
                    if (!v) {
                      return (
                        <button key={l.code} type="button" disabled={busy} onClick={() => addLanguage(l.code)}
                          className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-admin-accent-500 hover:text-admin-accent-600">
                          ＋ {l.short}
                        </button>
                      );
                    }
                    return (
                      <button key={l.code} type="button" onClick={() => select({ key: group.module_key, language: l.code })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${v.is_active ? 'bg-admin-accent-600 text-white' : 'border border-border text-foreground'} ${current ? 'ring-2 ring-admin-accent-300 ring-offset-1' : ''}`}>
                        {l.short}{v.is_active ? '' : '（停用）'}{v.translation?.stale ? ' ⚠' : ''}
                      </button>
                    );
                  })}
                </div>
              </header>

              {!version && <p className="text-sm text-muted-foreground">這個語言還沒有版本，按上方「＋」從繁中複製一份草稿。</p>}

              {detail && (
                <>
                  {t && !t.confirmed && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      <span>這是從{langShort(t.source_language)}複製的草稿：把每一段改寫成{langShort(detail.language)}後，按「確認內容已完成」才能啟用。</span>
                      <button type="button" className={`${btn} bg-amber-600 py-1 text-xs text-white hover:bg-amber-700`} disabled={busy} onClick={confirmTranslation}>確認內容已完成</button>
                    </div>
                  )}
                  {t?.confirmed && t.stale && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      <span>{langShort(t.source_language)}原文在這個版本確認之後又改過，請對照更新。</span>
                      <button type="button" className={`${btn} border border-amber-300 py-1 text-xs hover:bg-amber-100`} disabled={busy} onClick={confirmTranslation}>已同步原文</button>
                    </div>
                  )}

                  <section className="space-y-4 rounded-lg border border-border p-5">
                    <div>
                      <label className={labelCls}>模組名稱（只在後台顯示）</label>
                      <Input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
                      {info && <p className="mt-1 text-xs text-muted-foreground">位置：{info.where}</p>}
                    </div>
                    <hr className="border-border" />
                    {detail.type === 'catalog_page' ? (
                      <CatalogPageEditor data={data} groups={groups ?? []} language={detail.language}
                        onChange={(d) => { setData(d); setDirty(true); }} />
                    ) : (
                      <ModuleDataEditor type={detail.type} data={data} onChange={(d) => { setData(d); setDirty(true); }} />
                    )}
                  </section>

                  <section className="rounded-lg border border-border p-4">
                    <h3 className="text-sm font-semibold text-foreground">使用中的頁面</h3>
                    {usedBy.length ? (
                      <>
                        <ul className="mt-2 space-y-1 text-sm">
                          {usedBy.map((u, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-2">
                              <span className={`rounded px-1.5 text-[11px] ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{u.is_active ? '上架中' : '未上架'}</span>
                              {u.kind === 'product' ? <Link href="/admin/products" className="text-admin-accent-600 hover:underline">{u.name}</Link> : <span>{u.name}</span>}
                              <span className="text-xs text-muted-foreground">{langShort(u.language)}・{slotLabel(u)}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 flex gap-1 text-xs text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          儲存後，以上頁面的這一段會一起改變（各語言頁面顯示各自的語言版本）。
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">還沒有頁面使用。到出版商品的「頁面模組」分頁選用。</p>
                    )}
                  </section>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={primaryBtn} disabled={busy || !dirty} onClick={save}><Save className="h-4 w-4" /> 儲存</button>
                    <button type="button" className={ghostBtn} disabled={busy} onClick={toggleActive}>{detail.is_active ? '停用' : '啟用'}</button>
                    {detail.type !== 'catalog_page' && (
                      <button type="button" className={ghostBtn} disabled={busy} onClick={duplicate}><Copy className="h-4 w-4" /> 複製成新模組</button>
                    )}
                    {!detail.is_active && (
                      <button type="button" className={`${ghostBtn} text-red-600`} disabled={busy} onClick={remove}><Trash2 className="h-4 w-4" /> 刪除這個語言版本</button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </AdminListLayout>
    </AdminLayout>
  );
}
